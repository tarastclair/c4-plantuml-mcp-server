# Required Changes to Existing Codebase

This document outlines the necessary changes to our existing codebase to support the extension to all C4 diagram types (C1-C4) while simplifying our approach.

## Database Schema Changes

### New Project Structure

Add a new top-level Project entity:

```typescript
export interface Project {
  id: string;
  name: string;
  description?: string;
  rootPath: string;  // Top-level filesystem location
  diagrams: string[];  // IDs of diagrams in this project
  created: string;
  updated: string;
  metadata?: Record<string, unknown>;
}
```

### Updated Diagram Structure

Modify the C4Diagram interface to support diagram types:

```typescript
export enum DiagramType {
  CONTEXT = 'context',
  CONTAINER = 'container',
  COMPONENT = 'component',
  CODE = 'code'
}

export interface C4Diagram {
  id: string;
  name: string;
  description?: string;
  diagramType: DiagramType;  // New field to identify diagram type
  
  // File paths for persistence
  pumlPath: string;
  pngPath: string;
  
  elements: C4Element[];
  relationships: C4Relationship[];
  created: string;
  updated: string;
  metadata?: Record<string, unknown>;  // Can store source element name here if needed
  
  // Remove workflowState field and explicit parent-child relationships
}
```

### Expanded Element Types

Extend the ElementType to support all C4 diagram levels:

```typescript
export type ElementType = 
  // Context diagram elements
  | 'system' 
  | 'person' 
  | 'external-system' 
  // Container diagram elements
  | 'container'
  | 'container-db'
  | 'container-queue'
  | 'container-web'
  | 'container-mobile'
  | 'external-container'
  // Component diagram elements
  | 'component'
  | 'component-db'
  | 'component-queue'
  | 'external-component'
  // Code diagram elements
  | 'class'
  | 'interface'
  | 'package'
  // Boundary elements
  | 'system-boundary'
  | 'container-boundary';
```

### Enhanced C4Element Structure

```typescript
export interface C4Element {
  id: string;
  type: ElementType;
  name: string;
  description: string;
  technology?: string;  // Technology information (important for containers/components)
  metadata?: Record<string, unknown>;
}
```

## Database Interface Changes

Add new methods to the DiagramStorage interface:

```typescript
export interface DiagramStorage {
  // Project operations
  createProject(name: string, description?: string): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project>;
  listProjects(): Promise<Project[]>;
  
  // Existing operations (may need updates)
  createDiagram(
    name: string, 
    description?: string, 
    diagramType?: DiagramType,
    pumlPath?: string,
    pngPath?: string
  ): Promise<C4Diagram>;
  
  // Filesystem operations (to find related diagrams)
  findDiagramsByFilePath(pattern: string): Promise<C4Diagram[]>;
  findDiagramByName(projectId: string, name: string, diagramType: DiagramType): Promise<C4Diagram | null>;
  
  // ... other existing methods
}
```

## Files to Remove or Significantly Modify

1. **`workflow-state.ts`** - Remove entirely
2. **`navigateWorkflowTool.ts`** - Remove entirely
3. **`initialize.ts`** - Update to remove workflow state initialization

## PlantUML Generation Updates

Update the `plantuml-utils.ts` file to support different diagram types:

```typescript
// New function to get appropriate PlantUML include statement
export function getPlantUMLImports(diagramType: DiagramType): string {
  switch (diagramType) {
    case DiagramType.CONTEXT:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml';
    case DiagramType.CONTAINER:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml';
    case DiagramType.COMPONENT:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml';
    case DiagramType.CODE:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml'; // No Code-specific include
    default:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml';
  }
}
```

## New Tools to Implement

1. **Project Management Tools**
   - `create-arch-diagram`: Entry point for creating a new project
   - `set-diagram-save-location`: Set the filesystem location for a project

2. **Diagram Creation Tools**
   - `create-context-diagram`: Create a C1 diagram (update existing)
   - `create-container-diagram`: Create a C2 diagram
   - `create-component-diagram`: Create a C3 diagram
   - `create-code-diagram`: Create a C4 diagram

3. **Element Creation Tools**
   - For C2: `add-container`, `add-container-db`, etc.
   - For C3: `add-component`, `add-component-db`, etc.
   - For C4: `add-class`, `add-interface`, etc.

4. **Relationship Tools**
   - Update existing tools to work with all diagram types
   - Add type-specific relationship tools if needed

## Project Filesystem Structure

The filesystem structure is critical in our approach as it explicitly encodes diagram relationships:

```
/user-specified-path/project-name/
├── context/
│   ├── system-name.puml      # Level 1: Context diagram
│   └── system-name.png
├── container/
│   ├── system-name.puml      # Level 2: Container diagram for system-name
│   └── system-name.png
├── component/
│   ├── container-name.puml   # Level 3: Component diagram for container-name
│   └── container-name.png
└── code/
    ├── component-name.puml   # Level 4: Code diagram for component-name
    └── component-name.png
```

By maintaining consistent naming conventions and directory organization, diagrams at different levels are implicitly related without requiring explicit database relationships.

## Tool Response Updates

Remove workflow state references from tool responses:

```typescript
// Before
return createToolResponse(message, {
  diagramId: diagram.id,
  workflowState: updatedState, // This will be removed
  entityIds: entityMappings
});

// After
return createToolResponse(message, {
  diagramId: diagram.id,
  entityIds: entityMappings,
  projectId: project.id,
  // Maybe add filesystem information
  pumlPath: diagram.pumlPath
});
```

## Utilities for Diagram Content Analysis

```typescript
// Function to extract elements from existing PUML diagrams
export async function extractElementsFromPuml(pumlPath: string): Promise<{ 
  name: string, 
  type: string,
  description?: string
}[]> {
  // Implementation that parses PUML to extract elements
}

// Function to extract relationships from existing PUML diagrams
export async function extractRelationshipsFromPuml(pumlPath: string): Promise<{
  source: string,
  target: string,
  description: string,
  technology?: string
}[]> {
  // Implementation that parses PUML to extract relationships
}

// Function to find related diagrams based on naming conventions
export async function findRelatedDiagrams(
  projectPath: string,
  diagramName: string,
  diagramType: DiagramType
): Promise<{
  parent?: { path: string, type: DiagramType },
  children: { path: string, type: DiagramType }[]
}> {
  // Implementation that searches filesystem for related diagrams
}
```

## Tool Description Updates

All tools will need updated descriptions that provide guidance on filesystem-based relationships. For example:

```
This tool creates a new C4 Container diagram.

When using this tool, first ask the user:
1. What system this Container diagram is for
2. Whether you should check for an existing Context diagram with the same name

To properly reference existing diagrams, this tool will:
1. Look for a Context diagram with the same name in the context/ directory
2. Extract relevant information from that diagram if found
3. Save the new Container diagram in the container/ directory with the same name

Example file path convention:
- If creating a Container diagram for "Payment System":
  - Look for: context/Payment-System.puml
  - Save to: container/Payment-System.puml
```
