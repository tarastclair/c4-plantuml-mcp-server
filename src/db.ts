import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
    C4Diagram, 
    C4Element, 
    C4Relationship, 
    DatabaseSchema, 
    DiagramStorage,
    SVGCache
} from './types-and-interfaces.js';
import { createInitialWorkflowState, WorkflowStateContext } from './workflow-state.js';

/**
 * Implements storage for C4 diagrams using lowdb
 * 
 * We chose lowdb because:
 * 1. It provides atomic file operations
 * 2. Handles JSON storage/retrieval safely
 * 3. Simple to use for our POC needs
 * 4. No complex setup required
 */
export class DiagramDb implements DiagramStorage {
    private db: Low<DatabaseSchema>;

    constructor(dbPath: string) {
        // Ensure we have a consistent db file location
        const adapter = new JSONFile<DatabaseSchema>(join(dbPath, 'diagrams.json'));
        this.db = new Low(adapter, { diagrams: [], svgCache: [] });
    }

    /**
     * Initialize the database and ensure default structure
     * Only needs to be called once when the server starts
     */
    async initialize(): Promise<void> {
        await this.db.read();
        
        // Ensure we have our collections
        if (!this.db.data) {
            this.db.data = { diagrams: [], svgCache: [] };
            await this.db.write();
        }
    }

    /**
     * Create a new C4 diagram
     * Generates a unique ID and timestamps
     * Initializes workflow state
     */
    async createDiagram(name: string, description?: string): Promise<C4Diagram> {
        const now = new Date().toISOString();
        const diagram: C4Diagram = {
            id: uuidv4(),
            name,
            description,
            elements: [],
            relationships: [],
            created: now,
            updated: now,
            workflowState: createInitialWorkflowState()
        };

        this.db.data.diagrams.push(diagram);
        await this.db.write();
        return diagram;
    }

    /**
     * Retrieve a diagram by ID
     * Returns null if not found to simplify error handling
     */
    async getDiagram(id: string): Promise<C4Diagram | null> {
        const diagram = this.db.data.diagrams.find(d => d.id === id);
        return diagram || null;
    }

    /**
     * Update a diagram's properties
     * Throws error if diagram not found to ensure data consistency
     */
    async updateDiagram(id: string, updates: Partial<C4Diagram>): Promise<C4Diagram> {
        const index = this.db.data.diagrams.findIndex(d => d.id === id);
        if (index === -1) {
            throw new Error(`Diagram not found: ${id}`);
        }

        const diagram = this.db.data.diagrams[index];
        const updated = {
            ...diagram,
            ...updates,
            updated: new Date().toISOString()
        };

        this.db.data.diagrams[index] = updated;
        await this.db.write();
        return updated;
    }

    /**
     * Update workflow state for a diagram
     * @param diagramId ID of the diagram
     * @param workflowState New workflow state to set
     */
    async updateWorkflowState(diagramId: string, workflowState: WorkflowStateContext): Promise<void> {
        const diagram = await this.getDiagram(diagramId);
        if (!diagram) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }
        
