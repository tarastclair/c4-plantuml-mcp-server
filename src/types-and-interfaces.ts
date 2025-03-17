// Project represents a collection of related C4 diagrams
export interface Project {
    id: string;
    name: string;
    description?: string;
    rootPath: string;
    diagrams: string[];
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
    boundaryType?: 'enterprise' | 'system' | 'container'; // Only for boundary variant
}

// C4 diagram element with composite type descriptor
export interface C4Element {
    id: string;
    descriptor: ElementDescriptor;  // Composite type descriptor
    name: string;
    description: string;
    technology?: string;  // For container and component elements
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

export interface DiagramCache {
    diagramId: string;
    diagram: string;
    generated: string;
}

// Database schema
export interface DatabaseSchema {
    diagrams: C4Diagram[];
    diagramCache: DiagramCache[];
}

// Database interface
export interface DiagramStorage {
    // Diagram operations
    createDiagram(name: string, description?: string): Promise<C4Diagram>;
    getDiagram(id: string): Promise<C4Diagram | null>;
    updateDiagram(id: string, updates: Partial<C4Diagram>): Promise<C4Diagram>;
    deleteDiagram(id: string): Promise<void>;
    listDiagrams(): Promise<C4Diagram[]>;
    
    // Element operations
    addElement(diagramId: string, element: Omit<C4Element, 'id'>): Promise<C4Element>;
    updateElement(diagramId: string, elementId: string, updates: Partial<C4Element>): Promise<C4Element>;
    deleteElement(diagramId: string, elementId: string): Promise<void>;
    
    // Relationship operations
    addRelationship(diagramId: string, relationship: Omit<C4Relationship, 'id'>): Promise<C4Relationship>;
    updateRelationship(diagramId: string, relationshipId: string, updates: Partial<C4Relationship>): Promise<C4Relationship>;
    deleteRelationship(diagramId: string, relationshipId: string): Promise<void>;
    
    // Diagram cache operations
    cacheDiagram(diagramId: string, diagram: string): Promise<void>;
    getCachedDiagram(diagramId: string): Promise<string | null>;
    clearDiagramCache(diagramId: string): Promise<void>;
}
