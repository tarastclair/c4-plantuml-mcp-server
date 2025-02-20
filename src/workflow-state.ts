/**
 * Workflow state management for guided C4 diagram creation
 *
 * This module implements a simple state machine to track and manage
 * conversation state during guided diagram creation. It supports
 * non-linear navigation, error recovery, and refinement.
 */

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
 * Maps workflow states to corresponding MCP prompt names
 * Used to determine which prompt to show for a given state
 */
export const STATE_TO_PROMPT_MAP: Record<DiagramWorkflowState, string> = {
  [DiagramWorkflowState.INITIAL]: 'systemIdentification',
  [DiagramWorkflowState.SYSTEM_IDENTIFICATION]: 'systemIdentification',
  [DiagramWorkflowState.ACTOR_DISCOVERY]: 'userActorDiscovery',
  [DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION]: 'externalSystemIdentification',
  [DiagramWorkflowState.RELATIONSHIP_DEFINITION]: 'relationshipDefinition',
  [DiagramWorkflowState.REFINEMENT]: 'diagramRefinement',
  [DiagramWorkflowState.COMPLETE]: 'diagramComplete',
};

/**
 * Maps prompt names to workflow states
 * Used to determine the state based on a nextPrompt value
 */
export const PROMPT_TO_STATE_MAP: Record<string, DiagramWorkflowState> = {
  'systemIdentification': DiagramWorkflowState.SYSTEM_IDENTIFICATION,
  'userActorDiscovery': DiagramWorkflowState.ACTOR_DISCOVERY,
  'externalSystemIdentification': DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION,
  'relationshipDefinition': DiagramWorkflowState.RELATIONSHIP_DEFINITION,
  'diagramRefinement': DiagramWorkflowState.REFINEMENT,
  'diagramComplete': DiagramWorkflowState.COMPLETE,
};

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
  pendingActions?: string[];
  completedSteps?: DiagramWorkflowState[];
  lastModified?: {
    elementId?: string;
    elementType?: string;
    relationshipId?: string;
  };
  error?: {
    message: string;
    recoveryState?: DiagramWorkflowState;
  };
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
 * Gets the appropriate next prompt based on the current workflow state
 */
export function getPromptForState(state: DiagramWorkflowState): string {
  return STATE_TO_PROMPT_MAP[state] || 'systemIdentification';
}

/**
 * Gets the appropriate workflow state based on a nextPrompt value
 */
export function getStateForPrompt(prompt: string): DiagramWorkflowState {
  return PROMPT_TO_STATE_MAP[prompt] || DiagramWorkflowState.INITIAL;
}

/**
 * Creates an initial workflow state context for a new diagram
 */
export function createInitialWorkflowState(): WorkflowStateContext {
  return {
    currentState: DiagramWorkflowState.INITIAL,
    completedSteps: [],
    pendingActions: ['Identify the core system']
  };
}

/**
 * Updates the workflow state based on a nextPrompt value
 * Ensures the transition is valid and updates context information
 */
export function updateWorkflowState(
  currentContext: WorkflowStateContext,
  nextPrompt: string,
  stateUpdate: Partial<WorkflowStateContext> = {}
): WorkflowStateContext {
  const targetState = getStateForPrompt(nextPrompt);
  
  // Validate the transition
  if (!isValidTransition(currentContext.currentState, targetState)) {
    // If invalid, keep current state and add error
    return {
      ...currentContext,
      error: {
        message: `Invalid workflow transition from ${currentContext.currentState} to ${targetState}`,
        recoveryState: currentContext.currentState
      }
    };
  }
  
  // Valid transition - update state and track completion
  const completedSteps = currentContext.completedSteps || [];
  if (!completedSteps.includes(currentContext.currentState)) {
    completedSteps.push(currentContext.currentState);
  }
  
  // Generate appropriate pending actions for the new state
  const pendingActions = getPendingActionsForState(targetState);
  
  return {
    ...currentContext,
    ...stateUpdate,
    currentState: targetState,
    completedSteps,
    pendingActions,
    error: undefined // Clear any previous errors
  };
}

/**
 * Generates appropriate pending actions based on the workflow state
 */
function getPendingActionsForState(state: DiagramWorkflowState): string[] {
  switch (state) {
    case DiagramWorkflowState.SYSTEM_IDENTIFICATION:
      return ['Identify the core system'];
    case DiagramWorkflowState.ACTOR_DISCOVERY:
      return ['Identify users and actors who interact with the system'];
    case DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION:
      return ['Identify external systems that interact with your core system'];
    case DiagramWorkflowState.RELATIONSHIP_DEFINITION:
      return ['Define relationships between elements'];
    case DiagramWorkflowState.REFINEMENT:
      return [
        'Review the diagram for completeness',
        'Add missing elements or relationships',
        'Update descriptions for clarity'
      ];
    case DiagramWorkflowState.COMPLETE:
      return ['Your diagram is complete!'];
    default:
      return ['Proceed with diagram creation'];
  }
}

/**
 * Creates an error recovery state context
 * Helps guide the user back to a valid workflow state
 */
export function createErrorRecoveryState(
  currentContext: WorkflowStateContext,
  errorMessage: string,
  recoveryState?: DiagramWorkflowState
): WorkflowStateContext {
  const targetState = recoveryState || currentContext.currentState;
  
  return {
    ...currentContext,
    currentState: targetState,
    error: {
      message: errorMessage,
      recoveryState: targetState
    },
    pendingActions: [
      'Recover from error',
      ...getPendingActionsForState(targetState)
    ]
  };
}
