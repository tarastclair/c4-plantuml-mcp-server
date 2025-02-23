import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { createToolResponse, getErrorMessage, createErrorResponse } from "../utils.js";
import { DiagramWorkflowState, updateWorkflowState } from "../workflow-state.js";

/**
 * Implementation of navigate-workflow tool
 * Allows for non-linear navigation through the workflow
 */
export const registerNavigateWorkflowTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "navigate-workflow",
    "Navigate to a different step in the guided workflow",
    {
      diagramId: z.string().describe("ID of the diagram"),
      targetState: z.enum([
        DiagramWorkflowState.INITIAL,
        DiagramWorkflowState.SYSTEM_IDENTIFICATION,
        DiagramWorkflowState.ACTOR_DISCOVERY,
        DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION,
        DiagramWorkflowState.RELATIONSHIP_DEFINITION,
        DiagramWorkflowState.REFINEMENT,
        DiagramWorkflowState.COMPLETE
      ]).describe("The workflow state to navigate to")
    },
    async ({ diagramId, targetState }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID.`);
        }

        // Update workflow state
        const updatedState = await updateWorkflowState(db, diagramId, targetState);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        // Prepare appropriate message based on the target state
        let message = "";
        switch (targetState) {
          case DiagramWorkflowState.SYSTEM_IDENTIFICATION:
            message = "Let's identify or modify the core system. What is it called, and what does it do?";
            break;
          case DiagramWorkflowState.ACTOR_DISCOVERY:
            message = "Let's identify or modify the users or actors. Who interacts with this system?";
            break;
          case DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION:
            message = "Let's identify or modify external systems. What other systems does this system interact with?";
            break;
          case DiagramWorkflowState.RELATIONSHIP_DEFINITION:
            message = "Let's define or modify relationships between elements. How do these components interact?";
            break;
          case DiagramWorkflowState.REFINEMENT:
            message = "Let's refine the diagram. What would you like to improve?";
            break;
          case DiagramWorkflowState.COMPLETE:
            message = "The diagram is complete. You can export it or continue making refinements.";
            break;
          default:
            message = "What would you like to work on next?";
            break;
        }

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState
        });
      } catch (error) {
        return createErrorResponse(`Error navigating workflow: ${getErrorMessage(error)}`);
      }
    }
  );
};
