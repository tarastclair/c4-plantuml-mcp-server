import { C4Diagram, DiagramType, Project } from '../types-and-interfaces.js';
import { savePumlFile } from '../filesystem-utils.js';
import { DiagramDb } from '../db/index.js';
import { getPlantUMLImport, getInterfaceDiagramSetup, processElements, processInterfaceDiagramElements, addInterfaceDiagramRelationships, addRelationships, processSequenceElements, addSequenceRelationships, processSequenceSpecialElements } from './index.js';

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
  
  // For sequence diagrams, skip adding notes about description and project
  // This is because C4-PlantUML sequence diagrams don't support these notes
  if (diagram.diagramType !== DiagramType.SEQUENCE) {
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
  }

  // Special setup for interfaces diagrams
  if (diagram.diagramType === DiagramType.INTERFACE) {
    lines.push(getInterfaceDiagramSetup());
  }
  
  // Process elements with the appropriate method based on diagram type
  if (diagram.diagramType === DiagramType.INTERFACE) {
    const elementLines = processInterfaceDiagramElements(diagram.elements);
    lines.push(...elementLines);
  } else if (diagram.diagramType === DiagramType.SEQUENCE) {
    // Use sequence-specific processing
    const elementLines = processSequenceElements(diagram.elements);
    lines.push(...elementLines);
    
    // Add special sequence elements (dividers, groups, etc.)
    const specialElementLines = processSequenceSpecialElements(diagram.elements);
    lines.push(...specialElementLines);
  } else {
    const elementLines = processElements(diagram.elements);
    lines.push(...elementLines);
  }
  lines.push('');
  
  // Add relationships with the appropriate method based on diagram type
  if (diagram.diagramType === DiagramType.INTERFACE) {
    addInterfaceDiagramRelationships(diagram, lines);
  } else if (diagram.diagramType === DiagramType.SEQUENCE) {
    addSequenceRelationships(diagram, lines);
  } else {
    addRelationships(diagram, lines);
  }
  
  // Footer
  lines.push('@enduml');
  
  return lines.join('\n');
};

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

// Skip notes for sequence diagrams
if (diagram.diagramType !== DiagramType.SEQUENCE && diagram.description) {
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
    case DiagramType.SEQUENCE:
    lines.push("' Add sequence diagram elements and relationships, for example:");
    lines.push("' Person(user, \"User\", \"A user of the system\")");
    lines.push("' Component(c1, \"Controller\", \"Spring MVC\", \"Handles HTTP requests\")");
    lines.push("' Rel(user, c1, \"Makes API request\", \"HTTP\")");
    lines.push("' == Authentication Step ==");  // Example divider
    lines.push("' group Login Process");         // Example group
    lines.push("' Rel(c1, db, \"Verifies credentials\", \"JDBC\")");
    lines.push("' end");                        // End of group
    lines.push("' SHOW_ELEMENT_DESCRIPTIONS()"); // Special options for sequence diagrams
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