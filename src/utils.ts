import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { C4Diagram, C4Element } from './types-and-interfaces.js';

/**
 * Maps UUIDs to element names for easy reference
 * The keys are UUIDs and the values are element names
 */
export type ElementIDMapping = {
  [key: string]: string; // E.x. { "<UUID>": "PlantUML MCP Server"}
}

/**
 * Structure for a single diagram's element mappings
 */
export type DiagramElementMapping = {
  name: string;
  type: string;
  elements: {
    [elementType: string]: ElementIDMapping;
  };
  relationships: ElementIDMapping;
}

/**
 * Tool response metadata that provides context for the client
 * Enhanced to support our project structure and diagram hierarchy
 */
export type ToolMetadata = {
  projectId: string; // ID of the current project
  diagramId?: string; // ID of the current active diagram
  // Diagram element mappings - organized by diagram
  diagrams?: { 
    [diagramId: string]: DiagramElementMapping;
  }
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
  // Create the full response with message and metadata
  let fullMessage = `${message}\n\n---\n\nResponse metadata for reference:\n\n`;
  
  // Add project ID if available
  if (metadata.projectId) {
    fullMessage += `Project ID: ${metadata.projectId}\n`;
  }
  
  // Add active diagram ID if available
  if (metadata.diagramId) {
    fullMessage += `Active Diagram ID: ${metadata.diagramId}\n`;
  }
  
  // Only add element mappings section if diagrams are provided
  let entitiesText = '';
  
  if (metadata.diagrams && Object.keys(metadata.diagrams).length > 0) {
    // For each diagram in the project
    Object.entries(metadata.diagrams).forEach(([diagramId, diagram]) => {
      // Add diagram header information
      entitiesText += `\nDiagram: ${diagram.name} (${diagramId})\n`;
      entitiesText += `Type: ${diagram.type}\n`;
      
      // Format elements by type
      Object.entries(diagram.elements).forEach(([elementType, mappings]) => {
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
      
      // Format relationships
      if (Object.keys(diagram.relationships).length > 0) {
        entitiesText += '\nRelationships:\n';
        Object.entries(diagram.relationships).forEach(([id, description]) => {
          entitiesText += `- ${description} (${id})\n`;
        });
      }
      
      // Add separator between diagrams if there are multiple
      if (metadata.diagrams && Object.keys(metadata.diagrams).length > 1) {
        entitiesText += '\n---\n';
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
 * Builds element ID mappings from a C4 diagram state
 * 
 * @param diagram The complete C4 diagram state
 * @returns Object containing mappings for the diagram's entities
 */
export const buildElementMappings = (diagram: C4Diagram): DiagramElementMapping => {
  // Initialize the result structure for a single diagram's entities
  const result: DiagramElementMapping = {
    name: diagram.name || 'Untitled Diagram',
    type: diagram.diagramType || 'Context', // Default to Context if not specified
    elements: {},
    relationships: {}
  };
  
  // Process all elements
  diagram.elements.forEach((element: C4Element) => {
    // Get the element descriptor details
    const { baseType, variant } = element.descriptor;
    
    // Create the appropriate category key as a string
    let categoryKey: string = baseType;
    if (variant === 'external') {
      categoryKey = `external${baseType.charAt(0).toUpperCase() + baseType.slice(1)}`;
    }
    
    // Initialize the category if it doesn't exist
    if (!result.elements[categoryKey]) {
      result.elements[categoryKey] = {};
    }
    
    // Add the element mapping
    result.elements[categoryKey][element.id] = element.name;
  });
  
  // Process all relationships
  diagram.relationships.forEach((relationship) => {
    result.relationships[relationship.id] = relationship.description;
  });

  return result;
};

/**
 * Creates a complete tool metadata object from a diagram and project ID
 * 
 * @param diagram The C4 diagram
 * @param projectId The project ID
 * @returns Complete tool metadata
 */
export const createDiagramMetadata = (diagram: C4Diagram, projectId: string): ToolMetadata => {
  const diagramMapping = buildElementMappings(diagram);
  
  return {
    projectId,
    diagramId: diagram.id,
    diagrams: {
      [diagram.id]: diagramMapping
    }
  };
};