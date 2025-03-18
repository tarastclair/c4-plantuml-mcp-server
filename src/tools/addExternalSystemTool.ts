import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";

/**
 * Creates an external system element and updates the diagram
 */
export const addExternalSystemTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-external-system",
    `Add a person/actor to the C4 diagram.
    
    Required Input Fields:
    - projectId: String (UUID from create-c4-project)
    - diagramId: String (UUID from create-context-diagram)
    - name: String (Name of the external system)
    - description: String (Description of the external system)

    Optional Input Fields:
    - systemId: String (Optional UUID of the core system this external system interacts with)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - projectId: String (UUID of the project)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      projectId: z.string().describe("UUID of the project from create-c4-project"),
      diagramId: z.string().describe("UUID of the diagram from create-context-diagram"),
      name: z.string().describe("Name of the external system"),
      description: z.string().describe("Description of the external system"),
      systemId: z.string().optional().describe("Optional UUID of the core system this external system interacts with")
    },
    async ({ projectId, diagramId, name, description, systemId }, extra) => {
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

        // Add the external system element using the descriptor approach
        const externalSystem = await db.addElement(project.id, diagram.id, {
          descriptor: {
            baseType: 'system',
            variant: 'external'
          },
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
          await db.addRelationship(project.id, diagram.id, {
            sourceId: systemId,
            targetId: externalSystem.id,
            description: "Uses"
          });
        }

        // Get the updated diagram
        const updatedDiagram = await db.getDiagram(project.id, diagram.id);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after adding external system: ${diagramId}`);
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
          console.warn(`Failed to generate diagram for external system ${externalSystem.id}: ${getErrorMessage(diagramError)}`);
        }

        let baseMessage = ''
        if (systemId) {
          baseMessage = `Created new external system "${name}" that interacts with the core system.`;
        } else {
          baseMessage = `Created new external system "${name}".`;
        }
        const message = `${baseMessage}\n\nAre there any other external systems that we need to identify or should we move onto identifying other diagram elements?`;

        // Build complete metadata for the diagram
        const metadata = createDiagramMetadata(diagram, projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error adding external system: ${getErrorMessage(error)}`);
      }
    }
  );
};