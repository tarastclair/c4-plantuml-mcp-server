/**
 * personElementHelpers.ts
 * 
 * Helper functions for creating person entities in C4 diagrams
 * Supports standard and external person variants with optional styling parameters
 */
import { DiagramDb } from "../../db/index.js";
import { BaseElementType, ElementVariant, C4Element, C4Diagram } from "../../types-and-interfaces.js";
import { generateDiagramSourceFromState } from "../../plantuml-utils.js";

/**
 * Common parameters for person element creation
 * These match the parameters available in C4-PlantUML's Person() and Person_Ext() macros
 */
export interface PersonParams {
  projectId: string;
  diagramId: string;
  name: string;
  description: string;
  sprite?: string;  // Optional sprite/icon
  tags?: string;    // Optional tags for styling
  link?: string;    // Optional URL link
  type?: string;    // Optional type specifier
}

/**
 * Result from creating a person element
 */
export interface PersonResult {
  element: C4Element;
  diagram: C4Diagram;
}

/**
 * Core function to handle all person element creation
 * Centralizes the common logic to avoid duplication and ensure consistency
 */
async function createPersonCore(
  params: PersonParams,
  variant: ElementVariant,
  db: DiagramDb
): Promise<PersonResult> {
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
  const metadata: Record<string, unknown> = {};
  if (params.sprite) metadata.sprite = params.sprite;
  if (params.tags) metadata.tags = params.tags;
  if (params.link) metadata.link = params.link;
  if (params.type) metadata.type = params.type;

  // Add the person element to the diagram
  const element = await db.addElement(params.projectId, params.diagramId, {
    descriptor: {
      baseType: 'person' as BaseElementType,
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
    diagram: updatedDiagram
  };
}

/**
 * Creates a standard person element in a diagram
 * Corresponds to the Person() macro in C4-PlantUML
 * 
 * @param params Person parameters including project/diagram IDs and person details
 * @param db Database access object
 * @returns Created element and updated diagram
 */
export async function createStandardPerson(
  params: PersonParams,
  db: DiagramDb
): Promise<PersonResult> {
  return createPersonCore(params, 'standard', db);
}

/**
 * Creates an external person element in a diagram
 * Corresponds to the Person_Ext() macro in C4-PlantUML
 * External people are typically users outside the organization
 * 
 * @param params Person parameters including project/diagram IDs and person details
 * @param db Database access object
 * @returns Created element and updated diagram
 */
export async function createExternalPerson(
  params: PersonParams,
  db: DiagramDb
): Promise<PersonResult> {
  return createPersonCore(params, 'external', db);
}