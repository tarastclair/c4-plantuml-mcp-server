import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";

/**
 * Creates a relationship between elements and updates the diagram
 */
export const addRelationshipTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-relationship",
    `Add a relationship between elements in the C4 diagram.

    Required Input Fields:
    - projectId: String (UUID from create-c4-project)
    - diagramId: String (UUID from create-context-diagram)
    - sourceId: String (UUID of the source element)
    - targetId: String (UUID of the target element)
    - description: String (Description of the relationship)

    Optional Input Fields:
    - technology: String (Optional technology used in the relationship)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - projectId: String (UUID of the project)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      projectId: z.string().describe("UUID of the project from create-c4-project"),
      diagramId: z.string().describe("UUID of the diagram from create-context-diagram"),
      sourceId: z.string().describe("ID of the source element"),
      targetId: z.string().describe("ID of the target element"),
      description: z.string().describe("Description of the relationship"),
      technology: z.string().optional().describe("Optional technology used in the relationship")
    },
    async ({ projectId, diagramId, sourceId, targetId, description, technology }, extra) => {
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

        // Validate elements exist
        const sourceExists = diagram.elements.some(e => e.id === sourceId);
        const targetExists = diagram.elements.some(e => e.id === targetId);
        if (!sourceExists || !targetExists) {
          throw new Error("Source or target element not found");
        }

        // Add relationship
        const relationship = await db.addRelationship(project.id, diagram.id, {
          sourceId,
          targetId,
          description,
          technology
        });

        // Get the updated diagram
        const updatedDiagram = await db.getDiagram(project.id, diagram.id);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after adding relationship: ${diagramId}`);
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
          console.warn(`Failed to generate diagram for relationship ${relationship.id}: ${getErrorMessage(diagramError)}`);
        }

        // Get source and target element names for a more descriptive message
        const sourceElement = updatedDiagram.elements.find(e => e.id === sourceId);
        const targetElement = updatedDiagram.elements.find(e => e.id === targetId);
        
        // Create a user-friendly response message
        const sourceName = sourceElement?.name || 'unknown';
        const targetName = targetElement?.name || 'unknown';
        
        const message = `Added relationship "${description}" from "${sourceName}" to "${targetName}". Are there any other relationships to define?`;

        // Build complete metadata for the diagram
        const metadata = createDiagramMetadata(diagram, projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error adding relationship: ${getErrorMessage(error)}`);
      }
    }
  );
};