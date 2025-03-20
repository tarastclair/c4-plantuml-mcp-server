/**
 * Utilities for working with PlantUML
 * Generates C4 architectural diagrams in PNG format
 */
import axios from 'axios';
import { C4Diagram, DiagramType, C4Element } from './types-and-interfaces.js';
import { encode as encodePlantUMLWithDeflate } from 'plantuml-encoder';
import { savePumlFile, savePngFile } from './filesystem-utils.js';

/**
 * Gets the appropriate PlantUML include statement based on diagram type
 * Different diagram types require different library includes
 * 
 * @param diagramType Type of C4 diagram
 * @returns PlantUML include statement
 */
export function getPlantUMLImport(diagramType: DiagramType): string {
  switch (diagramType) {
    case DiagramType.CONTEXT:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml';
    case DiagramType.CONTAINER:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml';
    case DiagramType.COMPONENT:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml';
    case DiagramType.CODE:
      // For code diagrams, we still use the component library
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml';
    default:
      // Default to context diagram
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml';
  }
}

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
 * Implements robust retry logic with exponential backoff for intermittent server issues
 * 
 * @param puml PlantUML markup to render
 * @param pngPath Path where PNG file should be saved
 * @param maxRetries Maximum number of retry attempts (default: 5)
 * @param initialDelay Initial delay in ms between retries (default: 1s)
 * @returns PNG data as a base64 string
 */
export const generateAndSaveDiagramImage = async (
  puml: string,
  pngPath: string,
  maxRetries = 5,
  initialDelay = 1000
): Promise<string> => {
  // Encode the PlantUML for the URL
  const encoded = encodePlantUML(puml);
  let lastError: Error | null = null;
  
  // Try multiple times with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If this isn't the first attempt, log that we're retrying
      if (attempt > 0) {
        console.error(`Retrying PlantUML diagram generation (attempt ${attempt + 1} of ${maxRetries + 1})`);
      }
      
      // Make the request to the public PlantUML server
      const response = await axios.get(`https://www.plantuml.com/plantuml/png/${encoded}`, {
        responseType: 'arraybuffer',
        timeout: 15000 // 15 second timeout to avoid hanging on slow responses
      });

      // Convert the binary response to base64
      const pngData = Buffer.from(response.data).toString('base64');

      // Save the PNG file using our utility
      await savePngFile(pngPath, pngData);
      
      return pngData;
    } catch (error: any) {
      lastError = error;
      
      // Prepare a descriptive error message
      let errorMessage = '';
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText || '';
        
        errorMessage = `PlantUML Server Error (attempt ${attempt + 1}/${maxRetries + 1}): HTTP ${status} ${statusText}`;
        
        // We'll retry ALL errors since 400s and 509s are often temporary with the public server
        // Only skip retrying on client errors that won't change with retries
        const permanentClientError = status === 401 
          || status === 403;
        
        // If this is our last attempt OR it's a permanent client error, throw
        if (attempt >= maxRetries || permanentClientError) {
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
      } else {
        // For non-Axios errors (network issues, etc.)
        errorMessage = `PlantUML generation error (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`;
        
        // If this is our last attempt, throw
        if (attempt >= maxRetries) {
          console.error(errorMessage);
          throw new Error(`Failed to generate diagram: ${error.message}`);
        }
      }
      
      // Log the error but continue with retry
      console.error(errorMessage);
      
      // Calculate backoff delay with jitter to avoid thundering herd
      const delay = initialDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
      console.error(`Waiting ${Math.round(delay)}ms before retry...`);
      await sleep(delay);
    }
  }
  
  // This should never happen due to the error handling above, but TypeScript wants it
  throw lastError || new Error('Failed to generate diagram after retries');
};

/**
 * Gets the PlantUML macro name for a specific element
 * Based on its base type and variant (e.g., System, Person, ContainerDb, etc.)
 * 
 * @param element Element to get macro for
 * @returns PlantUML macro name
 */
