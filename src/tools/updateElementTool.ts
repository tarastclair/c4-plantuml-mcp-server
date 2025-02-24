import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState, writeDiagramToFile } from "../plantuml-utils.js";
import { C4Element, ElementType } from "../types-and-interfaces.js";
import { createToolResponse, getErrorMessage, createErrorResponse, buildEntityMappings } from "../utils.js";
import { updateWorkflowState, DiagramWorkflowState } from "../workflow-state.js";

/**
 * Implementation of update-element tool for diagram refinement
 * Allows modifying existing elements
 */
export const updateElementTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "update-element",
    `Update an existing element in the C4 diagram.
    
    Required Input Fields:
    - diagramId: String (UUID from createC4Diagram)
    - elementId: String (UUID of the element to update)

    Optional Input Fields:
    - name: String (New name for the element)
    - description: String (New description for the element)
    - type: String (New type for the element, e.g., 'system', 'person', 'external-system')
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - diagramId: String (UUID of the diagram)
    - workflowState: Object (The current state of the workflow)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
    {
      diagramId: z.string().describe("UUID of the diagram"),
      elementId: z.string().describe("UUID of the element to update"),
      name: z.string().optional().describe("New name for the element"),
      description: z.string().optional().describe("New description for the element"),
      type: z.enum(['system', 'person', 'external-system']).optional().describe("New type for the element")
    },
    async ({ diagramId, elementId, name, description, type }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
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
        if (type !== undefined) updates.type = type as ElementType;

        // Perform update
        await db.updateElement(diagramId, elementId, updates);

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating element: ${diagramId}`);
        }

        try {
          const image = await generateDiagramFromState(updatedDiagram);
          await db.cacheDiagram(diagramId, image);
          await writeDiagramToFile(updatedDiagram.name, 'context', image);
        } catch (diagramError) {
          console.warn(`Failed to generate diagram after updating element ${elementId}, but continuing with workflow: ${getErrorMessage(diagramError)}`);
          // We'll continue without the diagram - the workflow is more important than the visualization
        }

        // Update workflow state - stay in refinement state
        const updatedState = await updateWorkflowState(db, diagramId, DiagramWorkflowState.REFINEMENT);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        const message = `Element "${element.id}" updated successfully. Should we make any other refinements?`;

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(updatedDiagram);

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error updating element: ${getErrorMessage(error)}`);
      }
    }
  );
};
