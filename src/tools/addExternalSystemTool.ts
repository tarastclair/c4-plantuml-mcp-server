import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState, writeDiagramToFile } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, buildEntityMappings } from "../utils.js";
import { DiagramWorkflowState, updateWorkflowState } from "../workflow-state.js";

/**
 * Implementation of add-external-system tool with nextPrompt workflow support
 * Creates an external system element and updates the diagram
 */
export const addExternalSystemTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-external-system",
    `Add a person/actor to the C4 diagram.
    
    Required Input Fields:
    - diagramId: String (UUID from createC4Diagram)
    - name: String (Name of the external system)
    - description: String (Description of the external system)

    Optional Input Fields:
    - systemId: String (Optional UUID of the core system this external system interacts with)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - diagramId: String (UUID of the diagram)
    - workflowState: Object (The current state of the workflow)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      diagramId: z.string().describe("UUID of the diagram"),
      name: z.string().describe("Name of the external system"),
      description: z.string().describe("Description of the external system"),
      systemId: z.string().optional().describe("Optional UUID of the core system this external system interacts with")
    },
    async ({ diagramId, name, description, systemId }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID`);
        }

        // Add the external system element
        const externalSystem = await db.addElement(diagramId, {
          type: 'external-system',
          name,
          description
        });

        // If systemId is provided, create a relationship
        if (systemId) {
          // Verify system exists
          const systemExists = diagram.elements.some(e => e.id === systemId);
          if (!systemExists) {
            throw new Error(`System not found: ${systemId}`);
          }

          // Create relationship
          await db.addRelationship(diagramId, {
            sourceId: systemId,
            targetId: externalSystem.id,
            description: "Uses"
          });
        }

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after adding external system: ${diagramId}`);
        }

        try {
          // Generate and write the new diagram image
          const image = await generateDiagramFromState(updatedDiagram);
          await db.cacheDiagram(diagramId, image);
          await writeDiagramToFile(updatedDiagram.name, 'context', image);
        } catch (diagramError) {
          console.warn(`Failed to generate diagram for external system ${externalSystem.id}, but continuing with workflow: ${getErrorMessage(diagramError)}`);
          // We'll continue without the diagram - the workflow is more important than the visualization
        }

        const nextState = updatedDiagram.elements.filter(e => e.type === 'external-system').length === 0
          ? DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION // First external system - stay in external system identification
          : DiagramWorkflowState.RELATIONSHIP_DEFINITION; // Multiple external systems - move to relationship definition
        
        // Update workflow state to actor discovery
        const updatedState = await updateWorkflowState(db, diagramId, nextState);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        let baseMessage = ''
        if (systemId) {
          baseMessage = `Created new external system (UUID: ${externalSystem.id}) who interacts with system (UUID: ${systemId}).`;
        } else {
          baseMessage = `Created new external system (UUID: ${externalSystem.id}).`;
        }
        const message = nextState === DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION
          ? "Now we need to determine whether there are any other external systems that interact with the core system."
          : "Now we need to define the relationships between these elements.";

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(updatedDiagram);

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error adding external system: ${getErrorMessage(error)}`);
      }
    }
  );
};
