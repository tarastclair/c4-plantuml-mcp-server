import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateEmptyDiagram } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, buildEntityMappings } from "../utils.js";
import { DiagramWorkflowState, updateWorkflowState } from "../workflow-state.js";

/**
 * Primary entry point tool for guided C4 diagram creation
 * This tool creates a new diagram and kicks off the guided workflow
 */
// TODO: Expand scope beyond just Context (C1) diagrams to C2-C4 as well
export const registerCreateC4DiagramTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "createC4Diagram",
    `Create a new C4 Context diagram and start the guided modeling process.
    
    Required Input Fields:
    - title: String (The name of your system/diagram)

    Optional Input Fields:
    - description: String (A brief explanation of what the diagram represents)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - diagramId: String (UUID of the diagram)
    - workflowState: Object (The current state of the workflow)
    - entityIds: Object (Mappings of entity IDs to their types)`,
    {
      title: z.string().describe("Title for the new diagram"),
      description: z.string().optional().describe("Optional description of what the diagram represents")
    },
    async ({ title, description }, extra) => {
      try {
        // Create a new blank diagram
        const diagram = await db.createDiagram(title, description);

        try {
          // Generate initial empty diagram
          const svg = await generateEmptyDiagram(diagram);
          await db.cacheDiagram(diagram.id, svg);
        } catch (diagramError) {
          console.warn(`Failed to generate initial diagram, but continuing with workflow: ${getErrorMessage(diagramError)}`);
          // We'll continue without the diagram - the workflow is more important than the visualization
        }

        // Get initial workflow state (created during diagram creation)
        const initialState = await db.getWorkflowState(diagram.id);
        if (!initialState) {
          throw new Error(`Failed to initialize workflow state for diagram: ${diagram.id}`);
        }

        // Update workflow state to actor discovery
        const updatedState = await updateWorkflowState(db, diagram.id, DiagramWorkflowState.SYSTEM_IDENTIFICATION);
        if (!updatedState) {
          throw new Error(`No workflow state found for diagram: ${diagram.id}`);
        }

        const message = `Created new diagram (UUID: ${diagram.id}). We need to start by identifying the core system. What is it called, and what does it do?`;

        // For a new diagram, the entity mappings will be empty, but we'll include them
        // to maintain a consistent response structure
        const entityMappings = buildEntityMappings(diagram);

        return createToolResponse(message, {
          diagramId: diagram.id,
          workflowState: updatedState,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error creating diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};
