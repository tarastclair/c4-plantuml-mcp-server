import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState, writeDiagramToFile } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, buildEntityMappings } from "../utils.js";
import { DiagramWorkflowState, updateWorkflowState } from "../workflow-state.js";

/**
 * Implementation of add-person tool with nextPrompt workflow support
 * Creates a person/actor element and updates the diagram
 */
export const registerAddPersonTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-person",
    `Add a person/actor to the C4 diagram.
    
    Required Input Fields:
    - diagramId: String (UUID from createC4Diagram)
    - name: String (Name of the person/actor)
    - description: String (Description of the person/actor)

    Optional Input Fields:
    - systemId: String (UUID of the system this person interacts with)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - diagramId: String (UUID of the diagram)
    - workflowState: Object (The current state of the workflow)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      diagramId: z.string().describe("UUID of the diagram"),
      name: z.string().describe("Name of the person/actor"),
      description: z.string().describe("Description of the person/actor"),
      systemId: z.string().optional().describe("Optional ID of the system this person interacts with")
    },
    async ({ diagramId, name, description, systemId }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID`);
        }

        // Add the person element
        const person = await db.addElement(diagramId, {
          type: 'person',
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
            sourceId: person.id,
            targetId: systemId,
            description: "Uses"
          });
        }

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after adding person: ${diagramId}`);
        }

        try {
          // Generate and write the new diagram image
          const image = await generateDiagramFromState(updatedDiagram);
          await db.cacheDiagram(diagramId, image);
          await writeDiagramToFile(updatedDiagram.name, 'context', image);
        } catch (diagramError) {
          console.warn(`Failed to generate diagram for person ${person.id}, but continuing with workflow: ${getErrorMessage(diagramError)}`);
          // We'll continue without the diagram - the workflow is more important than the visualization
        }

        const nextState = updatedDiagram.elements.filter(e => e.type === 'person').length === 0
          ? DiagramWorkflowState.ACTOR_DISCOVERY // First person - stay in actor discovery
          : DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION; // Multiple people - move to external systems

        // Update workflow state to actor discovery
        const updatedState = await updateWorkflowState(db, diagramId, nextState);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        let baseMessage = ''
        if (systemId) {
          baseMessage = `Created new person (UUID: ${person.id}) who interacts with system (UUID: ${systemId}).`;
        } else {
          baseMessage = `Created new person (UUID: ${person.id}).`;
        }
        const message = nextState === DiagramWorkflowState.ACTOR_DISCOVERY
          ? `${baseMessage} Now we need to determine whether there any other users or actors who interact with the core system.`
          : `${baseMessage} Now we need to identify any external systems that interact with the core system.`;

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(updatedDiagram);

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error adding person: ${getErrorMessage(error)}`);
      }
    }
  );
};
