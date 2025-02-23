import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateEmptyDiagram } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage } from "../utils.js";
import { DiagramWorkflowState, updateWorkflowState } from "../workflow-state.js";

/**
 * Primary entry point tool for guided C4 diagram creation
 * This tool creates a new diagram and kicks off the guided workflow
 */
// TODO: Expand scope beyond just Context (C1) diagrams to C2-C4 as well
export const registerCreateC4DiagramTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "createC4Diagram",
    `Create a new C4 Context diagram and starts the guided modeling process.
    
    Required Input Fields:
    - title: String (The name of your system/diagram)
    - description: String (optional, A brief explanation of what the diagram represents)
    
    Input example:
    {
      "title": "E-commerce Platform",
      "description": "Core system architecture for our online store"
    }
      
    The response will include a unique ID for the diagram that you'll need for all subsequent operations.
    
    Response Fields:
    - diagramId: String (UUID of the diagram that was just created; Example: "b7a405e2-4353-4c67-ba6d-143eaf35e538")
    - svg: String (Base64-encoded SVG of the diagram)
    - nextPrompt: String (You should proceed to this next step now)
    - workflowState: Object (The current state of the workflow)`,
    {
      title: z.string().describe("Title for the new diagram"),
      description: z.string().optional().describe("Optional description of what the diagram represents")
    },
    async ({ title, description }, extra) => {
      try {
        // Create a new blank diagram
        const diagram = await db.createDiagram(title, description);

        // Generate initial empty diagram
        const svg = await generateEmptyDiagram(diagram);
        await db.cacheDiagram(diagram.id, svg);

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

        const message = `Created new diagram (ID: ${diagram.id}). Let's start by identifying the core system. What is it called, and what does it do?`;

        return createToolResponse(message, {
          diagramId: diagram.id,
          workflowState: updatedState
        });
      } catch (error) {
        return createErrorResponse(`Error creating diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};