export function getElementMacro(element: {
  descriptor: { baseType: string; variant?: string; boundaryType?: string }
}): string {
  const { baseType, variant, boundaryType } = element.descriptor;
  
  // Handle boundary elements
  if (variant === 'boundary') {
    if (boundaryType === 'system') {
      return 'System_Boundary';
    } else if (boundaryType === 'container') {
      return 'Container_Boundary';
    } else {
      return 'Boundary'; // Default boundary
    }
  }
  
  // Start with the base element type (capitalized)
  let macro = baseType.charAt(0).toUpperCase() + baseType.slice(1);
  
  // Add variant suffixes
  if (variant === 'db') {
    macro += 'Db';
  } else if (variant === 'queue') {
    macro += 'Queue';
  }
  
  // Add external suffix if needed
  if (variant === 'external') {
    macro += '_Ext';
  }
  
  return macro;
}

/**
 * Generate PlantUML source for a diagram
 * Separated from diagram generation to support both 
 * generating PNG and writing PUML files
 * 
 * @param diagram Current diagram state with elements and relationships
 * @returns PlantUML source code as a string
 */
export const generatePlantUMLSource = (diagram: C4Diagram): string => {
  const lines: string[] = [];
  
  // Header
  lines.push('@startuml');
  lines.push(getPlantUMLImport(diagram.diagramType));
  lines.push('');
  
  // Title and description
  lines.push(`title ${diagram.name}`);
  if (diagram.description) {
    lines.push('');
    lines.push(`note as DiagramDescription`);
    lines.push(diagram.description);
    lines.push('end note');
  }
  lines.push('');
  
  // Process elements hierarchically
  const elementLines = processElements(diagram.elements);
  lines.push(...elementLines);
  lines.push('');
  
  // Add relationships
  addRelationships(diagram, lines);
  
  // Footer
  lines.push('@enduml');
  
  return lines.join('\n');
};

// Helper function to process elements hierarchically
function processElements(elements: C4Element[]): string[] {
  const lines: string[] = [];
  
  // Keep track of which elements we've already processed
  const processedElementIds = new Set<string>();
  
  // Step 1: First process all elements that ARE NOT in a boundary
  elements.forEach(element => {
    // Skip if this element is a child of a boundary
    if (element.parentId) {
      return;
    }
    
    // Skip if this element is a boundary - we'll handle those in step 2
    if (element.descriptor.variant === 'boundary') {
      return;
    }
    
    const id = element.id.replace(/[^\w]/g, '_');
    const name = element.name;
    const description = element.description;
    const macro = getElementMacro(element);
    const techStr = element.technology ? `, "${element.technology}"` : '';
    
    // Add standalone elements
    if (element.descriptor.baseType === 'container' || element.descriptor.baseType === 'component') {
      lines.push(`${macro}(${id}, "${name}"${techStr}, "${description}")`);
    } else {
      lines.push(`${macro}(${id}, "${name}", "${description}")`);
    }
    
    // Mark as processed
    processedElementIds.add(element.id);
  });
  
  // Step 2: Process all boundary elements (with their children)
  elements.forEach(element => {
    // Skip if not a boundary
    if (element.descriptor.variant !== 'boundary') {
      return;
    }
    
    // Skip if this boundary is itself a child of another boundary
    // (we would need recursion to handle this, but for MVP we'll just make it flat)
    if (element.parentId) {
      // Just add the boundary as a regular element
      const id = element.id.replace(/[^\w]/g, '_');
      const name = element.name;
      const description = element.description;
      const macro = getElementMacro(element);
      
      lines.push(`${macro}(${id}, "${name}", "${description}")`);
      processedElementIds.add(element.id);
      return;
    }
    
    // It's a top-level boundary - render it with its children
    const id = element.id.replace(/[^\w]/g, '_');
    const name = element.name;
    const description = element.description;
    const macro = getElementMacro(element);
    
    // Start boundary
    lines.push(`${macro}(${id}, "${name}", "${description}") {`);
    
    // Find children of this boundary
    const children = elements.filter(e => e.parentId === element.id);
    
    // Process children elements
    if (children.length > 0) {
      children.forEach(child => {
        const childId = child.id.replace(/[^\w]/g, '_');
        const childName = child.name;
        const childDesc = child.description;
        const childMacro = getElementMacro(child);
        const childTechStr = child.technology ? `, "${child.technology}"` : '';
        
        if (child.descriptor.baseType === 'container' || child.descriptor.baseType === 'component') {
          lines.push(`  ${childMacro}(${childId}, "${childName}"${childTechStr}, "${childDesc}")`);
        } else {
          lines.push(`  ${childMacro}(${childId}, "${childName}", "${childDesc}")`);
        }
        
        // Mark as processed
        processedElementIds.add(child.id);
      });
    }
    
    // Close boundary
    lines.push('}');
    
    // Mark boundary as processed
    processedElementIds.add(element.id);
  });
  
  // Step 3: Final sweep - add any elements that weren't processed yet
  // This handles elements that might have parentId but their parent doesn't exist
  elements.forEach(element => {
    if (!processedElementIds.has(element.id)) {
      const id = element.id.replace(/[^\w]/g, '_');
      const name = element.name;
      const description = element.description;
      const macro = getElementMacro(element);
      const techStr = element.technology ? `, "${element.technology}"` : '';
      
      // Add any remaining elements
      if (element.descriptor.baseType === 'container' || element.descriptor.baseType === 'component') {
        lines.push(`${macro}(${id}, "${name}"${techStr}, "${description}")`);
      } else {
        lines.push(`${macro}(${id}, "${name}", "${description}")`);
      }
      
      // Just for completion's sake
      processedElementIds.add(element.id);
    }});
  
  return lines;
}

