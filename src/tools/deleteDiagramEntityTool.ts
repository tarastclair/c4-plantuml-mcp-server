/**
 * AI ASSISTANCE DISCLAIMER
 * Parts of this code were written with the assistance of an AI language model.
 * While efforts have been made to ensure quality and correctness,
 * please review thoroughly before implementing in production environments.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db/index.js";
import { generateDiagramSourceFromState } from "../plantuml-utils/index.js";
import { createToolResponse, getErrorMessage, createErrorResponse, createDiagramMetadata } from "../utils.js";

export const deleteDiagramEntityTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "delete-entity",
    `Delete an existing element or relationship from the C4 diagram.
    
    Required Input Fields:
    - projectId: String (UUID from create-c4-project)
    - diagramId: String (UUID from create-context-diagram)

    Conditional Input Fields (ONE of the following is required):
    - elementId: String (UUID of the element to delete)
    - relationshipId: String (UUID of the relationship to delete)

    You must provide either elementId OR relationshipId, but not both.
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.`,
    {
      projectId: z.string().describe("UUID of the project from create-c4-project"),
      diagramId: z.string().describe("UUID of the diagram from create-context-diagram"),
      elementId: z.string().optional().describe("UUID of the element to delete"),
      relationshipId: z.string().optional().describe("UUID of the relationship to delete")
    },
    async ({ projectId, diagramId, elementId, relationshipId }, extra) => {
      try {
        // Validate that exactly one of elementId or relationshipId is provided
        if ((!elementId && !relationshipId) || (elementId && relationshipId)) {
          throw new Error("You must provide either elementId OR relationshipId, but not both or neither.");
        }

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

        let message = "";
        let updatedElements = [...diagram.elements];
        let updatedRelationships = [...diagram.relationships];

        // Handle element deletion
        if (elementId) {
          // Find the element to delete
          const element = diagram.elements.find(e => e.id === elementId);
          if (!element) {
            throw new Error(`Element not found: ${elementId}`);
          }

          // Store the element name for the response message
          const elementName = element.name;
          
          // Create filtered copy of elements
          updatedElements = diagram.elements.filter(e => e.id !== elementId);
          
          // Remove all relationships where the element is the source or target
          const originalRelationshipsCount = diagram.relationships.length;
          updatedRelationships = diagram.relationships.filter(
            r => r.sourceId !== elementId && r.targetId !== elementId
          );
          
          // Calculate how many relationships were removed
          const removedRelationshipsCount = originalRelationshipsCount - updatedRelationships.length;
          
          // Create a message indicating what was deleted
          message = `Element "${elementName}" was successfully deleted from the diagram.`;
          if (removedRelationshipsCount > 0) {
            message += ` ${removedRelationshipsCount} related relationship${removedRelationshipsCount === 1 ? ' was' : 's were'} also removed.`;
          }
        } 
        // Handle relationship deletion
        else if (relationshipId) {
          // Find the relationship to delete
          const relationship = diagram.relationships.find(r => r.id === relationshipId);
          if (!relationship) {
            throw new Error(`Relationship not found: ${relationshipId}`);
          }

          // Store info for the response message
          const sourceElement = diagram.elements.find(e => e.id === relationship.sourceId);
          const targetElement = diagram.elements.find(e => e.id === relationship.targetId);
          
          // Create filtered copy of relationships
          updatedRelationships = diagram.relationships.filter(r => r.id !== relationshipId);
          
          // Create a message indicating what was deleted
          const sourceName = sourceElement?.name || 'unknown';
          const targetName = targetElement?.name || 'unknown';
          message = `Relationship "${relationship.description}" from "${sourceName}" to "${targetName}" was successfully deleted.`;
        }
        
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
          console.warn(`Failed to generate diagram after entity deletion: ${getErrorMessage(diagramError)}`);
        }
        
        // Complete the message
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
