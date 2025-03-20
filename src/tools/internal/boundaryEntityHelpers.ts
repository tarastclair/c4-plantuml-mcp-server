/**
 * boundaryEntityHelpers.ts
 * 
 * Helper functions for creating boundary entities in C4 diagrams
 * Supports all boundary types: system, and container
 * Boundaries are used to group related elements and establish hierarchical relationships
 */
import { DiagramDb } from "../../db.js";
import { BaseElementType, ElementVariant, C4Element, C4Diagram } from "../../types-and-interfaces.js";
import { generateDiagramSourceFromFile } from "../../plantuml-utils.js";

/**
 * Common parameters for boundary element creation
 * These match the parameters available in C4-PlantUML's Boundary macros
 */
export interface BoundaryParams {
  projectId: string;
  diagramId: string;
  name: string;
  description?: string;
  sprite?: string;     // Optional sprite/icon
  tags?: string;       // Optional tags for styling
  link?: string;       // Optional URL link
  type?: string;       // Optional type specifier
}

/**
 * Result from creating a boundary element
 */
export interface ElementCreationResult {
  element: C4Element;
  diagram: C4Diagram;
}

/**
 * Core function to handle all boundary element creation
 * Centralizes the common logic to avoid duplication and ensure consistency
 */
async function createBoundaryCore(
  params: BoundaryParams,
  boundaryType: 'system' | 'container',
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
  if (params.type) metadata.type = params.type;

  // Determine which base type to use based on the boundary type
  // This mapping aligns with C4-PlantUML's macro implementation
  let baseType: BaseElementType;
  
  switch (boundaryType) {
    case 'system':
      baseType = 'system'; // System boundaries typically contain containers
      break;
    case 'container':
      baseType = 'container'; // Container boundaries typically contain components
      break;
    default:
      throw new Error(`Unsupported boundary type: ${boundaryType}`);
  }

  // Add the boundary element to the diagram
  const element = await db.addElement(params.projectId, params.diagramId, {
    descriptor: {
      baseType: baseType,
      variant: 'boundary' as ElementVariant,
      boundaryType: boundaryType
    },
    name: params.name,
    description: params.description || "",
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  });

  // Get the updated diagram state
  const updatedDiagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!updatedDiagram) {
    throw new Error(`Diagram not found after adding element: ${params.diagramId}`);
  }

  // Generate the diagram and save it to disk
  await generateDiagramSourceFromFile(updatedDiagram, updatedDiagram.pumlPath);

  return {
    element,
    diagram: updatedDiagram
  };
}

/**
 * Creates a system boundary element in a diagram
 * Corresponds to the System_Boundary() macro in C4-PlantUML
 * Used in context and container diagrams to group related containers
 */
export async function createSystemBoundary(
  params: BoundaryParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createBoundaryCore(params, 'system', {}, db);
}

/**
 * Creates a container boundary element in a diagram
 * Corresponds to the Container_Boundary() macro in C4-PlantUML
 * Used in container and component diagrams to group related components
 */
export async function createContainerBoundary(
  params: BoundaryParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createBoundaryCore(params, 'container', {}, db);
}

/**
 * Creates a generic boundary element in a diagram
 * Corresponds to the Boundary() macro in C4-PlantUML
 * Used when a specific boundary type is not needed
 */
export async function createGenericBoundary(
  params: BoundaryParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  // For generic boundaries, validate that the type parameter is provided
  if (!params.type) {
    throw new Error("Generic boundaries require a 'type' parameter to specify their purpose");
  }
  
  // For generic boundaries, default to system type but allow override via params.type
  const boundaryType = (params.type as 'system' | 'container') || 'system';
  
  // Add custom metadata to indicate this is a generic boundary
  const metadata: Record<string, unknown> = {
    isGenericBoundary: true
  };
  
  return createBoundaryCore(params, boundaryType, metadata, db);
}