/**
 * relationshipHelpers.ts
 * 
 * Helper functions for creating relationships between elements in C4 diagrams
 * Supports all relationship types/directions from C4-PlantUML
 */
import { DiagramDb } from "../../db.js";
import { C4Diagram, C4Relationship } from "../../types-and-interfaces.js";
import { generateDiagramSourceFromState } from "../../plantuml-utils.js";

/**
 * Direction options for relationships
 */
export type RelationshipDirection = 
  | 'standard'       // Default direction
  | 'bidirectional'  // Two-way
  | 'up'             // Upward
  | 'down'           // Downward
  | 'left'           // Leftward
  | 'right'          // Rightward
  | 'back'           // Back
  | 'neighbor';      // Neighbor

/**
 * Common parameters for relationship creation
 */
export interface RelationshipParams {
  projectId: string;
  diagramId: string;
  sourceId: string;
  targetId: string;
  description: string;
  technology?: string;  // Optional technology
  sprite?: string;      // Optional sprite/icon
  tags?: string;        // Optional styling tags
  link?: string;        // Optional URL link
}

/**
 * Result from creating a relationship
 */
export interface RelationshipCreationResult {
  relationship: C4Relationship;
  diagram: C4Diagram;
}

/**
 * Core function to create a relationship with a specified direction
 * All other relationship functions are wrappers around this one
 */
async function createRelationshipCore(
  params: RelationshipParams,
  direction: RelationshipDirection,
  db: DiagramDb
): Promise<RelationshipCreationResult> {
  // Get the project and diagram
  const project = await db.getProject(params.projectId);
  if (!project) {
    throw new Error(`Project not found: ${params.projectId}`);
  }

  const diagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!diagram) {
    throw new Error(`Diagram not found: ${params.diagramId}`);
  }

  // Validate elements exist
  const sourceExists = diagram.elements.some(e => e.id === params.sourceId);
  const targetExists = diagram.elements.some(e => e.id === params.targetId);
  if (!sourceExists || !targetExists) {
    throw new Error("Source or target element not found");
  }

  // Prepare metadata from optional parameters
  const metadata: Record<string, unknown> = {
    direction: direction
  };
  if (params.sprite) metadata.sprite = params.sprite;
  if (params.tags) metadata.tags = params.tags;
  if (params.link) metadata.link = params.link;

  // Add the relationship to the diagram
  const relationship = await db.addRelationship(params.projectId, params.diagramId, {
    sourceId: params.sourceId,
    targetId: params.targetId,
    description: params.description,
    technology: params.technology,
    metadata: metadata
  });

  // Get the updated diagram
  const updatedDiagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!updatedDiagram) {
    throw new Error(`Diagram not found after adding relationship: ${params.diagramId}`);
  }

  // Update the diagram PUML and save it to disk
  await generateDiagramSourceFromState(db, updatedDiagram, updatedDiagram.pumlPath);

  return {
    relationship,
    diagram: updatedDiagram
  };
}

/**
 * Creates a standard relationship between elements
 * Corresponds to the Rel() macro in C4-PlantUML
 */
export async function createStandardRelationship(
  params: RelationshipParams,
  db: DiagramDb
): Promise<RelationshipCreationResult> {
  return createRelationshipCore(params, 'standard', db);
}

/**
 * Creates a bidirectional relationship between elements
 * Corresponds to the BiRel() macro in C4-PlantUML
 */
export async function createBidirectionalRelationship(
  params: RelationshipParams,
  db: DiagramDb
): Promise<RelationshipCreationResult> {
  return createRelationshipCore(params, 'bidirectional', db);
}

/**
 * Creates an upward relationship
 * Corresponds to the Rel_U(), Rel_Up() macros in C4-PlantUML
 */
export async function createUpRelationship(
  params: RelationshipParams,
  db: DiagramDb
): Promise<RelationshipCreationResult> {
  return createRelationshipCore(params, 'up', db);
}

/**
 * Creates a downward relationship
 * Corresponds to the Rel_D(), Rel_Down() macros in C4-PlantUML
 */
export async function createDownRelationship(
  params: RelationshipParams,
  db: DiagramDb
): Promise<RelationshipCreationResult> {
  return createRelationshipCore(params, 'down', db);
}

/**
 * Creates a leftward relationship
 * Corresponds to the Rel_L(), Rel_Left() macros in C4-PlantUML
 */
export async function createLeftRelationship(
  params: RelationshipParams,
  db: DiagramDb
): Promise<RelationshipCreationResult> {
  return createRelationshipCore(params, 'left', db);
}

/**
 * Creates a rightward relationship
 * Corresponds to the Rel_R(), Rel_Right() macros in C4-PlantUML
 */
export async function createRightRelationship(
  params: RelationshipParams,
  db: DiagramDb
): Promise<RelationshipCreationResult> {
  return createRelationshipCore(params, 'right', db);
}

/**
 * Creates a specialized 'back' relationship
 * Corresponds to the Rel_Back() macro in C4-PlantUML
 */
export async function createBackRelationship(
  params: RelationshipParams,
  db: DiagramDb
): Promise<RelationshipCreationResult> {
  return createRelationshipCore(params, 'back', db);
}

/**
 * Creates a specialized 'neighbor' relationship
 * Corresponds to the Rel_Neighbor() macro in C4-PlantUML
 */
export async function createNeighborRelationship(
  params: RelationshipParams,
  db: DiagramDb
): Promise<RelationshipCreationResult> {
  return createRelationshipCore(params, 'neighbor', db);
}