/**
 * Utilities for working with PlantUML
 * Generates C4 architectural diagrams in PNG format
 */
import axios from 'axios';
import { C4Diagram, DiagramType, C4Element, Project, InterfaceElementType, InterfaceRelationshipType } from './types-and-interfaces.js';
import { encode as encodePlantUMLWithDeflate } from 'plantuml-encoder';
import { savePumlFile, savePngFile } from './filesystem-utils.js';
import { DiagramDb } from './db/index.js';

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
    case DiagramType.INTERFACE:
      // For interfaces diagrams, we use Component as base and add custom definitions
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
  descriptor: { baseType: string; variant?: string; boundaryType?: string, interfaceType?: string }
}): string {
  const { baseType, variant, boundaryType, interfaceType  } = element.descriptor;
  
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

  if (interfaceType) {
    return 'Component'; // We use Component for all interface elements, with tags for styling
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
 * Gets the tag for an interface diagram element type
 * Used to apply the correct styling in the PlantUML diagram
 * 
 * @param interfaceType Type of interface element
 * @returns PlantUML $tags parameter value
 */
export function getInterfaceElementTag(interfaceType: InterfaceElementType): string {
  return interfaceType; // We use the element type directly as the tag
}

/**
 * Gets the relationship tag for an interface relationship type
 * Used to apply the correct styling in the PlantUML diagram
 * 
 * @param relType Type of relationship in interface diagram
 * @returns PlantUML $tags parameter value
 */
export function getInterfaceRelationshipTag(relType: InterfaceRelationshipType): string {
  return relType; // Use the relationship type directly as the tag
}

/**
 * Generate PlantUML source for a diagram
 * Separated from diagram generation to support both 
 * generating PNG and writing PUML files
 * 
 * @param diagram Current diagram state with elements and relationships
 * @returns PlantUML source code as a string
 */
export const generatePlantUMLSource = (project: Project, diagram: C4Diagram): string => {
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
  lines.push('note as ExistingProject');
  lines.push(`This diagram is part of the "${project.name}" project with ID "${diagram.projectId}". Future diagrams related to this project should use this same ID.`);
  lines.push('end note');
  lines.push('');

  // Special setup for interfaces diagrams
  if (diagram.diagramType === DiagramType.INTERFACE) {
    lines.push(getInterfaceDiagramSetup());
  }
  
  // Process elements with the appropriate method based on diagram type
  if (diagram.diagramType === DiagramType.INTERFACE) {
    const elementLines = processInterfaceDiagramElements(diagram.elements);
    lines.push(...elementLines);
  } else {
    const elementLines = processElements(diagram.elements);
    lines.push(...elementLines);
  }
  lines.push('');
  
  // Add relationships with the appropriate method based on diagram type
  if (diagram.diagramType === DiagramType.INTERFACE) {
    addInterfaceDiagramRelationships(diagram, lines);
  } else {
    addRelationships(diagram, lines);
  }
  
  // Footer
  lines.push('@enduml');
  
  return lines.join('\n');
};

/**
 * Returns the setup section for interfaces diagrams
 * Defines custom styling tags for interfaces, types, and enums
 * 
 * @returns PlantUML setup code as string
 */
export function getInterfaceDiagramSetup(): string {
  const lines: string[] = [];
  
  // Hide stereotypes for cleaner diagram
  lines.push('HIDE_STEREOTYPE()');
  lines.push('');
  
  // Add custom styling for interface elements
  lines.push('\'Type system tags with C4 blue gradient colors');
  lines.push('AddElementTag("interface", $bgColor="#18437D", $fontColor="#ffffff", $borderColor="#0b2b52")');
  lines.push('AddElementTag("type", $bgColor="#2A69C0", $fontColor="#ffffff", $borderColor="#1d4b8c")');
  lines.push('AddElementTag("enum", $bgColor="#8CBBF2", $fontColor="#000000", $borderColor="#5c98d9")');
  lines.push('');
  
  // Add relationship styling
  lines.push('\'Simple relationship style');
  lines.push('AddRelTag("contains", $lineStyle = DashedLine())');
  lines.push('AddRelTag("implements", $lineColor="#18437D")');
  lines.push('AddRelTag("extends", $lineColor="#2A69C0")');
  lines.push('AddRelTag("references", $lineColor="#5c98d9")');
  lines.push('');
  
  return lines.join('\n');
}

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

/**
 * Process elements for an interfaces diagram
 * Handles custom styling and organization for interface type diagrams
 * 
 * @param elements Elements to process
 * @returns Array of PlantUML lines for elements
 */
function processInterfaceDiagramElements(elements: C4Element[]): string[] {
  const lines: string[] = [];
  const processedElementIds = new Set<string>();
  
  // Process non-boundary elements first
  elements.forEach(element => {
    if (element.parentId || element.descriptor.variant === 'boundary') {
      return;
    }
    
    const id = element.id.replace(/[^\w]/g, '_');
    const name = element.name;
    const description = element.description;
    const macro = getElementMacro(element);
    const techStr = element.technology ? `, "${element.technology}"` : ', ""';
    
    // For interface diagrams, we add tag based on interfaceType
    let tagsStr = '';
    if (element.descriptor.interfaceType) {
      tagsStr = `, $tags="${element.descriptor.interfaceType}"`;
    }
    
    // Add standalone elements
    lines.push(`${macro}(${id}, "${name}"${techStr}, "${description}"${tagsStr})`);
    processedElementIds.add(element.id);
  });
  
  // Process boundary elements and their children
  elements.forEach(element => {
    if (element.descriptor.variant !== 'boundary' || processedElementIds.has(element.id)) {
      return;
    }
    
    const id = element.id.replace(/[^\w]/g, '_');
    const name = element.name;
    const description = element.description;
    const macro = getElementMacro(element);
    
    // Start boundary
    lines.push(`${macro}(${id}, "${name}", "${description}") {`);
    
    // Process children
    const children = elements.filter(e => e.parentId === element.id);
    if (children.length > 0) {
      children.forEach(child => {
        const childId = child.id.replace(/[^\w]/g, '_');
        const childName = child.name;
        const childDesc = child.description;
        const childMacro = getElementMacro(child);
        const childTechStr = child.technology ? `, "${child.technology}"` : ', ""';
        
        // Add tag based on interfaceType
        let tagsStr = '';
        if (child.descriptor.interfaceType) {
          tagsStr = `, $tags="${child.descriptor.interfaceType}"`;
        }
        
        lines.push(`  ${childMacro}(${childId}, "${childName}"${childTechStr}, "${childDesc}"${tagsStr})`);
        processedElementIds.add(child.id);
      });
    }
    
    // Close boundary
    lines.push('}');
    processedElementIds.add(element.id);
  });
  
  // Process any remaining elements
  elements.forEach(element => {
    if (!processedElementIds.has(element.id)) {
      const id = element.id.replace(/[^\w]/g, '_');
      const name = element.name;
      const description = element.description;
      const macro = getElementMacro(element);
      const techStr = element.technology ? `, "${element.technology}"` : ', ""';
      
      let tagsStr = '';
      if (element.descriptor.interfaceType) {
        tagsStr = `, $tags="${element.descriptor.interfaceType}"`;
      }
      
      lines.push(`${macro}(${id}, "${name}"${techStr}, "${description}"${tagsStr})`);
      processedElementIds.add(element.id);
    }
  });
  
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
 * Add relationships for an interfaces diagram
 * Handles relationship tagging and styling for interface type diagrams
 * 
 * @param diagram Diagram containing relationships
 * @param lines Array of PlantUML lines to append to
 */
function addInterfaceDiagramRelationships(diagram: C4Diagram, lines: string[]): void {
  // Track processed relationships to prevent duplicates
  const processedRels = new Set<string>();

  // Add relationships with appropriate tags
  diagram.relationships.forEach(rel => {
    const source = diagram.elements.find(e => e.id === rel.sourceId);
    const target = diagram.elements.find(e => e.id === rel.targetId);
    
    if (source && target) {
      const sourceId = source.id.replace(/[^\w]/g, '_');
      const targetId = target.id.replace(/[^\w]/g, '_');
      
      // Create a unique key for this relationship
      const relKey = `${sourceId}-${targetId}-${rel.description}`;
      
      // Only add if we haven't seen this relationship before
      if (!processedRels.has(relKey)) {
        processedRels.add(relKey);
        
        // Add tag if relationship type is in metadata
        let tagsStr = '';
        if (rel.metadata?.type && typeof rel.metadata.type === 'string') {
          tagsStr = `, $tags="${rel.metadata.type}"`;
        }
        
        lines.push(`Rel(${sourceId}, ${targetId}, "${rel.description}"${tagsStr})`);
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
export const generateDiagramSourceFromState = async (
  db: DiagramDb,
  diagram: C4Diagram,
  pumlPath?: string | null,
): Promise<void> => {
  try {
    // Check if project exists
    const project = await db.getProject(diagram.projectId);
    if (!project) {
      throw new Error(`Project ${diagram.projectId} not found. Please provide a valid project UUID.`);
    }

    // Generate PlantUML source
    const pumlContent = generatePlantUMLSource(project, diagram);
    
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
