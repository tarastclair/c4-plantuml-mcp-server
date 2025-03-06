// Core types for C4 elements
export type ElementType = 'system' | 'person' | 'external-system';

export interface C4Element {
    id: string;
    type: ElementType;
    name: string;
    description: string;
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

export interface C4Diagram {
    id: string;
    name: string;
    description?: string;
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

// Database interface (operations we'll need)
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
