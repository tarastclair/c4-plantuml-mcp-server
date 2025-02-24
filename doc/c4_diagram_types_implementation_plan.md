# C4 Diagram Types Implementation Plan

## Overview

This document outlines our implementation plan for extending the PlantUML MCP Server to support all four C4 model diagram types: Context (C1), Container (C2), Component (C3), and Code (C4). We'll use the Extended Unified Workflow approach with distinct entry points for each diagram type.

## 1. Extended Workflow State Implementation

### Phase 1: Update Workflow State Enum

1. Extend the `DiagramWorkflowState` enum in `workflow-state.ts` to include all states:

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
  
  // Container (C2) diagram states
  CONTAINER_IDENTIFICATION = 'container-identification',
  CONTAINER_DATABASE_IDENTIFICATION = 'container-database-identification',
  
  // Component (C3) diagram states
  COMPONENT_IDENTIFICATION = 'component-identification',
  COMPONENT_RESPONSIBILITY_DEFINITION = 'component-responsibility-definition',
  
  // Code (C4) diagram states
  CLASS_IDENTIFICATION = 'class-identification',
  METHOD_IDENTIFICATION = 'method-identification',
  
  // Shared states
  RELATIONSHIP_DEFINITION = 'relationship-definition',
}
```

### Phase 2: Update State Machine Transitions

Expand the `ALLOWED_TRANSITIONS` map to include all valid transitions for each state:

```typescript
export const ALLOWED_TRANSITIONS: Record<DiagramWorkflowState, DiagramWorkflowState[]> = {
  // Existing Context diagram transitions...
  
  // Container diagram transitions
  [DiagramWorkflowState.CONTAINER_IDENTIFICATION]: [
    DiagramWorkflowState.CONTAINER_DATABASE_IDENTIFICATION,
    DiagramWorkflowState.RELATIONSHIP_DEFINITION,
    DiagramWorkflowState.REFINEMENT,
  ],
  [DiagramWorkflowState.CONTAINER_DATABASE_IDENTIFICATION]: [
    DiagramWorkflowState.CONTAINER_DATABASE_IDENTIFICATION,
    DiagramWorkflowState.CONTAINER_IDENTIFICATION,
    DiagramWorkflowState.RELATIONSHIP_DEFINITION,
    DiagramWorkflowState.REFINEMENT,
  ],
  
  // Component diagram transitions...
  
  // Code diagram transitions...
};
```

### Phase 3: Update WorkflowStateContext Interface

Extend the `WorkflowStateContext` interface to include diagram type:

```typescript
export interface WorkflowStateContext {
  currentState: DiagramWorkflowState;
  nextState: DiagramWorkflowState;
  diagramType: 'context' | 'container' | 'component' | 'code';  // Add this field
}
```

## 2. Database Schema Updates

### Phase 1: Add Diagram Type to C4Diagram

1. Update the `C4Diagram` interface in `types-and-interfaces.ts`:

```typescript
export interface C4Diagram {
  id: string;
  name: string;
  diagramType: 'context' | 'container' | 'component' | 'code';  // Add this field
  parentDiagramId?: string;  // Optional reference to parent diagram
  description?: string;
  elements: C4Element[];
  relationships: C4Relationship[];
  created: string;
  updated: string;
  metadata?: Record<string, unknown>;
  workflowState?: WorkflowStateContext;
}
```

### Phase 2: Extend Element Types

1. Update the `ElementType` to include all C4 element types:

```typescript
export type ElementType = 
  // Context diagram elements
  'system' | 'person' | 'external-system' |
  
  // Container diagram elements
  'container' | 'database' |
  
  // Component diagram elements
  'component' |
  
  // Code diagram elements
  'class' | 'interface';
```

### Phase 3: Add Parent Reference Support

1. Add methods to the `DiagramDb` class for retrieving connected diagrams:

```typescript
async getChildDiagrams(diagramId: string): Promise<C4Diagram[]> {
  return this.db.data.diagrams.filter(d => d.parentDiagramId === diagramId);
}

