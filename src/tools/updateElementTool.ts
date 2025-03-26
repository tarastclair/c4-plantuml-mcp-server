import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db/index.js";
import { generateDiagramSourceFromState } from "../plantuml-utils/index.js";
import { BaseElementType, C4Element, ElementVariant } from "../types-and-interfaces.js";
import { createToolResponse, getErrorMessage, createErrorResponse, createDiagramMetadata } from "../utils.js";

/**
 * Implementation of update-element tool for diagram refinement
 * Allows modifying existing elements
 */
export const updateElementTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "update-element",
    `Update an existing element in an existing C4 diagram. This tool should be used WHENEVER a user requests changes to existing elements rather than creating new diagrams.
    
    Required Input Fields:
    - projectId: String (UUID from create-c4-project)
    - diagramId: String (UUID from create-context-diagram)
    - elementId: String (UUID of the element to update)

    Optional Input Fields:
    - name: String (New name for the element)
    - description: String (New description for the element)
    - type: String (New type for the element, e.g., 'system', 'person', 'external-system')
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - projectId: String (UUID of the project)
    - elementIds: Object (Mappings of element UUIDs to their names)`,
    {
      projectId: z.string().describe("UUID of the project from create-c4-project"),
      diagramId: z.string().describe("UUID of the diagram from create-context-diagram"),
      elementId: z.string().describe("UUID of the element to update"),
      name: z.string().optional().describe("New name for the element"),
      description: z.string().optional().describe("New description for the element"),
      type: z.enum(['system', 'person', 'external-system']).optional().describe("New type for the element")
    },
    async ({ projectId, diagramId, elementId, name, description, type }, extra) => {
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

        // Find the element to update
        const element = diagram.elements.find(e => e.id === elementId);
        if (!element) {
          throw new Error(`Element not found: ${elementId}`);
        }

        // Collect updates
        const updates: Partial<C4Element> = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        
        // If type is provided, update the descriptor
        if (type !== undefined) {
          // Map input type to baseType and variant
          let baseType: BaseElementType;
          let variant: ElementVariant = 'standard';
          
          // Handle special types with appropriate mapping
          if (type === 'external-system') {
            baseType = 'system';
            variant = 'external';
          } else if (type === 'person') {
            baseType = 'person';
          } else if (type === 'system') {
            baseType = 'system';
          } else {
            // This shouldn't happen due to zod enum validation, but TypeScript doesn't know that
            throw new Error(`Invalid element type: ${type}`);
          }
          
          // Update the descriptor
          updates.descriptor = {
            baseType,
            variant
          };
        }

        // Perform update
        await db.updateElement(project.id, diagram.id, elementId, updates);

        // Get the updated diagram
        const updatedDiagram = await db.getDiagram(project.id, diagram.id);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating element: ${diagramId}`);
        }

        try {
          // Generate the diagram, save files, and get the PNG data in one step
          const pngData = await generateDiagramSourceFromState(
            db,
            updatedDiagram,
            updatedDiagram.pumlPath
          );
        } catch (diagramError) {
          console.warn(`Failed to generate diagram after updating element ${elementId}: ${getErrorMessage(diagramError)}`);
        }

        // Find the element name for a more descriptive message
        const updatedElement = updatedDiagram.elements.find(e => e.id === elementId);
        const elementName = updatedElement?.name || element.name;
        
        const message = `Element "${elementName}" updated successfully. Should we make any other refinements?`;

        // Build complete metadata for the diagram
        const metadata = createDiagramMetadata(diagram, projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error updating element: ${getErrorMessage(error)}`);
      }
    }
  );
};