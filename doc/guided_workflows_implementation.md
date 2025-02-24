# Guided Workflows Implementation

(working document)

## The High-Level Goal

We want to create an interactive experience where the user and AI assistant can collaboratively build C4 architectural diagrams through natural conversation. The conversation should:

1. Guide users step-by-step through building the appropriate diagram type
2. Provide a structured workflow with clear stages
3. Support flexible back-and-forth refinement

## Our Approach: Tool-Based Guided Workflows

We're using a tool-based approach with state management to guide users through diagram creation. Because the prompt functionality in MCP is currently very limited, we're implementing a workflow state machine that guides the conversation through discrete steps.

### Key Design Principles

1. **Distinct Entry Points**: Separate entry tools for each diagram type to provide clear starting points
2. **Unified Workflow Engine**: Extended workflow state machine that handles all diagram types while maintaining specialized paths
3. **State-Driven Tools**: Tools that both perform operations and manage workflow state progression
4. **Non-Linear Navigation**: Support for moving forward, backward, or jumping between workflow states
5. **Progressive Disclosure**: Start with basic elements and gradually add complexity

## Workflow States and Diagram Types

We're implementing an Extended Unified Workflow approach with states specific to each diagram type but sharing common functionality where appropriate:

```typescript
export enum DiagramWorkflowState {
  // Common states
  INITIAL = 'initial',
  REFINEMENT = 'refinement',
  COMPLETE = 'complete',
  
  // Context (C1) diagram states
  SYSTEM_IDENTIFICATION = 'system-identification',
  ACTOR_DISCOVERY = 'actor-discovery',
  EXTERNAL_SYSTEM_IDENTIFICATION = 'external-system-identification',
  
  // Container (C2) diagram states (planned)
  CONTAINER_IDENTIFICATION = 'container-identification',
  CONTAINER_DATABASE_IDENTIFICATION = 'container-database-identification',
  
  // Component (C3) diagram states (planned)
  COMPONENT_IDENTIFICATION = 'component-identification',
  COMPONENT_RESPONSIBILITY_DEFINITION = 'component-responsibility-definition',
  
  // Code (C4) diagram states (planned)
  CLASS_IDENTIFICATION = 'class-identification',
  METHOD_IDENTIFICATION = 'method-identification',
  
  // Shared states
  RELATIONSHIP_DEFINITION = 'relationship-definition',
}
```

## Entry Points Strategy

We're creating distinct entry points for each C4 diagram level to provide clear guidance:

1. **createContextDiagram**: For high-level context diagrams (C1) showing the system and its users/external dependencies
2. **createContainerDiagram**: For container diagrams (C2) showing the internal architecture of a system
3. **createComponentDiagram**: For component diagrams (C3) showing internal structure of containers
4. **createCodeDiagram**: For code-level diagrams (C4) showing implementation details

Each entry point has its own description tailored to its specific purpose, making it easier for both AI assistants and users to select the appropriate starting point.

## Implementation Strategy

### 1. Workflow State Management

The core of our approach is a state machine that tracks progress through diagram creation:

```typescript
// Update workflow state
export async function updateWorkflowState(
  db: DiagramDb,
  diagramId: string,
  targetState: DiagramWorkflowState
) { 
  // Get current workflow state
  const currentStateContext = await db.getWorkflowState(diagramId);
  if (!currentStateContext) {
    throw new Error(`No workflow state found for diagram: ${diagramId}`);
  }

  // Validate the transition
  if (!isValidTransition(currentStateContext.currentState, targetState)) {
    throw new Error(
      `Invalid transition from ${currentStateContext.currentState} to ${targetState}`
    );
  }

  // Update state and return new context
  const updatedState: WorkflowStateContext = {
    currentState: targetState,
    nextState: getDefaultNextState(targetState)
  };

  await db.updateWorkflowState(diagramId, updatedState);
  return await db.getWorkflowState(diagramId);
}
```

### 2. Tool Responses with Workflow Guidance

Each tool provides clear guidance about the current workflow state and possible next steps:

```typescript
return createToolResponse(message, {
  diagramId: diagram.id,
  workflowState: updatedState,  // Current workflow state information
  entityIds: entityMappings      // IDs of diagram elements
});
```

### 3. Navigation Tool

