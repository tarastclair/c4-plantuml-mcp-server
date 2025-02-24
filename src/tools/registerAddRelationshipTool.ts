import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState, writeDiagramToFile } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, buildEntityMappings } from "../utils.js";
import { DiagramWorkflowState, updateWorkflowState } from "../workflow-state.js";

/**
 * Implementation of add-relationship tool with nextPrompt workflow support
 * Creates a relationship between elements and updates the diagram
 */
export const registerAddRelationshipTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-relationship",
    `Add a relationship between elements in the C4 diagram.

    Required Input Fields:
    - diagramId: String (UUID from createC4Diagram)
    - sourceId: String (UUID of the source element)
    - targetId: String (UUID of the target element)
    - description: String (Description of the relationship)

    Optional Input Fields:
    - technology: String (Optional technology used in the relationship)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - diagramId: String (UUID of the diagram)
    - workflowState: Object (The current state of the workflow)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      diagramId: z.string().describe("ID of the diagram"),
      sourceId: z.string().describe("ID of the source element"),
      targetId: z.string().describe("ID of the target element"),
      description: z.string().describe("Description of the relationship"),
      technology: z.string().optional().describe("Optional technology used in the relationship")
    },
    async ({ diagramId, sourceId, targetId, description, technology }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID`);
        }

        // Validate elements exist
        const sourceExists = diagram.elements.some(e => e.id === sourceId);
        const targetExists = diagram.elements.some(e => e.id === targetId);
        if (!sourceExists || !targetExists) {
          throw new Error("Source or target element not found");
        }

        // Add relationship
        const relationship = await db.addRelationship(diagramId, {
          sourceId,
          targetId,
          description,
          technology
        });

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after adding relationship: ${diagramId}`);
        }

        try {
          // Generate and write the new diagram image
          const image = await generateDiagramFromState(updatedDiagram);
          await db.cacheDiagram(diagramId, image);
          await writeDiagramToFile(updatedDiagram.name, 'context', image);
        } catch (diagramError) {
          console.warn(`Failed to generate diagram for relationship ${relationship.id}, but continuing with workflow: ${getErrorMessage(diagramError)}`);
          // We'll continue without the diagram - the workflow is more important than the visualization
        }

        // Update workflow state to actor discovery
        const updatedState = await updateWorkflowState(db, diagramId, DiagramWorkflowState.RELATIONSHIP_DEFINITION);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        // Get source and target element names for a more descriptive message
        const sourceElement = updatedDiagram.elements.find(e => e.id === sourceId);
        const targetElement = updatedDiagram.elements.find(e => e.id === targetId);
        
        // Create a user-friendly response message
        const sourceName = sourceElement?.name || 'unknown';
        const targetName = targetElement?.name || 'unknown';
        
        const message = `Relationship ${relationship.id} added from ${sourceName} (${sourceId}) to ${targetName} (${targetId}). Are there any other relationships to define?`;

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(updatedDiagram);

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error adding relationship: ${getErrorMessage(error)}`);
      }
    }
  );
};
