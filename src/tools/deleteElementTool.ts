import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramSourceFromState } from "../plantuml-utils.js";
import { createToolResponse, getErrorMessage, createErrorResponse, createDiagramMetadata } from "../utils.js";

/**
 * Implementation of delete-element tool for diagram refinement
 * Allows removing existing elements and their related relationships
 * 
 * This tool handles the complete deletion process including:
 * 1. Removing the specified element from the diagram
 * 2. Removing any relationships that reference the element
 * 3. Regenerating the diagram to reflect the changes
 * 4. Returning a success message with details of what was removed
 */
export const deleteElementTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "delete-element",
    `Delete an existing element from the C4 diagram.
    
    Required Input Fields:
    - projectId: String (UUID from create-c4-project)
    - diagramId: String (UUID from create-context-diagram)
    - elementId: String (UUID of the element to delete)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the deletion)
    - projectId: String (UUID of the project)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      projectId: z.string().describe("UUID of the project from create-c4-project"),
      diagramId: z.string().describe("UUID of the diagram from create-context-diagram"),
      elementId: z.string().describe("UUID of the element to delete")
    },
    async ({ projectId, diagramId, elementId }, extra) => {
      try {
        // Check if project exists
        const project = await db.getProject(projectId);
        if (!project) {
          throw new Error(`Project ${projectId} not found. Please provide a valid project UUID.`);
        }
        
        // Check if diagram exists and belongs to the project
        const diagram = await db.getDiagram(project.id, diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID.`);
        }

        // Find the element to delete
        const element = diagram.elements.find(e => e.id === elementId);
        if (!element) {
          throw new Error(`Element not found: ${elementId}`);
        }

        // Store the element name for the response message
        const elementName = element.name;
        
        // Create filtered copies of elements and relationships
        const updatedElements = diagram.elements.filter(e => e.id !== elementId);
        
        // Remove all relationships where the element is the source or target
        const updatedRelationships = diagram.relationships.filter(
          r => r.sourceId !== elementId && r.targetId !== elementId
        );
        
        // Calculate how many relationships were removed
        const removedRelationshipsCount = diagram.relationships.length - updatedRelationships.length;
        
        // Update the diagram with new elements and relationships
        const updatedDiagram = await db.updateDiagram(projectId, diagramId, {
          elements: updatedElements,
          relationships: updatedRelationships
        });
        
        try {
          // Generate the diagram PUML and save it to disk
          await generateDiagramSourceFromState(
            db,
            updatedDiagram,
            updatedDiagram.pumlPath
          );
        } catch (diagramError) {
          console.warn(`Failed to generate diagram after deleting element ${elementId}: ${getErrorMessage(diagramError)}`);
        }
        
        // Create a message indicating what was deleted
        let message = `Element "${elementName}" was successfully deleted from the diagram.`;
        if (removedRelationshipsCount > 0) {
          message += ` ${removedRelationshipsCount} related relationship${removedRelationshipsCount === 1 ? ' was' : 's were'} also removed.`;
        }
        message += ` Would you like to make any other changes to your diagram?`;
        
        // Build complete metadata for the diagram
        const metadata = createDiagramMetadata(updatedDiagram, projectId);
        
        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error deleting element: ${getErrorMessage(error)}`);
      }
    }
  );
};
