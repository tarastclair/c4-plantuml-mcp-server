import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, buildEntityMappings } from "../utils.js";

/**
 * Creates a system element and updates the diagram
 */
export const addSystemTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-system",
    `Add or update a system in the C4 diagram.
    
    Required Input Fields:
    - projectId: String (UUID from create-c4-project)
    - diagramId: String (UUID from create-context-diagram)
    - name: String (Name of the system)
    - description: String (Description of what the system does)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - projectId: String (UUID of the C4 project)
    - entityIds: Object (Mappings of entity IDs by diagram)`,
    {
      projectId: z.string().describe("UUID of the project from create-c4-project"),
      diagramId: z.string().describe("UUID of the diagram from create-context-diagram"),
      name: z.string().describe("Name of the system"),
      description: z.string().describe("Description of the system")
    },
    async ({ projectId, diagramId, name, description }, extra) => {
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

        // Add the system element using the descriptor approach
        const system = await db.addElement(diagramId, {
          descriptor: {
            baseType: 'system',
            variant: 'standard'
          },
          name,
          description
        });

        // Get the updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating: ${diagramId}`);
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
          console.warn(`Failed to generate diagram for system ${system.id}: ${getErrorMessage(diagramError)}`);
        }

        const baseMessage = `Added new system "${name}" to the diagram.`;
        const message = `${baseMessage}\n\nAre there any other systems that we need to identify, or should we move onto identifying external systems?`;

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(updatedDiagram);
        
        return createToolResponse(message, {
          projectId,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error adding system: ${getErrorMessage(error)}`);
      }
    }
  );
};