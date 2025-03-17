import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState } from "../plantuml-utils.js";
import { C4Relationship } from "../types-and-interfaces.js";
import { createToolResponse, getErrorMessage, createErrorResponse, buildEntityMappings } from "../utils.js";

/**
 * Implementation of update-relationship tool for diagram refinement
 * Allows modifying existing relationships
 */
export const updateRelationshipTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "update-relationship",
    `Update an existing relationship in the C4 diagram
    
    Required Input Fields:
    - projectId: String (UUID from create-c4-project)
    - diagramId: String (UUID from create-context-diagram)
    - relationshipId: String (UUID of the relationship to update)

    Optional Input Fields:
    - sourceId: String (UUID of the new source element)
    - targetId: String (UUID of the new target element)
    - description: String (New description for the relationship)
    - technology: String (New technology used in the relationship)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - projectId: String (UUID of the project)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      projectId: z.string().describe("UUID of the project from create-c4-project"),
      diagramId: z.string().describe("UUID of the diagram from create-context-diagram"),
      relationshipId: z.string().describe("UUID of the relationship to update"),
      sourceId: z.string().optional().describe("UUID of the new source element"),
      targetId: z.string().optional().describe("UUID of the new target element"),
      description: z.string().optional().describe("New description for the relationship"),
      technology: z.string().optional().describe("New technology used in the relationship")
    },
    async ({ projectId, diagramId, relationshipId, sourceId, targetId, description, technology }, extra) => {
      try {
        // Check if project exists
        const project = await db.getProject(projectId);
        if (!project) {
          throw new Error(`Project ${projectId} not found. Please provide a valid project UUID.`);
        }
        
        // Check if diagram exists and belongs to the project
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID.`);
        }
        
        if (!project.diagrams.includes(diagramId)) {
          throw new Error(`Diagram ${diagramId} does not belong to project ${projectId}.`);
        }

        // Find the relationship to update
        const relationship = diagram.relationships.find(r => r.id === relationshipId);
        if (!relationship) {
          throw new Error(`Relationship not found: ${relationshipId}`);
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

        // Get the updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating relationship: ${diagramId}`);
        }

        try {
          // Generate the diagram, save files, and get the PNG data in one step
          const pngData = await generateDiagramFromState(
            updatedDiagram,
            updatedDiagram.pumlPath,
            updatedDiagram.pngPath
          );
          
          // Cache the diagram for quick access
          await db.cacheDiagram(diagramId, pngData);
        } catch (diagramError) {
          console.warn(`Failed to generate diagram after updating relationship ${relationshipId}: ${getErrorMessage(diagramError)}`);
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
        
        const message = `Updated relationship "${updatedRelationship.description}" from "${sourceName}" to "${targetName}". Should we make any other refinements?`;

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(updatedDiagram);

        return createToolResponse(message, {
          projectId,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error updating relationship: ${getErrorMessage(error)}`);
      }
    }
  );
};