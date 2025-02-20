/**
 * Utility functions for C4 diagram MCP server
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { WorkflowStateContext } from "./workflow-state.js";

/**
 * Interface for creating standardized tool responses
 * This provides a consistent format for guided workflow state transitions
 */
export interface ToolResponse {
  // Basic response data
  diagramId: string;
  svg: string;
  
  // Workflow navigation
  nextPrompt: string;
  message: string;
  
  // Workflow state
  workflowState?: WorkflowStateContext;
  
  // Optional context data
  elementId?: string;
  elementIds?: string[];
  elementTypes?: Record<string, string>;
  [key: string]: any; // Allow additional context properties
}

/**
 * Creates a standardized tool response with workflow transition information
 * This ensures all tools return responses in a consistent format for the guided workflow
 * 
 * @param response The tool response data
 * @returns A properly formatted CallToolResult
 */
export function createToolResponse(response: ToolResponse): CallToolResult {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(response)
    }]
  };
}

/**
 * Creates an error response with standardized format
 * 
 * @param message Error message to display
 * @returns A properly formatted error CallToolResult
 */
/**
 * Safely extracts an error message from any caught error
 * Handles different error types consistently
 * 
 * @param error Any caught error object (unknown type)
 * @returns A string representation of the error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Creates an error response with standardized format
 * 
 * @param message Error message to display
 * @returns A properly formatted error CallToolResult
 */
export function createErrorResponse(message: string): CallToolResult {
  return {
    content: [{
      type: "text",
      text: message
    }],
    isError: true
  };
}
