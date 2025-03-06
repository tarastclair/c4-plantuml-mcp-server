import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { C4Diagram, C4Element } from './types-and-interfaces.js';

/**
 * Maps UUIDs to entity names for easy reference
 * The keys are UUIDs and the values are entity names
 */
export type EntityIDMapping = {
  [key: string]: string; // E.x. { "<UUID>": "PlantUML MCP Server"}
}

/**
 * Tool response metadata that provides context for the client
 * Includes diagram ID, and entity ID mappings
 */
export type ToolMetadata = {
  diagramId: string; // Must give the current diagramId
  entityIds?: { // Must give the IDs of all entities in the diagram
    systems: EntityIDMapping;
    persons: EntityIDMapping;
    externalSystems: EntityIDMapping;
    relationships: EntityIDMapping;
  }
};

/**
 * Create a standardized successful tool response that matches the MCP SDK's expected format
 * while preserving our custom metadata.
 * 
 * The response includes both a user-friendly message and metadata in a structured format
 * that can be parsed by Claude and other LLMs for better entity tracking.
 * 
 * @param message User-facing message to display
 * @param metadata Additional tool-specific metadata
 * @returns SDK-compatible tool response
 */
export const createToolResponse = (message: string, metadata: ToolMetadata): CallToolResult => {
  // Create the full response with message and metadata
  // The format is designed to be both human-readable and machine-parsable
  const fullMessage = `${message}\n\n---\n\nResponse metadata for reference:\n\nDiagram ID: ${metadata.diagramId}`;
  
  // Only add entity mappings section if they're provided
  let entitiesText = '';
  if (metadata.entityIds) {
    // Format systems
    if (Object.keys(metadata.entityIds.systems).length > 0) {
      entitiesText += '\n\nSystems:\n';
      Object.entries(metadata.entityIds.systems).forEach(([id, name]) => {
        entitiesText += `- ${name} (${id})\n`;
      });
    }
    
    // Format persons
    if (Object.keys(metadata.entityIds.persons).length > 0) {
      entitiesText += '\nPersons:\n';
      Object.entries(metadata.entityIds.persons).forEach(([id, name]) => {
        entitiesText += `- ${name} (${id})\n`;
      });
    }
    
    // Format external systems
    if (Object.keys(metadata.entityIds.externalSystems).length > 0) {
      entitiesText += '\nExternal Systems:\n';
      Object.entries(metadata.entityIds.externalSystems).forEach(([id, name]) => {
        entitiesText += `- ${name} (${id})\n`;
      });
    }
    
    // Format relationships
    if (Object.keys(metadata.entityIds.relationships).length > 0) {
      entitiesText += '\nRelationships:\n';
      Object.entries(metadata.entityIds.relationships).forEach(([id, description]) => {
        entitiesText += `- ${description} (${id})\n`;
      });
    }
  }
  
  return {
    content: [{
      type: "text",
      text: fullMessage + entitiesText
    }],
    // Include all our custom metadata for client applications that can access it
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

/**
 * Builds entity ID mappings from a C4 diagram state
 * This creates a lookup dictionary of all UUIDs to their friendly names
 * Used to help clients display and reference entities correctly
 * 
 * @param diagram The complete C4 diagram state
 * @returns Object containing mappings for all entity types
 */
export const buildEntityMappings = (diagram: C4Diagram): ToolMetadata['entityIds'] => {
  // Build element type mappings
  const systems: EntityIDMapping = {};
  const persons: EntityIDMapping = {};
  const externalSystems: EntityIDMapping = {};
  const relationships: EntityIDMapping = {};

  // Process all elements based on their type
  diagram.elements.forEach((element: C4Element) => {
    const mapping = { [element.id]: element.name };
    
    switch (element.type) {
      case 'system':
        Object.assign(systems, mapping);
        break;
      case 'person':
        Object.assign(persons, mapping);
        break;
      case 'external-system':
        Object.assign(externalSystems, mapping);
        break;
    }
  });
  
  // Process all relationships
  diagram.relationships.forEach((relationship) => {
    relationships[relationship.id] = relationship.description;
  });

  return {
    systems,
    persons,
    externalSystems,
    relationships
  };
};
