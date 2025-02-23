import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateDiagramFromState, writeDiagramToFile } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage } from "../utils.js";
import { DiagramWorkflowState, updateWorkflowState } from "../workflow-state.js";

/**
 * Implementation of add-relationship tool with nextPrompt workflow support
 * Creates a relationship between elements and updates the diagram
 */
export const registerAddRelationshipTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-relationship",
    "Add a relationship between elements in the C4 diagram",
    {
      diagramId: z.string().describe("ID of the diagram"),
      sourceId: z.string().describe("ID of the source element"),
      targetId: z.string().describe("ID of the target element"),
      description: z.string().describe("Description of the relationship"),
      technology: z.string().optional().describe("Optional technology used in the relationship")
    },
    async ({ diagramId, sourceId, targetId, description, technology }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID`);
        }

        // Validate elements exist
        const sourceExists = diagram.elements.some(e => e.id === sourceId);
        const targetExists = diagram.elements.some(e => e.id === targetId);
        if (!sourceExists || !targetExists) {
          throw new Error("Source or target element not found");
        }

        // Add relationship
        const relationship = await db.addRelationship(diagramId, {
          sourceId,
          targetId,
          description,
          technology
        });

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after adding relationship: ${diagramId}`);
        }

        // Generate and write the new diagram image
        const image = await generateDiagramFromState(updatedDiagram);
        await db.cacheDiagram(diagramId, image);
        await writeDiagramToFile(diagramId, image);

        // Update workflow state to actor discovery
        const updatedState = await updateWorkflowState(db, diagramId, DiagramWorkflowState.RELATIONSHIP_DEFINITION);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        const message = `Relationship ${relationship.id} added from ${sourceId} to ${targetId}. Are there any other relationships you'd like to define?`;

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState
        });
      } catch (error) {
        return createErrorResponse(`Error adding relationship: ${getErrorMessage(error)}`);
      }
    }
  );
};
