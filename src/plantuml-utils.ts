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
 * Generates a PNG diagram from PlantUML markup by calling the public PlantUML server
 * 
 * @param puml PlantUML markup to render
 * @returns PNG data as a Buffer
 */
export const generateDiagram = async (puml: string): Promise<string> => {
  const encoded = encodePlantUML(puml);
  
  try {
    const response = await axios.get(`https://www.plantuml.com/plantuml/png/${encoded}`, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data).toString('base64');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('PlantUML Server Error:');
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
    throw error;
  }
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
  timestamp: string;
}

/**
 * Writes diagram PNG output to the filesystem
 * Uses a consistent directory structure and naming convention
 */
export const writeDiagramToFile = async (diagramId: string, base64Data: string): Promise<DiagramFileOutput> => {
  try {
    // Use output directory at app root
    const outputDir = path.join(getAppRoot(), 'diagrams');
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Create filename using diagram ID and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${diagramId}-${timestamp}.png`;
    const filepath = path.join(outputDir, filename);
    
    // Convert base64 back to binary and write PNG file
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filepath, buffer);
    
    // Return path info for maximum flexibility
    return {
      absolutePath: filepath,
      relativePath: path.relative(getAppRoot(), filepath),
      timestamp
    };
  } catch (error) {
    console.error('Error writing diagram file:', error);
    throw error;
  }
};