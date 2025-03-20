// Project represents a collection of related C4 diagrams
export interface Project {
    id: string;
    name: string;
    description?: string;
    rootPath: string;
    diagrams: C4Diagram[];
    created: string;
    updated: string;
    metadata?: Record<string, unknown>;
}

// Enum representing the different types of C4 diagrams
export enum DiagramType {
    CONTEXT = 'context',
    CONTAINER = 'container',
    COMPONENT = 'component',
    CODE = 'code'
}

// Base element types that can appear in C4 diagrams
export type BaseElementType = 
    | 'system'
    | 'person'
    | 'container'
    | 'component'
    | 'class'
    | 'interface';

// Variants that modify the visual representation of elements
export type ElementVariant =
    | 'standard'  // Default
    | 'external'  // External to the system  
    | 'db'        // Database
    | 'queue'     // Message queue
    | 'boundary'; // Boundary element

// Composite type descriptor for elements
export interface ElementDescriptor {
    baseType: BaseElementType;
    variant: ElementVariant;
    boundaryType?: 'system' | 'container'; // Only for boundary variant
}

// C4 diagram element with composite type descriptor
export interface C4Element {
    id: string;
    descriptor: ElementDescriptor;  // Composite type descriptor
    name: string;
    description: string;
    technology?: string;  // For container and component elements
    parentId?: string;  // Reference to parent boundary element
    metadata?: Record<string, unknown>;
}

export interface C4Relationship {
    id: string;
    sourceId: string;
    targetId: string;
    description: string;
    technology?: string;
    metadata?: Record<string, unknown>;
}

// Represents a C4 architecture diagram
export interface C4Diagram {
    projectId: string;
    id: string;
    name: string;
    description?: string;
    diagramType: DiagramType;
    pumlPath: string;
    pngPath: string;
    elements: C4Element[];
    relationships: C4Relationship[];
    created: string;
    updated: string;
    metadata?: Record<string, unknown>;
}

// Database schema
export interface DatabaseSchema {
    projects: Project[];
}

// Database interface
export interface DiagramStorage {
    // Project operations
    createProject(project: Project): Promise<Project>;
    getProject(id: string): Promise<Project | null>;
    updateProject(id: string, updates: Partial<Project>): Promise<Project>;
    listProjects(): Promise<Project[]>;
    
    // Diagram operations - updated to include projectId
    createDiagram(projectId: string, name: string, description?: string, 
                  diagramType?: DiagramType, pumlPath?: string, pngPath?: string): Promise<C4Diagram>;
    getDiagram(projectId: string, diagramId: string): Promise<C4Diagram | null>;
    updateDiagram(projectId: string, diagramId: string, updates: Partial<C4Diagram>): Promise<C4Diagram>;
    listDiagrams(projectId: string): Promise<C4Diagram[]>;
    
    // Element operations - updated to include projectId
    addElement(projectId: string, diagramId: string, element: Omit<C4Element, 'id'>): Promise<C4Element>;
    updateElement(projectId: string, diagramId: string, elementId: string, updates: Partial<C4Element>): Promise<C4Element>;
    
    // Relationship operations - updated to include projectId
    addRelationship(projectId: string, diagramId: string, relationship: Omit<C4Relationship, 'id'>): Promise<C4Relationship>;
    updateRelationship(projectId: string, diagramId: string, relationshipId: string, updates: Partial<C4Relationship>): Promise<C4Relationship>;
    
    // Helper methods
    findDiagramByName(projectId: string, name: string, diagramType: DiagramType): Promise<C4Diagram | null>;
    findDiagramsByFilePath(pattern: string): Promise<C4Diagram[]>;
}
