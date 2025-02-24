import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState, writeDiagramToFile } from "../plantuml-utils.js";
import { C4Relationship } from "../types-and-interfaces.js";
import { createToolResponse, getErrorMessage, createErrorResponse, buildEntityMappings } from "../utils.js";
import { updateWorkflowState, DiagramWorkflowState } from "../workflow-state.js";

/**
 * Implementation of update-relationship tool for diagram refinement
 * Allows modifying existing relationships
 */
export const registerUpdateRelationshipTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "update-relationship",
    `Update an existing relationship in the C4 diagram
    
    Required Input Fields:
    - diagramId: String (UUID from createC4Diagram)
    - relationshipId: String (UUID of the relationship to update

    Optional Input Fields:
    - sourceId: String (UUID of the new source element)
    - targetId: String (UUID of the new target element)
    - description: String (New description for the relationship)
    - technology: String (New technology used in the relationship)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - diagramId: String (UUID of the diagram)
    - workflowState: Object (The current state of the workflow)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      diagramId: z.string().describe("UUID of the diagram"),
      relationshipId: z.string().describe("UUID of the relationship to update"),
      sourceId: z.string().optional().describe("UUID of the new source element"),
      targetId: z.string().optional().describe("UUID of the new target element"),
      description: z.string().optional().describe("New description for the relationship"),
      technology: z.string().optional().describe("New technology used in the relationship")
    },
    async ({ diagramId, relationshipId, sourceId, targetId, description, technology }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID.`);
        }

        // Find the relationship to update
        const relationship = diagram.relationships.find(r => r.id === relationshipId);
        if (!relationship) {
          throw new Error(`Relationship not found: ${relationshipId}`);
        }

        // Validate elements exist
        const sourceExists = diagram.elements.some(e => e.id === sourceId);
        const targetExists = diagram.elements.some(e => e.id === targetId);
        if (!sourceExists || !targetExists) {
          throw new Error("Source or target element not found");
        }

        // Collect updates
        const updates: Partial<C4Relationship> = {};
        if (description !== undefined) updates.description = description;
        if (technology !== undefined) updates.technology = technology;

        // If updating source/target, validate they exist
        if (sourceId !== undefined) {
          const sourceExists = diagram.elements.some(e => e.id === sourceId);
          if (!sourceExists) {
            throw new Error(`Source element not found: ${sourceId}`);
          }
          updates.sourceId = sourceId;
        }

        if (targetId !== undefined) {
          const targetExists = diagram.elements.some(e => e.id === targetId);
          if (!targetExists) {
            throw new Error(`Target element not found: ${targetId}`);
          }
          updates.targetId = targetId;
        }

        // Perform update
        await db.updateRelationship(diagramId, relationshipId, updates);

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating relationship: ${diagramId}`);
        }

        // Generate and write the new diagram image
        const image = await generateDiagramFromState(updatedDiagram);
        await db.cacheDiagram(diagramId, image);
        await writeDiagramToFile(diagramId, image);

        // Update workflow state to actor discovery
        const updatedState = await updateWorkflowState(db, diagramId, DiagramWorkflowState.REFINEMENT);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        // Get source and target element names for a more descriptive message
        const updatedRelationship = updatedDiagram.relationships.find(r => r.id === relationshipId);
        if (!updatedRelationship) {
          throw new Error(`Relationship not found after update: ${relationshipId}`);
        }
        
        const sourceElement = updatedDiagram.elements.find(e => e.id === updatedRelationship.sourceId);
        const targetElement = updatedDiagram.elements.find(e => e.id === updatedRelationship.targetId);
        
        // Create a user-friendly response message
        const sourceName = sourceElement?.name || 'unknown';
        const targetName = targetElement?.name || 'unknown';
        
        const message = `Relationship ${relationship.id} from ${sourceName} (${updatedRelationship.sourceId}) to ${targetName} (${updatedRelationship.targetId}) updated successfully. Should we make any other refinements?`;

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(updatedDiagram);

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error updating relationship: ${getErrorMessage(error)}`);
      }
    }
  );
};
