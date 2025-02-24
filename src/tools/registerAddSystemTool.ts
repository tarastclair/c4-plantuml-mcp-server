import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState, writeDiagramToFile } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage } from "../utils.js";
import { DiagramWorkflowState, updateWorkflowState } from "../workflow-state.js";

/**
 * Implementation of add-system tool with nextPrompt workflow support
 * Creates a system element and updates the diagram
 */
export const registerAddSystemTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-system",
    `Add or update a system in the C4 diagram.
    
    Required Input Fields:
    - diagramId: String (UUID from createC4Diagram)
    - name: String (Name of the system)
    - description: String (Description of what the system does)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - diagramId: String (UUID of the diagram)
    - workflowState: Object (The current state of the workflow)
    
    Response Message Example: "Created new system (UUID: <SYSTEM_UUID>). Now we need to identify the users or actors who interact with this system."`,
    {
      diagramId: z.string().describe("UUID of the diagram from createC4Diagram"),
      name: z.string().describe("Name of the system"),
      description: z.string().describe("Description of the system")
    },
    async ({ diagramId, name, description }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID.`);
        }

        // Add the system element
        const system = await db.addElement(diagramId, {
          type: 'system',
          name,
          description
        });

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating relationship: ${diagramId}`);
        }

        // Generate and write the new diagram image
        const image = await generateDiagramFromState(updatedDiagram);
        await db.cacheDiagram(diagramId, image);
        await writeDiagramToFile(diagramId, image);

        // Determine next state based on current diagram state
        const personCount = updatedDiagram.elements.filter(e => e.type === 'person').length;
        const nextState: DiagramWorkflowState = personCount === 0
          ? DiagramWorkflowState.ACTOR_DISCOVERY // First person - stay in actor discovery
          : DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION; // Multiple people - move to external systems

        // Update workflow state to actor discovery
        const updatedState = await updateWorkflowState(db, diagramId, nextState);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }
        
        const baseMessage = `Created new system (UUID: ${system.id}).`;
        const message = nextState === DiagramWorkflowState.ACTOR_DISCOVERY
          ? `${baseMessage} Now we need to identify the users or actors who interact with this system.`
          : `${baseMessage} Now we need to identify the external systems that interact with your core system.`;

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState
        });
      } catch (error) {
        return createErrorResponse(`Error adding system: ${getErrorMessage(error)}`);
      }
    }
  );
};
