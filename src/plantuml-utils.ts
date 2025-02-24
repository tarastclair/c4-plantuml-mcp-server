/**
 * Utilities for working with PlantUML
 * Generates C4 architectural diagrams in PNG format
 */
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { getAppRoot } from './initialize.js';
import { C4Diagram } from './types-and-interfaces.js';
import { encode as encodePlantUMLWithDeflate } from 'plantuml-encoder';

/**
 * Encodes PlantUML diagram text for use with PlantUML server
 * Uses DEFLATE compression as required by PlantUML server
 * @param puml Raw PlantUML diagram text
 * @returns Encoded string safe for URLs
 */
export const encodePlantUML = (puml: string): string => {
  return encodePlantUMLWithDeflate(puml);
};

/**
 * Sleep function for retry mechanism
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generates a PNG diagram from PlantUML markup by calling the public PlantUML server
 * Implements retry logic with exponential backoff for intermittent server issues
 * 
 * @param puml PlantUML markup to render
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @param initialDelay Initial delay in ms between retries (default: 500ms)
 * @returns PNG data as a base64 string
 */
export const generateDiagram = async (
  puml: string,
  maxRetries = 3,
  initialDelay = 500
): Promise<string> => {
  const encoded = encodePlantUML(puml);
  let lastError: Error | null = null;
  
  // Try multiple times with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If this isn't the first attempt, log that we're retrying
      if (attempt > 0) {
        // console.log(`Retrying PlantUML diagram generation (attempt ${attempt} of ${maxRetries})`);
      }
      
      const response = await axios.get(`https://www.plantuml.com/plantuml/png/${encoded}`, {
        responseType: 'arraybuffer',
        timeout: 10000 // 10 second timeout to avoid hanging
      });
      
      return Buffer.from(response.data).toString('base64');
    } catch (error: any) {
      lastError = error;
      
      // Log detailed error information
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText || '';
        console.error(`PlantUML Server Error (attempt ${attempt + 1}/${maxRetries + 1}):`);
        console.error(`Status: ${status} ${statusText}`);
        
        // Only worth retrying certain types of errors
        const shouldRetry = !status || // network error
          status === 408 || // request timeout
          status === 429 || // too many requests
          status === 500 || // server error
          status === 502 || // bad gateway
          status === 503 || // service unavailable
          status === 504;   // gateway timeout
        
        if (!shouldRetry || attempt >= maxRetries) {
          // Don't retry client errors or if we've used all our retries
          const errorMessage = `PlantUML server error: HTTP ${status} ${statusText}`;
          throw new Error(errorMessage);
        }
      } else {
        console.error(`PlantUML generation error (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        
        if (attempt >= maxRetries) {
          // We've used all our retries
          throw new Error(`Failed to generate diagram: ${error.message}`);
        }
      }
      
      // Calculate backoff delay with jitter to avoid thundering herd
      const delay = initialDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
      // console.log(`Waiting ${Math.round(delay)}ms before retry...`);
      await sleep(delay);
    }
  }
  
  // This should never happen due to the error handling above, but TypeScript wants it
  throw lastError || new Error('Failed to generate diagram after retries');
};

/**
 * Generates a PlantUML diagram from the current diagram state
 * @param diagram Current diagram state with elements and relationships
 * @returns PNG diagram as a Buffer
 */
export const generateDiagramFromState = async (diagram: C4Diagram): Promise<string> => {
  const lines: string[] = [];
  
  // Header
  lines.push('@startuml');
  lines.push('!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml');
  lines.push('');
  
  // Title and description as a note
  lines.push(`title ${diagram.name}`);
  if (diagram.description) {
    lines.push('');
    lines.push(`note as DiagramDescription`);
    lines.push(diagram.description);
    lines.push('end note');
  }
  lines.push('');

  // Add elements by type
  diagram.elements.forEach(element => {
    const id = element.id.replace(/[^\w]/g, '_');
    const name = element.name;
    const description = element.description;
    
    switch (element.type) {
      case 'system':
        lines.push(`System(${id}, "${name}", "${description}")`);
        break;
      case 'person':
        lines.push(`Person(${id}, "${name}", "${description}")`);
        break;
      case 'external-system':
        lines.push(`System_Ext(${id}, "${name}", "${description}")`);
        break;
    }
  });
  lines.push('');

  // Track processed relationships to prevent duplicates
  const processedRels = new Set<string>();

  // Add relationships, ensuring no duplicates
  diagram.relationships.forEach(rel => {
    const source = diagram.elements.find(e => e.id === rel.sourceId);
    const target = diagram.elements.find(e => e.id === rel.targetId);
    
    if (source && target) {
      const sourceId = source.id.replace(/[^\w]/g, '_');
      const targetId = target.id.replace(/[^\w]/g, '_');
      const techStr = rel.technology ? `, "${rel.technology}"` : '';
      
      // Create a unique key for this relationship
      const relKey = `${sourceId}-${targetId}-${rel.description}`;
      
      // Only add if we haven't seen this relationship before
      if (!processedRels.has(relKey)) {
        processedRels.add(relKey);
        lines.push(`Rel(${sourceId}, ${targetId}, "${rel.description}"${techStr})`);
      }
    }
  });
  lines.push('');

  // Footer
  lines.push('@enduml');

  // Generate PNG
  return await generateDiagram(lines.join('\n'));
};

/**
 * Generates an empty PlantUML diagram with just the title and description
 * Used for initializing a new diagram workspace
 * 
 * @param diagram Diagram metadata
 * @returns PNG diagram as a Buffer
 */
export const generateEmptyDiagram = async (diagram: C4Diagram): Promise<string> => {
  const lines: string[] = [];
  
  // Header
  lines.push('@startuml');
  lines.push('!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml');
  lines.push('HIDE_STEREOTYPE()');
  lines.push('');
  
  // Title and empty diagram note
  lines.push(`title ${diagram.name}`);
  if (diagram.description) {
    lines.push('');
    lines.push(`note as DiagramDescription`);
    lines.push(diagram.description);
    lines.push('end note');
  }
  lines.push('');
  
  // Footer
  lines.push('@enduml');

  // Generate PNG
  return await generateDiagram(lines.join('\n'));
};

/**
 * File output information for saved diagrams
 */
export interface DiagramFileOutput {
  absolutePath: string;
  relativePath: string;
  filename: string;
}

/**
 * Writes diagram PNG output to the filesystem with a human-readable filename
 * 
 * @param diagramId ID of the diagram for database reference
 * @param diagramName Human-readable name of the diagram
 * @param diagramType Type of the diagram (e.g., 'context', 'container', 'component')
 * @param base64Data Base64-encoded PNG data
 * @returns File output information
 */
export const writeDiagramToFile = async (
  diagramName: string,
  diagramType: string = 'context',
  base64Data: string
): Promise<DiagramFileOutput> => {
  try {
    // Use output directory at app root
    const outputDir = path.join(getAppRoot(), 'diagrams');
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Create a filename-safe version of the diagram name
    const safeFileName = diagramName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace any non-alphanumeric chars with hyphens
      .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
      .substring(0, 50);             // Limit length to avoid super long filenames
    
    // Format: diagram-name-diagram-type.png
    const filename = `${safeFileName}-${diagramType}-diagram.png`;
    const filepath = path.join(outputDir, filename);
    
    // Convert base64 back to binary and write PNG file
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filepath, buffer);
    
    // Return path info for maximum flexibility
    return {
      absolutePath: filepath,
      relativePath: path.relative(getAppRoot(), filepath),
      filename
    };
  } catch (error) {
    console.error('Error writing diagram file:', error);
    throw error;
  }
};