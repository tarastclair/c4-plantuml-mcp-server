/**
 * Helper functions for creating special sequence diagram elements
 * Such as dividers and groups
 */

import { DiagramDb } from "../../db/index.js";
import { BaseElementType, ElementVariant, C4Element, C4Diagram } from "../../types-and-interfaces.js";
import { generateDiagramSourceFromState } from "../../plantuml-utils/index.js";

/**
 * Result from creating a sequence element
 */
export interface SequenceElementResult {
  element: C4Element;
  diagram: C4Diagram;
}

/**
 * Parameters for creating a divider element in a sequence diagram
 */
export interface DividerParams {
  projectId: string;
  diagramId: string;
  title: string;  // Text to display in the divider
}

/**
 * Parameters for creating a group element in a sequence diagram
 */
export interface GroupParams {
  projectId: string;
  diagramId: string;
  title: string;  // Group title
  description?: string; // Optional description
}

/**
 * Validates sequence element parameters for correctness
 * 
 * @param title Element title/name
 * @returns Error message or null if valid
 */
export function validateSequenceElement(title: string): string | null {
  // Title validation
  if (!title || title.trim().length === 0) {
    return "Element title is required";
  }
  
  return null;
}

/**
 * Creates a divider element in a sequence diagram
 * Corresponds to the `== Divider Text ==` syntax in PlantUML sequence diagrams
 * 
 * @param params Divider parameters
 * @param db Database instance
 * @returns The created element and updated diagram
 */
export async function createDivider(
  params: DividerParams, 
  db: DiagramDb
): Promise<SequenceElementResult> {
  // Check if project and diagram exist
  const project = await db.getProject(params.projectId);
  if (!project) {
    throw new Error(`Project not found: ${params.projectId}`);
  }

  const diagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!diagram) {
    throw new Error(`Diagram not found: ${params.diagramId}`);
  }

  // Validate parameters
  const validationError = validateSequenceElement(params.title);
  if (validationError) {
    throw new Error(validationError);
  }

  // Create a special element to represent the divider
  const elementData: Omit<C4Element, 'id'> = {
    descriptor: {
      baseType: 'component' as BaseElementType, // Use component as base type
      variant: 'standard' as ElementVariant
    },
    name: params.title,
    description: "Sequence Diagram Divider", // Description identifies this as a divider
    metadata: {
      isSequenceDivider: true, // Special flag to identify this as a divider
      dividerTitle: params.title,
      created: new Date().toISOString() // Timestamp for ordering
    }
  };

  // Add the divider element to the diagram
  const element = await db.addElement(params.projectId, params.diagramId, elementData);

  // Get the updated diagram state
  const updatedDiagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!updatedDiagram) {
    throw new Error(`Diagram not found after adding element: ${params.diagramId}`);
  }

  // Generate the diagram and save it to disk
  await generateDiagramSourceFromState(db, updatedDiagram, updatedDiagram.pumlPath);

  // Return both the element and updated diagram
  return {
    element,
    diagram: updatedDiagram
  };
}

/**
 * Creates a group element in a sequence diagram
 * Corresponds to the `group Title` and `end` syntax in PlantUML sequence diagrams
 * 
 * @param params Group parameters
 * @param db Database instance
 * @returns The created element and updated diagram
 */
export async function createGroup(
  params: GroupParams, 
  db: DiagramDb
): Promise<SequenceElementResult> {
  // Check if project and diagram exist
  const project = await db.getProject(params.projectId);
  if (!project) {
    throw new Error(`Project not found: ${params.projectId}`);
  }

  const diagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!diagram) {
    throw new Error(`Diagram not found: ${params.diagramId}`);
  }

  // Validate parameters
  const validationError = validateSequenceElement(params.title);
  if (validationError) {
    throw new Error(validationError);
  }

  // Create a special element to represent the group
  const elementData: Omit<C4Element, 'id'> = {
    descriptor: {
      baseType: 'component' as BaseElementType, // Use component as base type
      variant: 'standard' as ElementVariant
    },
    name: params.title,
    description: params.description || "Sequence Diagram Group",
    metadata: {
      isSequenceGroup: true, // Special flag to identify this as a group
      groupTitle: params.title,
      groupDescription: params.description,
      created: new Date().toISOString() // Timestamp for ordering
    }
  };

  // Add the group element to the diagram
  const element = await db.addElement(params.projectId, params.diagramId, elementData);

  // Get the updated diagram state
  const updatedDiagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!updatedDiagram) {
    throw new Error(`Diagram not found after adding element: ${params.diagramId}`);
  }

  // Generate the diagram and save it to disk
  await generateDiagramSourceFromState(db, updatedDiagram, updatedDiagram.pumlPath);

  // Return both the element and updated diagram
  return {
    element,
    diagram: updatedDiagram
  };
}

/**
 * Creates a group end marker in a sequence diagram
 * Corresponds to the `end` keyword in sequence diagrams
 * 
 * @param params Group parameters (only projectId and diagramId used)
 * @param groupId ID of the group to end
 * @param db Database instance
 * @returns The created element and updated diagram
 */
export async function createGroupEnd(
  params: Pick<GroupParams, 'projectId' | 'diagramId'>,
  groupId: string,
  db: DiagramDb
): Promise<SequenceElementResult> {
  // Check if project and diagram exist
  const project = await db.getProject(params.projectId);
  if (!project) {
    throw new Error(`Project not found: ${params.projectId}`);
  }

  const diagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!diagram) {
    throw new Error(`Diagram not found: ${params.diagramId}`);
  }

  // Check if group exists
  const group = diagram.elements.find(e => 
    e.id === groupId && 
    e.metadata?.isSequenceGroup === true
  );
  
  if (!group) {
    throw new Error(`Group element not found: ${groupId}`);
  }

  // Create a special element to represent the group end
  const elementData: Omit<C4Element, 'id'> = {
    descriptor: {
      baseType: 'component' as BaseElementType, // Use component as base type
      variant: 'standard' as ElementVariant
    },
    name: `End of ${group.name}`,
    description: "Group End Marker",
    metadata: {
      isSequenceGroup: true, // Flag as group-related
      isGroupEnd: true, // Special flag to identify this as a group end
      groupId: groupId, // Reference to the original group
      created: new Date().toISOString() // Timestamp for ordering
    }
  };

  // Add the group end element to the diagram
  const element = await db.addElement(params.projectId, params.diagramId, elementData);

  // Get the updated diagram state
  const updatedDiagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!updatedDiagram) {
    throw new Error(`Diagram not found after adding element: ${params.diagramId}`);
  }

  // Generate the diagram and save it to disk
  await generateDiagramSourceFromState(db, updatedDiagram, updatedDiagram.pumlPath);

  // Return both the element and updated diagram
  return {
    element,
    diagram: updatedDiagram
  };
}