async getParentDiagram(diagramId: string): Promise<C4Diagram | null> {
  const diagram = await this.getDiagram(diagramId);
  if (!diagram || !diagram.parentDiagramId) return null;
  return this.getDiagram(diagram.parentDiagramId);
}
```

## 3. Entry Point Tools Implementation

### Phase 1: Rename Existing Tool (for backward compatibility)

1. Create a new version of `registerCreateC4DiagramTool.ts` that's equivalent to the current implementation but with the name updated:

```typescript
export const registerCreateContextDiagramTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "createContextDiagram",
    `Create a new C4 Context diagram and start the guided modeling process.
    
    This diagram type shows the high-level interactions between your system, 
    its users, and external dependencies. Use this when you need a big picture
    view that business stakeholders can understand.
    
    Required Input Fields:
    - title: String (The name of your system/diagram)
    - description: String (A brief explanation of what the diagram represents)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.`,
    // Rest of implementation...
  );
  
  // Keep existing implementation for backward compatibility
  server.tool(
    "createC4Diagram",
    `Create a new C4 Context diagram and start the guided modeling process.
    
    Required Input Fields:
    - title: String (The name of your system/diagram)
    - description: String (A brief explanation of what the diagram represents)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.`,
    // Same implementation as above
  );
};
```

### Phase 2: Implement Container Diagram Entry Point

1. Create `registerCreateContainerDiagramTool.ts`:

```typescript
export const registerCreateContainerDiagramTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "createContainerDiagram",
    `Create a new C4 Container diagram and start the guided modeling process.
    
    This diagram type shows the internal architecture of your system, including 
    applications, services, and data stores. Use this when you need to show how
    responsibilities are distributed within your system.
    
    Required Input Fields:
    - title: String (The name of your system/diagram)
    - description: String (A brief explanation of what the diagram represents)
    - contextDiagramId: String (Optional - ID of a context diagram this container diagram relates to)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.`,
    {
      title: z.string().describe("Title for the new diagram"),
      description: z.string().optional().describe("Optional description of what the diagram represents"),
      contextDiagramId: z.string().optional().describe("Optional ID of a context diagram this container diagram relates to")
    },
    async ({ title, description, contextDiagramId }, extra) => {
      try {
        // Create a new diagram with type = container
        const diagram = await db.createDiagram(title, description, 'container', contextDiagramId);
        
        // Generate initial empty diagram
        try {
          const svg = await generateEmptyDiagram(diagram);
          await db.cacheDiagram(diagram.id, svg);
        } catch (diagramError) {
          console.warn(`Failed to generate initial diagram, but continuing with workflow: ${getErrorMessage(diagramError)}`);
        }
        
        // Initialize workflow state for container diagrams
        const initialState: WorkflowStateContext = {
          currentState: DiagramWorkflowState.INITIAL,
          nextState: DiagramWorkflowState.CONTAINER_IDENTIFICATION,
          diagramType: 'container'
        };
        await db.updateWorkflowState(diagram.id, initialState);
        
        // Update workflow to first container state
        const updatedState = await updateWorkflowState(db, diagram.id, DiagramWorkflowState.CONTAINER_IDENTIFICATION);
        
        // If we have a parent diagram, we can import the system
        let message = `Created new container diagram (UUID: ${diagram.id}). We need to start by identifying the containers within this system.`;
        if (contextDiagramId) {
          const parentDiagram = await db.getDiagram(contextDiagramId);
          if (parentDiagram) {
            message += ` This diagram is for the system "${parentDiagram.name}".`;
          }
        }
        
        const entityMappings = buildEntityMappings(diagram);
        
        return createToolResponse(message, {
          diagramId: diagram.id,
          workflowState: updatedState,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error creating diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};
```

### Phase 3: Implement Component Diagram Entry Point

Similar implementation to the container diagram entry point, but with component-specific workflow states.

### Phase 4: Implement Code Diagram Entry Point

Similar implementation to the container diagram entry point, but with code-specific workflow states.

## 4. Type-Specific Tool Implementation

### Phase 1: Container Diagram Tools

1. Create `registerAddContainerTool.ts`:

```typescript
export const registerAddContainerTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-container",
    `Add a container to your C4 Container diagram.
    
    Containers are separately runnable/deployable units that execute code or store data.
    
    Required Input Fields:
    - diagramId: String (UUID from createContainerDiagram)
    - name: String (Name of the container)
    - description: String (Description of what the container does)
    - technology: String (Optional - technology used by this container)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.`,
    {
      diagramId: z.string(),
      name: z.string(),
      description: z.string(),
      technology: z.string().optional()
    },
    async ({ diagramId, name, description, technology }, extra) => {
      try {
        // Add the container to the diagram
        const element = await db.addElement(diagramId, {
          type: 'container',
          name,
          description,
          metadata: technology ? { technology } : undefined
        });
        
        // Get the diagram for further operations
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram not found: ${diagramId}`);
        }
        
        // Generate updated diagram
        try {
          const svg = await generateDiagramFromState(diagram);
          await db.cacheDiagram(diagram.id, svg);
        } catch (diagramError) {
          console.warn(`Failed to generate diagram, but continuing with workflow: ${getErrorMessage(diagramError)}`);
        }
        
        // Get current workflow state
        const currentState = await db.getWorkflowState(diagramId);
        if (!currentState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }
        
        // Build entity ID mappings
        const entityMappings = buildEntityMappings(diagram);
        
        // Create response message
        const message = `Added container: "${name}" to the diagram. Would you like to add another container or move on to defining databases or relationships?`;
        
        return createToolResponse(message, {
          diagramId: diagram.id,
          workflowState: currentState,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error adding container: ${getErrorMessage(error)}`);
      }
    }
  );
};
```

2. Create `registerAddDatabaseTool.ts`:

```typescript
export const registerAddDatabaseTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-database",
    `Add a database to your C4 Container diagram.
    
    Databases are specialized containers that store data.
    
    Required Input Fields:
    - diagramId: String (UUID from createContainerDiagram)
    - name: String (Name of the database)
    - description: String (Description of what data the database stores)
    - technology: String (Optional - database technology, e.g., PostgreSQL, MongoDB)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.`,
    {
      diagramId: z.string(),
      name: z.string(),
      description: z.string(),
      technology: z.string().optional()
    },
    async ({ diagramId, name, description, technology }, extra) => {
      try {
        // Add the database to the diagram
        const element = await db.addElement(diagramId, {
          type: 'database',  // Special container type for databases
          name,
          description,
          metadata: technology ? { technology } : undefined
        });
        
        // Rest of implementation similar to add-container...
        // Generate SVG, create response, etc.
        
        const message = `Added database: "${name}" to the diagram. Would you like to add more containers or databases, or move on to defining relationships?`;
        
        // Return response...
      } catch (error) {
        return createErrorResponse(`Error adding database: ${getErrorMessage(error)}`);
      }
    }
  );
};
```

### Phase 2: Component Diagram Tools

1. Create `registerAddComponentTool.ts`:

```typescript
export const registerAddComponentTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-component",
    `Add a component to your C4 Component diagram.
    
    Components are encapsulated units of functionality within a container.
    
    Required Input Fields:
    - diagramId: String (UUID from createComponentDiagram)
    - name: String (Name of the component)
    - description: String (Description of the component's responsibility)
    - technology: String (Optional - technology used by the component)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.`,
    {
      diagramId: z.string(),
      name: z.string(),
      description: z.string(),
      technology: z.string().optional()
    },
    // Implementation follows similar pattern to add-container
  );
};
```

### Phase 3: Code Diagram Tools

1. Create `registerAddClassTool.ts`:

```typescript
export const registerAddClassTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-class",
    `Add a class to your C4 Code diagram.
    
    Classes represent the implementation details of components.
    
    Required Input Fields:
    - diagramId: String (UUID from createCodeDiagram)
    - name: String (Name of the class)
    - description: String (Description of the class's purpose)
    - methods: Array (Optional - list of method definitions)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    as well as a state object that will direct you to the appropriate next step to take.`,
    {
      diagramId: z.string(),
      name: z.string(),
      description: z.string(),
      methods: z.array(z.object({
        name: z.string(),
        description: z.string().optional()
      })).optional()
    },
    // Implementation follows similar pattern to add-container
  );
};
```

## 5. PlantUML Integration Updates

### Phase 1: Update Diagram Type-Specific Imports

Modify the `generateDiagramFromState` function in `plantuml-utils.ts` to use the appropriate C4 PlantUML imports based on diagram type:

```typescript
export const generateDiagramFromState = async (diagram: C4Diagram): Promise<string> => {
  const lines: string[] = [];
  
  // Header with proper C4 PlantUML import based on diagram type
  lines.push('@startuml');
  
  switch (diagram.diagramType) {
    case 'context':
      lines.push('!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml');
      break;
    case 'container':
      lines.push('!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml');
      break;
    case 'component':
      lines.push('!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml');
      break;
    case 'code':
      lines.push('!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Code.puml');
      break;
    default:
      // Default to Context
      lines.push('!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml');
  }
  
  lines.push('');
  
  // Title and description
  lines.push(`title ${diagram.name}`);
  if (diagram.description) {
    lines.push('');
    lines.push(`note as DiagramDescription`);
    lines.push(diagram.description);
    lines.push('end note');
  }
  lines.push('');
  
  // Rest of function implementation...
}
```

### Phase 2: Add Diagram Type-Specific Element Rendering

Update the element rendering logic to handle all C4 element types:

```typescript
// Add elements by type
diagram.elements.forEach(element => {
  const id = element.id.replace(/[^\w]/g, '_');
  const name = element.name;
  const description = element.description;
  const technology = element.metadata?.technology as string || '';
  
  switch (element.type) {
    // Context diagram elements
    case 'system':
      lines.push(`System(${id}, "${name}", "${description}")`);
      break;
    case 'person':
      lines.push(`Person(${id}, "${name}", "${description}")`);
      break;
    case 'external-system':
      lines.push(`System_Ext(${id}, "${name}", "${description}")`);
      break;
    
    // Container diagram elements
    case 'container':
      lines.push(`Container(${id}, "${name}", "${technology}", "${description}")`);
      break;
    case 'database':
      lines.push(`ContainerDb(${id}, "${name}", "${technology}", "${description}")`);
      break;
    
    // Component diagram elements
    case 'component':
      lines.push(`Component(${id}, "${name}", "${technology}", "${description}")`);
      break;
    
    // Code diagram elements
    case 'class':
      lines.push(`Class(${id}, "${name}", "${description}")`);
      break;
    case 'interface':
      lines.push(`Interface(${id}, "${name}", "${description}")`);
      break;
  }
});
```

## 6. Navigation Tool Updates

### Phase 1: Extend Navigation Tool for All Diagram Types

Update the `registerNavigateWorkflowTool.ts` to support all diagram types:

```typescript
export const registerNavigateWorkflowTool = (server: McpServer, db: DiagramDb): void => {
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
        // Common states
        DiagramWorkflowState.INITIAL,
        DiagramWorkflowState.REFINEMENT,
        DiagramWorkflowState.COMPLETE,
        
        // Context diagram states
        DiagramWorkflowState.SYSTEM_IDENTIFICATION,
        DiagramWorkflowState.ACTOR_DISCOVERY,
        DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION,
        
        // Container diagram states
        DiagramWorkflowState.CONTAINER_IDENTIFICATION,
        DiagramWorkflowState.CONTAINER_DATABASE_IDENTIFICATION,
        
        // Component diagram states
        DiagramWorkflowState.COMPONENT_IDENTIFICATION,
        DiagramWorkflowState.COMPONENT_RESPONSIBILITY_DEFINITION,
        
        // Code diagram states
        DiagramWorkflowState.CLASS_IDENTIFICATION,
        DiagramWorkflowState.METHOD_IDENTIFICATION,
        
        // Shared states
        DiagramWorkflowState.RELATIONSHIP_DEFINITION
      ])
    },
    // Implementation...
  );
};
```

### Phase 2: Create Diagram Type-Specific Guidance Messages

Update the `getGuidanceForState` function to provide diagram type-specific guidance:

```typescript
function getGuidanceForState(
  state: DiagramWorkflowState, 
  diagram: C4Diagram
): string {
  // Get diagram type-specific messages
  const diagramType = diagram.workflowState?.diagramType || 'context';
  
  switch (state) {
    // Common states
    case DiagramWorkflowState.INITIAL:
      return `This diagram is in its initial state. Let's begin creating your ${diagramType} diagram.`;
    
    case DiagramWorkflowState.REFINEMENT:
      return `We need to refine the diagram. Where are there opportunities for improvement?`;
    
    case DiagramWorkflowState.COMPLETE:
      return `The diagram is complete.`;
    
    // Context diagram states
    case DiagramWorkflowState.SYSTEM_IDENTIFICATION:
      return `We need to identify the core system. What is it called, and what does it do?`;
    
    case DiagramWorkflowState.ACTOR_DISCOVERY:
      return `We need to identify the users or actors who interact with this system.`;
    
    case DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION:
      return `We need to identify or modify external systems. What other systems does this system interact with?`;
    
    // Container diagram states
    case DiagramWorkflowState.CONTAINER_IDENTIFICATION:
      return `We need to identify the containers within this system. What are the main applications, microservices, or components that make up this system?`;
    
    case DiagramWorkflowState.CONTAINER_DATABASE_IDENTIFICATION:
      return `We need to identify any databases used in this system. What data stores does your system utilize?`;
    
    // Component diagram states
    case DiagramWorkflowState.COMPONENT_IDENTIFICATION:
      return `We need to identify the components that make up this container. What are the main functional components?`;
    
    // Code diagram states
    case DiagramWorkflowState.CLASS_IDENTIFICATION:
      return `We need to identify the classes that implement this component. What are the key classes in this implementation?`;
    
    // Shared states
    case DiagramWorkflowState.RELATIONSHIP_DEFINITION:
      return `Now we need to define the relationships between these elements.`;
    
    default:
      return `We're now at the ${state} stage of creating your ${diagramType} diagram.`;
  }
}
```

## 7. Development and Release Strategy

We'll implement this plan in stages to ensure we can deliver value incrementally:

### Phase 1: Foundation Update (Sprint 1)

1. Update database schema with diagram type field
2. Extend workflow state enum and transitions
3. Rename existing `createC4Diagram` tool to `createContextDiagram` with backward compatibility

### Phase 2: Container Diagrams (Sprint 2)

1. Implement Container diagram entry point
2. Implement Container-specific tools (add-container, add-database)
3. Update PlantUML generation for Container diagrams
4. Test Container diagram workflow end-to-end

### Phase 3: Component Diagrams (Sprint 3)

1. Implement Component diagram entry point
2. Implement Component-specific tools
3. Update PlantUML generation for Component diagrams
4. Test Component diagram workflow end-to-end

### Phase 4: Code Diagrams (Sprint 4)

1. Implement Code diagram entry point
2. Implement Code-specific tools
3. Update PlantUML generation for Code diagrams
4. Test Code diagram workflow end-to-end

### Phase 5: Cross-Diagram Integration (Sprint 5)

1. Implement parent/child diagram relationships
2. Add diagram linking capabilities
3. Create tools for transitioning between diagram levels
4. Test end-to-end workflows spanning multiple diagram types

## 8. Testing Strategy

For each phase, we'll test:

1. **Entry Point Testing**: Verify the entry point tool creates diagrams of the appropriate type
2. **Workflow Navigation**: Ensure all state transitions work correctly
3. **Element Creation**: Test adding all element types specific to that diagram level
4. **Relationship Creation**: Test defining relationships between elements
5. **PlantUML Generation**: Verify the generated PlantUML syntax is correct
6. **Diagram Visualization**: Ensure the visualization looks correct
7. **Integration Testing**: Test end-to-end workflows

## 9. Documentation Updates

For each phase, we'll update:

1. **README.md**: Add information about the new diagram type
2. **Example workflows**: Create example workflows for each diagram type
3. **User guidance**: Update guidance messages for the new diagram type
4. **Development docs**: Update developer documentation with new features

## 10. Future Considerations

- **Diagram Templates**: Add predefined templates for common architecture patterns
- **Batch Operations**: Support for adding multiple elements at once
- **Visual Editor**: Consider adding a visual diagram editor interface
- **Export Options**: Expand export capabilities (PNG, SVG, PDF)
- **Versioning**: Add support for versioning diagrams
- **Collaboration**: Add multi-user collaboration features

By following this implementation plan, we'll systematically extend our PlantUML MCP Server to support all four C4 model diagram types, providing a comprehensive solution for architectural documentation.