        diagram.workflowState = workflowState;
        diagram.updated = new Date().toISOString();
        await this.db.write();
    }

    /**
     * Get workflow state for a diagram
     * @param diagramId ID of the diagram
     * @returns Current workflow state or null if diagram not found
     */
    async getWorkflowState(diagramId: string): Promise<WorkflowStateContext | null> {
        const diagram = await this.getDiagram(diagramId);
        if (!diagram) {
            return null;
        }
        
        return diagram.workflowState || createInitialWorkflowState();
    }

    /**
     * Delete a diagram and its cached SVG
     */
    async deleteDiagram(id: string): Promise<void> {
        this.db.data.diagrams = this.db.data.diagrams.filter(d => d.id !== id);
        this.db.data.svgCache = this.db.data.svgCache.filter(c => c.diagramId !== id);
        await this.db.write();
    }

    /**
     * List all diagrams
     * Returns empty array if none exist
     */
    async listDiagrams(): Promise<C4Diagram[]> {
        return this.db.data.diagrams;
    }

    /**
     * Add a new element to a diagram
     * Generates unique ID and updates diagram timestamp
     */
    async addElement(diagramId: string, element: Omit<C4Element, 'id'>): Promise<C4Element> {
        const diagram = await this.getDiagram(diagramId);
        if (!diagram) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }

        const newElement: C4Element = {
            ...element,
            id: uuidv4()
        };

        diagram.elements.push(newElement);
        diagram.updated = new Date().toISOString();
        await this.db.write();
        
        return newElement;
    }

    /**
     * Update an existing element
     * Maintains element ID and updates diagram timestamp
     */
    async updateElement(diagramId: string, elementId: string, updates: Partial<C4Element>): Promise<C4Element> {
        const diagram = await this.getDiagram(diagramId);
        if (!diagram) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }

        const elementIndex = diagram.elements.findIndex(e => e.id === elementId);
        if (elementIndex === -1) {
            throw new Error(`Element not found: ${elementId}`);
        }

        const element = diagram.elements[elementIndex];
        const updated = { ...element, ...updates };
        
        diagram.elements[elementIndex] = updated;
        diagram.updated = new Date().toISOString();
        await this.db.write();
        
        return updated;
    }

    /**
     * Delete an element and any relationships that reference it
     * Updates diagram timestamp
     */
    async deleteElement(diagramId: string, elementId: string): Promise<void> {
        const diagram = await this.getDiagram(diagramId);
        if (!diagram) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }

        // Remove element
        diagram.elements = diagram.elements.filter(e => e.id !== elementId);
        
        // Remove any relationships that reference this element
        diagram.relationships = diagram.relationships.filter(r => 
            r.sourceId !== elementId && r.targetId !== elementId
        );

        diagram.updated = new Date().toISOString();
        await this.db.write();
    }

    /**
     * Add a new relationship between elements
     * Validates that both elements exist
     */
    async addRelationship(diagramId: string, relationship: Omit<C4Relationship, 'id'>): Promise<C4Relationship> {
        const diagram = await this.getDiagram(diagramId);
        if (!diagram) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }

        // Validate that both elements exist
        const sourceExists = diagram.elements.some(e => e.id === relationship.sourceId);
        const targetExists = diagram.elements.some(e => e.id === relationship.targetId);
        
        if (!sourceExists || !targetExists) {
            throw new Error('Source or target element not found');
        }

        const newRelationship: C4Relationship = {
            ...relationship,
            id: uuidv4()
        };

        diagram.relationships.push(newRelationship);
        diagram.updated = new Date().toISOString();
        await this.db.write();
        
        return newRelationship;
    }

    /**
     * Update an existing relationship
     * Validates element references if they're being changed
     */
    async updateRelationship(diagramId: string, relationshipId: string, updates: Partial<C4Relationship>): Promise<C4Relationship> {
        const diagram = await this.getDiagram(diagramId);
        if (!diagram) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }

        const relationshipIndex = diagram.relationships.findIndex(r => r.id === relationshipId);
        if (relationshipIndex === -1) {
            throw new Error(`Relationship not found: ${relationshipId}`);
        }

        const relationship = diagram.relationships[relationshipIndex];
        
        // If updating source/target, validate they exist
        if (updates.sourceId || updates.targetId) {
            const sourceId = updates.sourceId || relationship.sourceId;
            const targetId = updates.targetId || relationship.targetId;
            
            const sourceExists = diagram.elements.some(e => e.id === sourceId);
            const targetExists = diagram.elements.some(e => e.id === targetId);
            
            if (!sourceExists || !targetExists) {
                throw new Error('Source or target element not found');
            }
        }

        const updated = { ...relationship, ...updates };
        diagram.relationships[relationshipIndex] = updated;
        diagram.updated = new Date().toISOString();
        await this.db.write();
        
        return updated;
    }

    /**
     * Delete a relationship
     * Updates diagram timestamp
     */
    async deleteRelationship(diagramId: string, relationshipId: string): Promise<void> {
        const diagram = await this.getDiagram(diagramId);
        if (!diagram) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }

        diagram.relationships = diagram.relationships.filter(r => r.id !== relationshipId);
        diagram.updated = new Date().toISOString();
        await this.db.write();
    }

    /**
     * Cache an SVG for a diagram
     * Replaces existing cache if present
     */
    async cacheSVG(diagramId: string, svg: string): Promise<void> {
        const cacheIndex = this.db.data.svgCache.findIndex(c => c.diagramId === diagramId);
        const cache: SVGCache = {
            diagramId,
            svg,
            generated: new Date().toISOString()
        };

        if (cacheIndex === -1) {
            this.db.data.svgCache.push(cache);
        } else {
            this.db.data.svgCache[cacheIndex] = cache;
        }

        await this.db.write();
    }

    /**
     * Retrieve cached SVG for a diagram
     * Returns null if no cache exists
     */
    async getCachedSVG(diagramId: string): Promise<string | null> {
        const cache = this.db.data.svgCache.find(c => c.diagramId === diagramId);
        return cache?.svg || null;
    }

    /**
     * Clear cached SVG for a diagram
     */
    async clearSVGCache(diagramId: string): Promise<void> {
        this.db.data.svgCache = this.db.data.svgCache.filter(c => c.diagramId !== diagramId);
        await this.db.write();
    }
}