// Function to add relationships after all elements are defined
function addRelationships(diagram: C4Diagram, lines: string[]): void {
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
}

/**
 * Generates a PlantUML diagram from the current diagram state and saves it to disk
 * 
 * @param diagram Current diagram state with elements and relationships
 * @param pumlPath Path where PUML file should be saved (null to skip saving)
 * @returns nothing
 */
export const generateDiagramSourceFromFile = async (
  diagram: C4Diagram,
  pumlPath?: string | null,
): Promise<void> => {
  try {
    // Generate PlantUML source
    const pumlContent = generatePlantUMLSource(diagram);
    
    // Save PUML file if path provided
    if (pumlPath) {
      await savePumlFile(pumlPath, pumlContent);
    }
    
    return;
  } catch (error) {
    console.error('Error generating or saving diagram:', error);
    throw error;
  }
};

/**
 * Generates an empty PlantUML diagram with just the title and description
 * Used for initializing a new diagram workspace
 * Supports different diagram types through appropriate includes
 * 
 * @param diagram Diagram metadata with type
 * @param pumlPath Path where the PUML file should be saved (null to skip saving)
 * @returns nothing
 */
export const generateEmptyDiagram = async (
  diagram: C4Diagram,
  pumlPath?: string | null,
): Promise<void> => {
  const lines: string[] = [];
  
  // Header with appropriate include based on diagram type
  lines.push('@startuml');
  lines.push(getPlantUMLImport(diagram.diagramType));
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
  
  // Add appropriate helper comment based on diagram type
  switch (diagram.diagramType) {
    case DiagramType.CONTEXT:
      lines.push("' Add systems and people to your diagram, for example:");
      lines.push("' Person(user, \"User\", \"A user of the system\")");
      lines.push("' System(system, \"System\", \"Description of the system\")");
      lines.push("' System_Ext(external, \"External System\", \"An external system\")");
      lines.push("' Rel(user, system, \"Uses\")");
      break;
    case DiagramType.CONTAINER:
      lines.push("' Add containers to your diagram, for example:");
      lines.push("' Container(web_app, \"Web Application\", \"React\", \"The main web interface\")");
      lines.push("' ContainerDb(database, \"Database\", \"PostgreSQL\", \"Stores user data\")");
      lines.push("' Rel(web_app, database, \"Reads/writes\")");
      break;
    case DiagramType.COMPONENT:
      lines.push("' Add components to your diagram, for example:");
      lines.push("' Component(controller, \"Controller\", \"Spring MVC\", \"Handles HTTP requests\")");
      lines.push("' Component(service, \"Service\", \"Spring Service\", \"Business logic\")");
      lines.push("' Rel(controller, service, \"Uses\")");
      break;
    case DiagramType.CODE:
      lines.push("' Add code elements to your diagram, for example:");
      lines.push("' Component(interface, \"Interface\", \"Java\", \"Defines contract\")");
      lines.push("' Component(implementation, \"Implementation\", \"Java\", \"Implements interface\")");
      lines.push("' Rel(implementation, interface, \"Implements\")");
      break;
  }
  
  // Footer
  lines.push('');
  lines.push('@enduml');

  const pumlContent = lines.join('\n');
  
  try {
    // Save the PUML file if path provided
    if (pumlPath) {
      await savePumlFile(pumlPath, pumlContent);
    }
    
    return;
  } catch (error) {
    console.error('Error generating or saving diagram:', error);
    throw error;
  }
};
