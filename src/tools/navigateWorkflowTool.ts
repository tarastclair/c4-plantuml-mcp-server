import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { createToolResponse, getErrorMessage, createErrorResponse, buildEntityMappings } from "../utils.js";
import { DiagramWorkflowState, updateWorkflowState } from "../workflow-state.js";

/**
 * Implementation of navigate-workflow tool
 * Allows for non-linear navigation through the workflow
 */
export const navigateWorkflowTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "navigate-workflow",
    `Navigate to a different step in the guided workflow.
    
    Required Input Fields:
    - diagramId: String (UUID from createC4Diagram)
    - targetState: String (The workflow state to navigate to)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - diagramId: String (UUID of the diagram)
    - workflowState: Object (The current state of the workflow)
    - entityIds: Object (Mappings of entity UUIDs to their names)`,
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
            message = "We should identify or modify the core system. We need to determine what its called and what it does.";
            break;
          case DiagramWorkflowState.ACTOR_DISCOVERY:
            message = "We need to identify or modify the users and actors. Who interacts with this system?";
            break;
          case DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION:
            message = "We need to identify or modify external systems. What other systems does this system interact with?";
            break;
          case DiagramWorkflowState.RELATIONSHIP_DEFINITION:
            message = "We need to define or modify relationships between elements. How do these components interact?";
            break;
          case DiagramWorkflowState.REFINEMENT:
            message = "We need to refine the diagram. Where are there opportunities for improvement?";
            break;
          case DiagramWorkflowState.COMPLETE:
            message = "The diagram is complete.";
            break;
          default:
            message = "What is the next most-logical part of the architecture that we need to identify or modify?";
            break;
        }

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(diagram);

        return createToolResponse(message, {
          diagramId,
          workflowState: updatedState,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error navigating workflow: ${getErrorMessage(error)}`);
      }
    }
  );
};
