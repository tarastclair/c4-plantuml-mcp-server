/**
 * AI ASSISTANCE DISCLAIMER
 * Parts of this code were written with the assistance of an AI language model.
 * While efforts have been made to ensure quality and correctness,
 * please review thoroughly before implementing in production environments.
 */

import { DiagramDb } from "../../db/index.js";
import { BaseElementType, ElementVariant, C4Element, C4Diagram } from "../../types-and-interfaces.js";
import { generateDiagramSourceFromState } from "../../plantuml-utils/index.js";

/**
 * Common parameters for system element creation
 * These match the parameters available in C4-PlantUML's System macros
 */
export interface SystemParams {
  projectId: string;
  diagramId: string;
  name: string;
  description: string;
  sprite?: string;  // Optional sprite/icon
  tags?: string;    // Optional tags for styling
  link?: string;    // Optional URL link
  type?: string;    // Optional type specifier
  baseShape?: string; // Optional base shape override
}

/**
 * Result from creating a system element
 */
export interface ElementCreationResult {
  element: C4Element;
  diagram: C4Diagram;
}

/**
 * Core function to handle all system element creation
 * Centralizes the common logic to avoid duplication and ensure consistency
 */
async function createSystemCore(
  params: SystemParams,
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
  if (params.type) metadata.type = params.type;
  if (params.baseShape) metadata.baseShape = params.baseShape;

  // Add the system element to the diagram
  const element = await db.addElement(params.projectId, params.diagramId, {
    descriptor: {
      baseType: 'system' as BaseElementType,
      variant: variant
    },
    name: params.name,
    description: params.description,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  });

  // Get the updated diagram state
  const updatedDiagram = await db.getDiagram(params.projectId, params.diagramId);
  if (!updatedDiagram) {
    throw new Error(`Diagram not found after adding element: ${params.diagramId}`);
  }

  // Generate the diagram PUML and save it to disk
  await generateDiagramSourceFromState(db, updatedDiagram, updatedDiagram.pumlPath);

  return {
    element,
    diagram: updatedDiagram  // Return the updated diagram
  };
}

/**
 * Creates a standard system element in a diagram
 * Corresponds to the System() macro in C4-PlantUML
 */
export async function createStandardSystem(
  params: SystemParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createSystemCore(params, 'standard', {}, db);
}

/**
 * Creates an external system element in a diagram
 * Corresponds to the System_Ext() macro in C4-PlantUML
 */
export async function createExternalSystem(
  params: SystemParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createSystemCore(params, 'external', {}, db);
}

/**
 * Creates a database system element in a diagram
 * Corresponds to the SystemDb() macro in C4-PlantUML
 */
export async function createDatabaseSystem(
  params: SystemParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createSystemCore(params, 'db', {}, db);
}

/**
 * Creates a queue system element in a diagram
 * Corresponds to the SystemQueue() macro in C4-PlantUML
 */
export async function createQueueSystem(
  params: SystemParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createSystemCore(params, 'queue', {}, db);
}

/**
 * Creates an external database system element in a diagram
 * Corresponds to the SystemDb_Ext() macro in C4-PlantUML
 */
export async function createExternalDatabaseSystem(
  params: SystemParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createSystemCore(
    params, 
    'external', 
    { isExternalDb: true },  // Custom flag to indicate combined external+db variant
    db
  );
}

/**
 * Creates an external queue system element in a diagram
 * Corresponds to the SystemQueue_Ext() macro in C4-PlantUML
 */
export async function createExternalQueueSystem(
  params: SystemParams,
  db: DiagramDb
): Promise<ElementCreationResult> {
  return createSystemCore(
    params, 
    'external', 
    { isExternalQueue: true },  // Custom flag to indicate combined external+queue variant
    db
  );
}