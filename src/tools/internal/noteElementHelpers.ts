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
 * Common parameters for note element creation
 * These match the parameters available in C4-PlantUML's Note() macro
 */
export interface NoteParams {
  projectId: string;
  diagramId: string;
  name: string;
  description: string;
}

/**
 * Result from creating a note element
 */
export interface NoteResult {
  element: C4Element;
  diagram: C4Diagram;
}

/**
 * Core function to handle all note element creation
 * Centralizes the common logic to avoid duplication and ensure consistency
 */
async function createNoteCore(
  params: NoteParams,
  variant: ElementVariant,
  db: DiagramDb
): Promise<NoteResult> {
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

  // Add the note element to the diagram
  const element = await db.addElement(params.projectId, params.diagramId, {
    descriptor: {
      baseType: 'note' as BaseElementType,
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
 * Creates a standard note element in a diagram
 * Corresponds to the Note() macro in C4-PlantUML
 * 
 * @param params Note parameters including project/diagram IDs and details
 * @param db Database access object
 * @returns Created element and updated diagram
 */
export async function createStandardNote(
  params: NoteParams,
  db: DiagramDb
): Promise<NoteResult> {
  return createNoteCore(params, 'standard', db);
}