A special tool allows explicitly navigating between workflow states, providing flexibility while maintaining structure:

```typescript
server.tool(
  "navigate-workflow",
  `Navigate to a different step in the guided workflow.
    
    Required Input Fields:
    - diagramId: String (UUID from createC4Diagram)
    - targetState: String (The workflow state to navigate to)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.`,
  {
    diagramId: z.string(),
    targetState: z.enum([
      DiagramWorkflowState.INITIAL,
      DiagramWorkflowState.SYSTEM_IDENTIFICATION,
      DiagramWorkflowState.ACTOR_DISCOVERY,
      DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION,
      DiagramWorkflowState.RELATIONSHIP_DEFINITION,
      DiagramWorkflowState.REFINEMENT,
      DiagramWorkflowState.COMPLETE
    ])
  },
  async ({ diagramId, targetState }) => {
    try {
      // Update workflow state
      const updatedState = await updateWorkflowState(
        db, 
        diagramId, 
        targetState as DiagramWorkflowState
      );
      
      // Get diagram details
      const diagram = await db.getDiagram(diagramId);
      if (!diagram) {
        throw new Error(`Diagram not found: ${diagramId}`);
      }

      // Create helpful guidance message based on the target state
      const message = getGuidanceForState(targetState, diagram);
      
      // Build entity ID mappings to help the LLM reference existing elements
      const entityMappings = buildEntityMappings(diagram);

      return createToolResponse(message, {
        diagramId: diagram.id,
        workflowState: updatedState,
        entityIds: entityMappings
      });
    }
    catch (error) {
      return createErrorResponse(`Error navigating workflow: ${getErrorMessage(error)}`);
    }
  }
);
```

## Extending to Multiple Diagram Types

To expand our implementation beyond Context diagrams, we'll:

1. **Create Specialized Entry Points**:
   ```typescript
   // Context Diagram (C1) Entry Point
   server.tool(
     "createContextDiagram",
     `Create a new C4 Context diagram and start the guided modeling process.
      
      This diagram type shows the high-level interactions between your system, 
      its users, and external dependencies. Use this when you need a big picture
      view that business stakeholders can understand.`,
     {
       title: z.string(),
       description: z.string().optional()
     },
     // Implementation...
   );
   
   // Container Diagram (C2) Entry Point
   server.tool(
     "createContainerDiagram",
     `Create a new C4 Container diagram and start the guided modeling process.
      
      This diagram type shows the internal architecture of your system, including 
      applications, services, and data stores. Use this when you need to show how
      responsibilities are distributed within your system.`,
     {
       title: z.string(),
       description: z.string().optional(),
       contextDiagramId: z.string().optional()  // Optional reference to parent context diagram
     },
     // Implementation...
   );
   
   // Similar implementations for Component and Code diagrams...
   ```

2. **Extend Workflow States**:
   Add states specific to each diagram type while sharing common states like relationship definition.
   
3. **Implement Diagram Type-Specific Tools**:
   ```typescript
   // Container-specific tool example
   server.tool(
     "add-container",
     `Add a container to your C4 Container diagram.
      
      Containers are separately runnable/deployable units that execute code or store data.`,
     {
       diagramId: z.string(),
       name: z.string(),
       description: z.string(),
       technology: z.string().optional()
     },
     // Implementation...
   );
   ```

4. **Enable Cross-Diagram References**:
   Allow referencing elements from parent diagrams to maintain consistent naming and traceability.

## Workflow Visualization

To help users understand where they are in the workflow, each state transition includes clear guidance about:

1. What was just accomplished
2. What the current state is focused on 
3. What the possible next steps are

This creates a natural, guided conversation flow that doesn't feel forced or rigid.

## Benefits of Our Approach

1. **Natural Conversation**: Users interact through normal conversation while the AI tracks workflow progression
2. **Structured Process**: The workflow ensures all necessary diagram elements are covered
3. **Flexibility**: Users can move between workflow states as needed
4. **Multiple Diagram Types**: Support for the complete C4 model's progressive detail levels
5. **Explicit Guidance**: Clear indications of the current step and next possibilities
6. **Diagram Evolution**: Support for refining existing diagrams

By implementing our four distinct entry points with the Extended Unified Workflow, we'll provide comprehensive C4 architecture diagramming capabilities in a natural, conversational interface.
