import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState, writeDiagramToFile } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, buildEntityMappings } from "../utils.js";

/**
 * Creates a system element and updates the diagram
 */
export const addSystemTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-system",
    `Add or update a system in the C4 diagram.
    
    Required Input Fields:
    - diagramId: String (UUID from createC4Diagram)
    - name: String (Name of the system)
    - description: String (Description of what the system does)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - diagramId: String (UUID of the diagram)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      diagramId: z.string().describe("UUID of the diagram from createC4Diagram"),
      name: z.string().describe("Name of the system"),
      description: z.string().describe("Description of the system")
    },
    async ({ diagramId, name, description }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID.`);
        }

        // Add the system element
        const system = await db.addElement(diagramId, {
          type: 'system',
          name,
          description
        });

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating relationship: ${diagramId}`);
        }

        try {
          // Generate and write the new diagram image
          const image = await generateDiagramFromState(updatedDiagram);
          await db.cacheDiagram(diagramId, image);
          await writeDiagramToFile(updatedDiagram.name, 'context', image);
        } catch (diagramError) {
          console.warn(`Failed to generate diagram for system ${system.id}: ${getErrorMessage(diagramError)}`);
        }

        const baseMessage = `Created new system (UUID: ${system.id}).`;
        const message = "Are there any other systems that we need to identify, or should we move onto identifing external systems?";

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(updatedDiagram);
        
        return createToolResponse(message, {
          diagramId,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error adding system: ${getErrorMessage(error)}`);
      }
    }
  );
};
