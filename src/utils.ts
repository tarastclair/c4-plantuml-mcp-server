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
 * Enhanced to support our project structure and diagram hierarchy
 */
export type ToolMetadata = {
  projectId: string; // ID of the current project
  // Diagram entity mappings - we'll make this more flexible for different diagram types
  entityIds?: { 
    [diagramId: string]: { // Using diagram IDs as keys to support hierarchy
      // Generic elements collection to handle all diagram types
      elements: {
        [elementType: string]: EntityIDMapping; // Type-specific mappings
      };
      relationships: EntityIDMapping;
    }
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
  let fullMessage = `${message}\n\n---\n\nResponse metadata for reference:\n\n`;
  
  // Add project ID if available
  if (metadata.projectId) {
    fullMessage += `Project ID: ${metadata.projectId}\n`;
  }
  
  // Only add entity mappings section if they're provided
  let entitiesText = '';
  
  if (metadata.entityIds) {
    // For each diagram in the hierarchy
    Object.entries(metadata.entityIds).forEach(([diagramId, diagramEntities]) => {
      // If multiple diagrams, include the diagram ID
      if (Object.keys(metadata.entityIds || {}).length > 1) {
        entitiesText += `\nDiagram: ${diagramId}\n`;
      }
      
      // Format elements by type
      if (diagramEntities.elements) {
        Object.entries(diagramEntities.elements).forEach(([elementType, mappings]) => {
          if (Object.keys(mappings).length > 0) {
            // Format element type name for display (capitalize, handle special cases)
            const displayType = elementType
              .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
              .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
              
            entitiesText += `\n${displayType}:\n`;
            Object.entries(mappings).forEach(([id, name]) => {
              entitiesText += `- ${name} (${id})\n`;
            });
          }
        });
      }
      
      // Format relationships
      if (diagramEntities.relationships && Object.keys(diagramEntities.relationships).length > 0) {
        entitiesText += '\nRelationships:\n';
        Object.entries(diagramEntities.relationships).forEach(([id, description]) => {
          entitiesText += `- ${description} (${id})\n`;
        });
      }
    });
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
 * Enhanced to support all element types based on diagram type
 * 
 * @param diagram The complete C4 diagram state
 * @returns Object containing hierarchical mappings for all entity types
 */
export const buildEntityMappings = (diagram: C4Diagram): ToolMetadata['entityIds'] => {
  // Initialize result structure
  const result: NonNullable<ToolMetadata['entityIds']> = {
    [diagram.id]: {
      elements: {},
      relationships: {}
    }
  };
  
  // Initialize element type collections based on diagram type
  const elements = result[diagram.id].elements;
  
  // Process all elements
  diagram.elements.forEach((element: C4Element) => {
    // Get the element descriptor details
    const { baseType, variant } = element.descriptor;
    
    // Create the appropriate category key as a string
    // This way we avoid TypeScript trying to enforce BaseElementType constraints
    let categoryKey: string = baseType;
    if (variant === 'external') {
      // Construct a string that won't try to be treated as a BaseElementType
      categoryKey = `external${baseType.charAt(0).toUpperCase() + baseType.slice(1)}`;
    }
    
    // Initialize the category if it doesn't exist
    if (!elements[categoryKey]) {
      elements[categoryKey] = {};
    }
    
    // Add the element mapping
    elements[categoryKey][element.id] = element.name;
  });
  
  // Process all relationships
  diagram.relationships.forEach((relationship) => {
    result[diagram.id].relationships[relationship.id] = relationship.description;
  });

  return result;
};