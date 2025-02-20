/**
 * Utilities for working with PlantUML
 */
import axios from 'axios';
import { C4Diagram } from './types-and-interfaces.js';

/**
 * Encodes PlantUML diagram text for use with PlantUML server
 * Uses a specific encoding format required by the PlantUML server
 */
export const encodePlantUML = (puml: string): string => {
  return Buffer.from(puml).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
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
 * Generates an empty PlantUML diagram with just the title and description
 * Used for initializing a new diagram workspace
 * 
 * @param diagram Diagram metadata
 * @returns SVG markup as a string
 */
export const generateEmptyDiagramSVG = async (diagram: C4Diagram): Promise<string> => {
  // Create PlantUML syntax for empty diagram
  const lines = [
    '@startuml',
    '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml',
    '',
    `title ${diagram.name}`,
  ];

  if (diagram.description) {
    lines.push(`description ${diagram.description}`);
  }
  
  // Add empty layout note
  lines.push('', 'note "New C4 Context Diagram" as EmptyNote', '');
  lines.push('@enduml');
  const pumlCode = lines.join('\n');

  // Generate SVG
  return await generateSVG(pumlCode);
};

/**
 * Generates a PlantUML diagram from the current diagram state
 * 
 * @param diagram Current diagram state with elements and relationships
 * @returns SVG markup as a string
 */
export const generateDiagramSVG = async (diagram: C4Diagram): Promise<string> => {
  // Create PlantUML syntax
  const lines = [
    '@startuml',
    '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml',
    '',
    `title ${diagram.name}`,
  ];

  if (diagram.description) {
    lines.push(`description ${diagram.description}`);
  }
  lines.push('');

  // Add elements by type
  diagram.elements.forEach(element => {
    const id = element.name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
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
      const sourceId = source.name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
      const targetId = target.name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
      const techStr = rel.technology ? `, "${rel.technology}"` : '';
      
      lines.push(`Rel(${sourceId}, ${targetId}, "${rel.description}"${techStr})`);
    }
  });

  lines.push('@enduml');
  const pumlCode = lines.join('\n');

  // Generate SVG
  return await generateSVG(pumlCode);
};
