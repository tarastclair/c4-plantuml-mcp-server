/**
 * componentElementHelpers.ts
 * 
 * Helper functions for creating component entities in C4 diagrams
 * Supports all component variants: standard, external, db, queue, and combinations
 */
import { DiagramDb } from "../../db/db.js";
import { BaseElementType, ElementVariant, C4Element, C4Diagram } from "../../types-and-interfaces.js";
import { generateDiagramSourceFromState } from "../../plantuml-utils.js";

/**
 * Common parameters for component element creation
 * These match the parameters available in C4-PlantUML's Component macros
 */
export interface ComponentParams {
  projectId: string;
  diagramId: string;
  name: string;
  description: string;
  technology: string;  // Required for components
  boundaryId?: String // Optional UUID of the boundary element this element belongs to
  sprite?: string;     // Optional sprite/icon
  tags?: string;       // Optional tags for styling
  link?: string;       // Optional URL link
  baseShape?: string;  // Optional base shape override
}

/**
 * Result from creating a component element
 */
export interface ElementCreationResult {
  element: C4Element;
  diagram: C4Diagram;
}

/**
 * Core function to handle all component element creation
 * Centralizes the common logic to avoid duplication and ensure consistency
 */
async function createComponentCore(
  params: ComponentParams,
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
      baseType: 'component' as BaseElementType,
      variant: variant
    },
    name: params.name,
    description: params.description,
    technology: params.technology
  };

  // Add parentId directly if a boundary is specified
  if (params.boundaryId) {
    elementData.parentId = params.boundaryId as string;
  }

  // Add metadata if needed
  if (Object.keys(metadata).length > 0) {
    elementData.metadata = metadata;
  }

  // Add the component element to the diagram
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
 * Creates a standard component element in a diagram
 * Corresponds to the Component() macro in C4-PlantUML
 */
export async function createStandardComponent(
  params: ComponentParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createComponentCore(params, 'standard', {}, db);
}

/**
 * Creates an external component element in a diagram
 * Corresponds to the Component_Ext() macro in C4-PlantUML
 */
export async function createExternalComponent(
  params: ComponentParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createComponentCore(params, 'external', {}, db);
}

/**
 * Creates a database component element in a diagram
 * Corresponds to the ComponentDb() macro in C4-PlantUML
 */
export async function createDatabaseComponent(
  params: ComponentParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createComponentCore(params, 'db', {}, db);
}

/**
 * Creates a queue component element in a diagram
 * Corresponds to the ComponentQueue() macro in C4-PlantUML
 */
export async function createQueueComponent(
  params: ComponentParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createComponentCore(params, 'queue', {}, db);
}

/**
 * Creates an external database component element in a diagram
 * Corresponds to the ComponentDb_Ext() macro in C4-PlantUML
 */
export async function createExternalDatabaseComponent(
  params: ComponentParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createComponentCore(
    params, 
    'external', 
    { isExternalDb: true },  // Custom flag to indicate combined external+db variant
    db
  );
}

/**
 * Creates an external queue component element in a diagram
 * Corresponds to the ComponentQueue_Ext() macro in C4-PlantUML
 */
export async function createExternalQueueComponent(
  params: ComponentParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createComponentCore(
    params, 
    'external', 
    { isExternalQueue: true },  // Custom flag to indicate combined external+queue variant
    db
  );
}