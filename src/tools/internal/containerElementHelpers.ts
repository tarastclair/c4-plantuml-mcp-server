/**
 * containerElementHelpers.ts
 * 
 * Helper functions for creating container entities in C4 diagrams
 * Supports all container variants: standard, external, db, queue, and combinations
 */
import { DiagramDb } from "../../db.js";
import { BaseElementType, ElementVariant, C4Element, C4Diagram } from "../../types-and-interfaces.js";
import { generateDiagramSourceFromState } from "../../plantuml-utils.js";

/**
 * Common parameters for container element creation
 * These match the parameters available in C4-PlantUML's Container macros
 */
export interface ContainerParams {
  projectId: string;
  diagramId: string;
  name: string;
  description: string;
  technology: string;  // Required for containers (unlike persons/systems)
  boundaryId?: String // Optional UUID of the boundary element this element belongs to
  sprite?: string;     // Optional sprite/icon
  tags?: string;       // Optional tags for styling
  link?: string;       // Optional URL link
  baseShape?: string;  // Optional base shape override
}

/**
 * Result from creating a container element
 */
export interface ElementCreationResult {
  element: C4Element;
  diagram: C4Diagram;
}

/**
 * Core function to handle all container element creation
 * Centralizes the common logic to avoid duplication and ensure consistency
 */
async function createContainerCore(
  params: ContainerParams,
  variant: ElementVariant,
  additionalMetadata: Record<string, unknown> = {},
  db: DiagramDb
): Promise<ElementCreationResult> {
  // Get the project and diagram
  const project = await db.getProject(params.projectId);
  if (!project) {
    throw new Error(`Project not found: ${params.projectId}`);
  }

  const diagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!diagram) {
    throw new Error(`Diagram not found: ${params.diagramId}`);
  }

  // Prepare metadata from optional parameters
  const metadata: Record<string, unknown> = {
    ...additionalMetadata
  };
  
  if (params.sprite) metadata.sprite = params.sprite;
  if (params.tags) metadata.tags = params.tags;
  if (params.link) metadata.link = params.link;
  if (params.baseShape) metadata.baseShape = params.baseShape;
  if (params.boundaryId) {
    // Validate that the boundary exists and is a valid boundary element
    const boundary = diagram.elements.find(e => 
      e.id === params.boundaryId && 
      e.descriptor.variant === 'boundary'
    );
    
    if (!boundary) {
      throw new Error(`Boundary element not found or not a valid boundary: ${params.boundaryId}`);
    }
  }

  // Create element object with potential parentId
  const elementData: Omit<C4Element, 'id'> = {
    descriptor: {
      baseType: 'container' as BaseElementType,
      variant: variant
    },
    name: params.name,
    description: params.description,
    technology: params.technology
  };

  // Add parentId directly if a boundary is specified
  if (params.boundaryId) {
    // Validate that the boundary exists...
    
    // Set the parentId directly on the element
    elementData.parentId = params.boundaryId as string;
  }

  // Add metadata if needed
  if (Object.keys(metadata).length > 0) {
    elementData.metadata = metadata;
  }

  // Add the container element to the diagram
  const element = await db.addElement(params.projectId, params.diagramId, elementData);

  // Get the updated diagram state
  const updatedDiagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!updatedDiagram) {
    throw new Error(`Diagram not found after adding element: ${params.diagramId}`);
  }

  // Generate the diagram and save it to disk
  await generateDiagramSourceFromState(db, updatedDiagram, updatedDiagram.pumlPath);

  return {
    element,
    diagram: updatedDiagram
  };
}

/**
 * Creates a standard container element in a diagram
 * Corresponds to the Container() macro in C4-PlantUML
 */
export async function createStandardContainer(
  params: ContainerParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createContainerCore(params, 'standard', {}, db);
}

/**
 * Creates an external container element in a diagram
 * Corresponds to the Container_Ext() macro in C4-PlantUML
 */
export async function createExternalContainer(
  params: ContainerParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createContainerCore(params, 'external', {}, db);
}

/**
 * Creates a database container element in a diagram
 * Corresponds to the ContainerDb() macro in C4-PlantUML
 */
export async function createDatabaseContainer(
  params: ContainerParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createContainerCore(params, 'db', {}, db);
}

/**
 * Creates a queue container element in a diagram
 * Corresponds to the ContainerQueue() macro in C4-PlantUML
 */
export async function createQueueContainer(
  params: ContainerParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createContainerCore(params, 'queue', {}, db);
}

/**
 * Creates an external database container element in a diagram
 * Corresponds to the ContainerDb_Ext() macro in C4-PlantUML
 */
export async function createExternalDatabaseContainer(
  params: ContainerParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createContainerCore(
    params, 
    'external', 
    { isExternalDb: true },  // Custom flag to indicate combined external+db variant
    db
  );
}

/**
 * Creates an external queue container element in a diagram
 * Corresponds to the ContainerQueue_Ext() macro in C4-PlantUML
 */
export async function createExternalQueueContainer(
  params: ContainerParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createContainerCore(
    params, 
    'external', 
    { isExternalQueue: true },  // Custom flag to indicate combined external+queue variant
    db
  );
}