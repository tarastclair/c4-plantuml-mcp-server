import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState, writeDiagramToFile } from "../plantuml-utils.js";
import { C4Element, ElementType } from "../types-and-interfaces.js";
import { createToolResponse, getErrorMessage, createErrorResponse } from "../utils.js";
import { updateWorkflowState, DiagramWorkflowState } from "../workflow-state.js";

/**
 * Implementation of update-element tool for diagram refinement
 * Allows modifying existing elements
 */
export const registerUpdateElementTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "update-element",
    "Update an existing element in the C4 diagram",
    {
      diagramId: z.string().describe("ID of the diagram"),
      elementId: z.string().describe("ID of the element to update"),
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

        const image = await generateDiagramFromState(updatedDiagram);
        await db.cacheDiagram(diagramId, image);
        await writeDiagramToFile(diagramId, image);

        // Update workflow state - stay in refinement state
        const updatedState = await updateWorkflowState(db, diagramId, DiagramWorkflowState.REFINEMENT);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        const message = `Element "${element.id}" updated successfully. Would you like to make any other refinements?`;

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState
        });
      } catch (error) {
        return createErrorResponse(`Error updating element: ${getErrorMessage(error)}`);
      }
    }
  );
};
