import { WorkflowStateContext } from './workflow-state.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

type ToolMetadata = {
  diagramId: string; // Must give the current diagramId
  workflowState: WorkflowStateContext; // Must give the next step to take
  [key: string]: any; // Can give additional info
};

/**
 * Create a standardized successful tool response that matches the MCP SDK's expected format
 * while preserving our custom metadata.
 * 
 * @param message User-facing message to display
 * @param metadata Additional tool-specific metadata
 * @returns SDK-compatible tool response
 */
export const createToolResponse = (message: string, metadata: ToolMetadata): CallToolResult => {
  return {
    content: [{
      type: "text",
      text: message
    }],
    // Include all our custom metadata
    ...metadata,
    // Never mark successful responses as errors
    isError: false
  };
};

/**
 * Create a standardized error response that matches the MCP SDK's expected format.
 * Also logs the error for server-side troubleshooting.
 * 
 * @param message Error message
 * @returns SDK-compatible error response
 */
export const createErrorResponse = (message: string): CallToolResult => {
  // Log error server-side
  console.error(`[Tool Error] ${message}`);
  
  return {
    content: [{
      type: "text",
      text: message
    }],
    isError: true
  };
};

/**
 * Extract a user-friendly error message from various error types
 * 
 * @param error Error object
 * @returns Formatted error message
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};