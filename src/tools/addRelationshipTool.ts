import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { 
  createStandardRelationship,
  createBidirectionalRelationship,
  createUpRelationship,
  createDownRelationship,
  createLeftRelationship,
  createRightRelationship,
  createBackRelationship,
  createNeighborRelationship,
} from "./internal/relationshipHelpers.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";

/**
 * Creates a relationship between elements and updates the diagram.
 * Supports all relationship types from C4-PlantUML including directional variants.
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
    - technology: String (Technology used in the relationship)
    - direction: String (Relationship direction: standard, bidirectional, up, down, left, right, back, neighbor)
    - sprite: String (Icon/sprite for the relationship)
    - tags: String (Styling tags for the relationship)
    - link: String (URL link for the relationship)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - projectId: String (UUID of the project)
    - elementIds: Object (Mappings of element UUIDs to their names)
    
    You can continue to use the add-element and add-relationship tools to design your diagram,
    and when you're finished, you must call the generate-diagram-image tool to create
    a png image of the completed diagram.`,
    {
      projectId: z.string().describe("UUID of the project from create-c4-project"),
      diagramId: z.string().describe("UUID of the diagram from create-context-diagram"),
      sourceId: z.string().describe("ID of the source element"),
      targetId: z.string().describe("ID of the target element"),
      description: z.string().describe("Description of the relationship"),
      technology: z.string().optional().describe("Optional technology used in the relationship"),
      direction: z.enum([
        'standard', 'bidirectional', 'up', 'down', 'left', 'right', 'back', 'neighbor'
      ] as const).default('standard').describe("Direction of the relationship"),
      sprite: z.string().optional().describe("Optional sprite/icon for the relationship"),
      tags: z.string().optional().describe("Optional styling tags for the relationship"),
      link: z.string().optional().describe("Optional URL link for the relationship")
    },
    async ({ 
      projectId, 
      diagramId, 
      sourceId, 
      targetId, 
      description, 
      technology, 
      direction,
      sprite,
      tags,
      link
    }, extra) => {
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

        // Prepare relationship parameters
        const params = {
          projectId,
          diagramId,
          sourceId,
          targetId,
          description,
          technology,
          sprite,
          tags,
          link
        };

        // Call the appropriate helper function based on the direction
        let result;
        
        switch (direction) {
          case 'bidirectional':
            result = await createBidirectionalRelationship(params, db);
            break;
          case 'up':
            result = await createUpRelationship(params, db);
            break;
          case 'down':
            result = await createDownRelationship(params, db);
            break;
          case 'left':
            result = await createLeftRelationship(params, db);
            break;
          case 'right':
            result = await createRightRelationship(params, db);
            break;
          case 'back':
            result = await createBackRelationship(params, db);
            break;
          case 'neighbor':
            result = await createNeighborRelationship(params, db);
            break;
          case 'standard':
          default:
            result = await createStandardRelationship(params, db);
            break;
        }

        // Get the updated diagram
        const updatedDiagram = result.diagram;
        
        // Get source and target element names for a more descriptive message
        const sourceElement = updatedDiagram.elements.find(e => e.id === sourceId);
        const targetElement = updatedDiagram.elements.find(e => e.id === targetId);
        
        // Create a user-friendly response message
        const sourceName = sourceElement?.name || 'unknown';
        const targetName = targetElement?.name || 'unknown';
        
        // Add direction information to the message
        let directionInfo = '';
        if (direction !== 'standard') {
          directionInfo = ` (${direction})`;
        }
        
        const message = `Added relationship "${description}"${directionInfo} from "${sourceName}" to "${targetName}". Are there any other relationships to define?`;

        // Build complete metadata for the diagram
        const metadata = createDiagramMetadata(updatedDiagram, projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error adding relationship: ${getErrorMessage(error)}`);
      }
    }
  );
};