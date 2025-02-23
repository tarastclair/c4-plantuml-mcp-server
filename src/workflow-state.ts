/**
 * Workflow state management for guided C4 diagram creation
 *
 * This module implements a simple state machine to track and manage
 * conversation state during guided diagram creation. It supports
 * non-linear navigation, error recovery, and refinement.
 */

import { DiagramDb } from "./db.js";

/**
 * Represents the possible states in the C4 diagram creation workflow
 * Each state corresponds to a specific step in the guided process
 */
export enum DiagramWorkflowState {
  INITIAL = 'initial',
  SYSTEM_IDENTIFICATION = 'system-identification',
  ACTOR_DISCOVERY = 'actor-discovery',
  EXTERNAL_SYSTEM_IDENTIFICATION = 'external-system-identification',
  RELATIONSHIP_DEFINITION = 'relationship-definition',
  REFINEMENT = 'refinement',
  COMPLETE = 'complete',
}

/**
 * Defines the allowed transitions between workflow states
 * This enforces a logical flow while allowing for non-linear navigation
 * Each state can transition to specific other states
 */
export const ALLOWED_TRANSITIONS: Record<DiagramWorkflowState, DiagramWorkflowState[]> = {
  [DiagramWorkflowState.INITIAL]: [
    DiagramWorkflowState.SYSTEM_IDENTIFICATION,
  ],
  [DiagramWorkflowState.SYSTEM_IDENTIFICATION]: [
    DiagramWorkflowState.ACTOR_DISCOVERY,
    DiagramWorkflowState.REFINEMENT,
  ],
  [DiagramWorkflowState.ACTOR_DISCOVERY]: [
    DiagramWorkflowState.ACTOR_DISCOVERY, // Can add multiple actors
    DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION,
    DiagramWorkflowState.SYSTEM_IDENTIFICATION, // Go back to modify system
    DiagramWorkflowState.REFINEMENT,
  ],
  [DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION]: [
    DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION, // Can add multiple systems
    DiagramWorkflowState.RELATIONSHIP_DEFINITION,
    DiagramWorkflowState.ACTOR_DISCOVERY, // Go back to add more actors
    DiagramWorkflowState.REFINEMENT,
  ],
  [DiagramWorkflowState.RELATIONSHIP_DEFINITION]: [
    DiagramWorkflowState.RELATIONSHIP_DEFINITION, // Can add multiple relationships
    DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION, // Go back to add more systems
    DiagramWorkflowState.ACTOR_DISCOVERY, // Go back to add more actors
    DiagramWorkflowState.REFINEMENT,
    DiagramWorkflowState.COMPLETE,
  ],
  [DiagramWorkflowState.REFINEMENT]: [
    DiagramWorkflowState.SYSTEM_IDENTIFICATION,
    DiagramWorkflowState.ACTOR_DISCOVERY,
    DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION,
    DiagramWorkflowState.RELATIONSHIP_DEFINITION,
    DiagramWorkflowState.COMPLETE,
  ],
  [DiagramWorkflowState.COMPLETE]: [
    DiagramWorkflowState.REFINEMENT, // Can always go back to refine
  ],
};

/**
 * Contextual information for each workflow state
 * Tracks what information has been captured and what's pending
 */
export interface WorkflowStateContext {
  currentState: DiagramWorkflowState;
  nextState: DiagramWorkflowState
}

/**
 * Determines if a state transition is valid based on the allowed transitions map
 */
export function isValidTransition(
  currentState: DiagramWorkflowState,
  targetState: DiagramWorkflowState
): boolean {
  const allowedTargets = ALLOWED_TRANSITIONS[currentState];
  return allowedTargets.includes(targetState);
}

/**
 * Creates an initial workflow state context for a new diagram
 */
export function createInitialWorkflowState(): WorkflowStateContext {
  return {
    currentState: DiagramWorkflowState.INITIAL,
    nextState: DiagramWorkflowState.SYSTEM_IDENTIFICATION
  };
}

/**
 * Updates the workflow state
 * Ensures the transition is valid and updates context information
 */
export async function updateWorkflowState(
  db: DiagramDb,
  diagramId: string,
  nextState: DiagramWorkflowState,
) { 
  // Get current workflow state
  const currentStateContext = await db.getWorkflowState(diagramId);
  if (!currentStateContext) {
    throw new Error(`No workflow state found for diagram: ${diagramId}`);
  }

  // Validate the transition
  if (!isValidTransition(currentStateContext.currentState, nextState)) {
    // If invalid, keep current state and 
    // TODO: add error
    return currentStateContext;
  }

  const updatedState: WorkflowStateContext = {
    currentState: nextState,
    nextState: DiagramWorkflowState.REFINEMENT
  };

  await db.updateWorkflowState(diagramId, updatedState);

  // Get updated workflow state
  const updatedStateContext = await db.getWorkflowState(diagramId);
  return updatedStateContext;
}
