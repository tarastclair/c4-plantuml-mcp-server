/**
 * Helper functions for working with interface diagram elements
 * Provides specialized handling for interface, type, and enum elements
 */
import { DiagramDb } from "../../db/db.js";
import { generateDiagramSourceFromState } from "../../plantuml-utils.js";
import { C4Element, InterfaceElementType, BaseElementType, ElementVariant, C4Diagram } from "../../types-and-interfaces.js";

export interface InterfaceElementResult {
  element: C4Element;
  diagram: C4Diagram;
}


/**
 * Create the base descriptor for an interface element
 * 
 * @param interfaceType Type of interface element (interface, type, enum)
 * @returns Element descriptor for the interface element
 */
export function createInterfaceElementDescriptor(interfaceType: InterfaceElementType) {
  return {
    baseType: 'component' as BaseElementType, // We use component as the base type for rendering
    variant: 'standard' as ElementVariant,   // Standard variant
    interfaceType         // The specific interface element type determines styling
  };
}

/**
 * Validates interface element parameters for correctness
 * 
 * @param name Element name
 * @param description Element description
 * @param interfaceType Type of interface element
 * @returns Error message or null if valid
 */
export function validateInterfaceElement(
  name: string, 
  description: string,
  interfaceType: InterfaceElementType
): string | null {
  // Name validation
  if (!name || name.trim().length === 0) {
    return "Element name is required";
  }
  
  // Description validation 
  if (!description || description.trim().length === 0) {
    return "Element description is required";
  }
  
  // Interface type validation
  if (!interfaceType) {
    return "Interface element type is required";
  }
  
  const validTypes: InterfaceElementType[] = ['interface', 'type', 'enum'];
  if (!validTypes.includes(interfaceType)) {
    return `Invalid interface element type: ${interfaceType}. Must be one of: ${validTypes.join(', ')}`;
  }
  
  return null;
}

/**
 * Creates an interface element in the specified diagram
 * 
 * @param db Database instance
 * @param projectId Project ID
 * @param diagramId Diagram ID
 * @param name Element name
 * @param description Element description
 * @param interfaceType Type of interface element
 * @param technology Optional technology information
 * @param parentId Optional parent boundary ID
 * @returns The created element and updated diagram
 */
export async function createInterfaceElement(
  db: DiagramDb,
  projectId: string,
  diagramId: string,
  name: string,
  description: string,
  interfaceType: InterfaceElementType,
  technology?: string,
  parentId?: string
): Promise<InterfaceElementResult> {
  // Get the project and diagram
  const project = await db.getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const diagram = await db.getDiagram(projectId, diagramId);
  if (!diagram) {
    throw new Error(`Diagram not found: ${diagramId}`);
  }

  // Validate parameters
  const validationError = validateInterfaceElement(name, description, interfaceType);
  if (validationError) {
    throw new Error(validationError);
  }
  
  // Create element descriptor
  const descriptor = createInterfaceElementDescriptor(interfaceType);
  
  // Prepare metadata
  const metadata: Record<string, unknown> = {};

  // Ensure proper styling
  metadata.tags = interfaceType;
  
  // Create element in the database
  const element: Omit<C4Element, 'id'> = {
    descriptor,
    name,
    description,
    technology: `${interfaceType.charAt(0).toUpperCase() + interfaceType.slice(1)}`,
    parentId,
    metadata
  };
  
  // Add element to diagram
  const createdElement = await db.addElement(projectId, diagramId, element);
  
  // Get the updated diagram state
  const updatedDiagram = await db.getDiagram(projectId, diagramId);
  if (!updatedDiagram) {
    throw new Error(`Diagram not found after adding element: ${diagramId}`);
  }

  // Generate the diagram PUML and save it to disk
  await generateDiagramSourceFromState(db, updatedDiagram, updatedDiagram.pumlPath);
  
  // Return both the element and updated diagram
  return {
    element: createdElement,
    diagram: updatedDiagram
  };
}