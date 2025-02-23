/**
 * Utilities for working with PlantUML
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
 * Generates an SVG from PlantUML markup by calling the public PlantUML server
 * 
 * @param puml PlantUML markup to render
 * @returns SVG markup as a string
 */
export const generateSVG = async (puml: string): Promise<string> => {
  const encoded = encodePlantUML(puml);
  const response = await axios.get(`https://www.plantuml.com/plantuml/svg/${encoded}`, {
    responseType: 'text'
  });
  return response.data;
};

/**
 * Generates a PlantUML diagram from the current diagram state
 * 
 * @param diagram Current diagram state with elements and relationships
 * @returns SVG markup as a string
 */
export const generateDiagramSVG = async (diagram: C4Diagram): Promise<string> => {
  // Build diagram lines one at a time for reliability
  const lines: string[] = [];
  
  // Header
  lines.push('@startuml');
  lines.push('!includeurl https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml');
  lines.push('');

  // Basic diagram settings
  lines.push('');
  lines.push('');
  lines.push('');
  
  // Title and description
  lines.push(`title ${diagram.name}`);
  if (diagram.description) {
    lines.push(`description ${diagram.description}`);
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

  // Add relationships
  diagram.relationships.forEach(rel => {
    const source = diagram.elements.find(e => e.id === rel.sourceId);
    const target = diagram.elements.find(e => e.id === rel.targetId);
    
    if (source && target) {
      const sourceId = source.id.replace(/[^\w]/g, '_');
      const targetId = target.id.replace(/[^\w]/g, '_');
      const techStr = rel.technology ? `, "${rel.technology}"` : '';
      
      lines.push(`Rel(${sourceId}, ${targetId}, "${rel.description}"${techStr})`);
    }
  });
  lines.push('');

  // Footer
  lines.push('@enduml');

  // Generate SVG
  return await generateSVG(lines.join('\n'));
};

/**
 * Generates an empty PlantUML diagram with just the title and description
 * Used for initializing a new diagram workspace
 * 
 * @param diagram Diagram metadata
 * @returns SVG markup as a string
 */
export const generateEmptyDiagramSVG = async (diagram: C4Diagram): Promise<string> => {
  const lines: string[] = [];
  
  // Header
  lines.push('@startuml');
  lines.push('!includeurl https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml');
  lines.push('');

  // Basic diagram settings
  lines.push('LAYOUT_TOP_DOWN()');
  lines.push('HIDE_STEREOTYPE()');
  lines.push('');
  
  // Title and description
  lines.push(`title ${diagram.name}`);
  if (diagram.description) {
    lines.push(`description ${diagram.description}`);
  }
  lines.push('');
  
  // Empty diagram note
  lines.push('note "New C4 Context Diagram\\nClick the hammer icon to start adding elements!" as EmptyNote');
  lines.push('');
  
  // Footer
  lines.push('@enduml');

  // Generate SVG
  return await generateSVG(lines.join('\n'));
};

/**
 * Writes SVG output to the filesystem
 * Uses a consistent directory structure and naming convention
 */
export interface SvgFileOutput {
    absolutePath: string;
    relativePath: string;
    timestamp: string;
}

export const writeSvgToFile = async (diagramId: string, svg: string): Promise<SvgFileOutput> => {
    try {
        // Use output directory at app root
        const outputDir = path.join(getAppRoot(), 'output', 'svg');
        
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });
        
        // Create SVG filename using diagram ID and timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${diagramId}-${timestamp}.svg`;
        const filepath = path.join(outputDir, filename);
        
        // Write SVG file
        await fs.writeFile(filepath, svg, 'utf8');
        
        // Return both absolute and relative paths for maximum flexibility
        return {
            absolutePath: filepath,
            relativePath: path.relative(getAppRoot(), filepath),
            timestamp
        };
    } catch (error) {
        console.error('Error writing SVG file:', error);
        throw error;
    }
};