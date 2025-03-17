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
    DiagramCache,
    Project,
    DiagramType
} from './types-and-interfaces.js';

/**
 * Extended database schema to include projects
 */
export interface ExtendedDatabaseSchema extends DatabaseSchema {
    projects: Project[];
}

/**
 * Implements storage for C4 diagrams and projects using lowdb
 * 
 * We chose lowdb because:
 * 1. It provides atomic file operations
 * 2. Handles JSON storage/retrieval safely
 * 3. Simple to use for our POC needs
 * 4. No complex setup required
 */
export class DiagramDb implements DiagramStorage {
    private db: Low<ExtendedDatabaseSchema>;

    constructor(dbPath: string) {
        // Ensure we have a consistent db file location
        const adapter = new JSONFile<ExtendedDatabaseSchema>(join(dbPath, 'diagrams.json'));
        this.db = new Low(adapter, { 
            diagrams: [], 
            diagramCache: [],
            projects: [] 
        });
    }

    /**
     * Initialize the database and ensure default structure
     * Only needs to be called once when the server starts
     */
    async initialize(): Promise<void> {
        await this.db.read();
        
        // Ensure we have our collections
        if (!this.db.data) {
            this.db.data = { 
                diagrams: [], 
                diagramCache: [],
                projects: [] 
            };
            await this.db.write();
        }
        
        // If this is an upgraded database, ensure projects array exists
        if (!this.db.data.projects) {
            this.db.data.projects = [];
            await this.db.write();
        }
    }

    /**
     * Create a new project
     * @param project Project to create
     * @returns The created project
     */
    async createProject(project: Project): Promise<Project> {
        this.db.data.projects.push(project);
        await this.db.write();
        return project;
    }

    /**
     * Get a project by ID
     * @param id Project ID
     * @returns The project or null if not found
     */
    async getProject(id: string): Promise<Project | null> {
        const project = this.db.data.projects.find(p => p.id === id);
        return project || null;
    }

    /**
     * Update a project's properties
     * @param id Project ID
     * @param updates Partial project updates
     * @returns The updated project
     */
    async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
        const index = this.db.data.projects.findIndex(p => p.id === id);
        if (index === -1) {
            throw new Error(`Project not found: ${id}`);
        }

        const project = this.db.data.projects[index];
        const updated = {
            ...project,
            ...updates,
            updated: new Date().toISOString()
        };

        this.db.data.projects[index] = updated;
        await this.db.write();
        return updated;
    }

    /**
     * List all projects
     * @returns Array of all projects
     */
    async listProjects(): Promise<Project[]> {
        return this.db.data.projects;
    }

    /**
     * Find a diagram by name and type within a project
     * This is useful for our filesystem-based relationship approach
     * 
     * @param projectId Project containing the diagram
     * @param name Diagram name to look for
     * @param diagramType Type of diagram to find
     * @returns The matching diagram or null
     */
    async findDiagramByName(
        projectId: string, 
        name: string, 
        diagramType: DiagramType
    ): Promise<C4Diagram | null> {
        const diagrams = this.db.data.diagrams.filter(d => 
            d.diagramType === diagramType && 
            d.name.toLowerCase() === name.toLowerCase() &&
            // Check if this diagram belongs to the project
            this.db.data.projects.some(p => 
                p.id === projectId && 
                p.diagrams.includes(d.id)
            )
        );
        
        return diagrams.length > 0 ? diagrams[0] : null;
    }

    /**
     * Find diagrams by file path pattern
     * Useful for finding diagrams related by filesystem structure
     * 
     * @param pattern Path pattern to match against
     * @returns Array of matching diagrams
     */
    async findDiagramsByFilePath(pattern: string): Promise<C4Diagram[]> {
        return this.db.data.diagrams.filter(d => 
            d.pumlPath?.includes(pattern) || 
            d.pngPath?.includes(pattern)
        );
    }

    /**
     * Create a new C4 diagram with specified type and paths
     * Updated to support our enhanced C4Diagram interface
     */
    async createDiagram(
        name: string, 
        description?: string,
        diagramType: DiagramType = DiagramType.CONTEXT,
        pumlPath?: string,
        pngPath?: string
    ): Promise<C4Diagram> {
        const now = new Date().toISOString();
        const diagram: C4Diagram = {
            id: uuidv4(),
            name,
            description,
            diagramType,
            pumlPath: pumlPath || '',
            pngPath: pngPath || '',
            elements: [],
            relationships: [],
            created: now,
            updated: now,
        };

        this.db.data.diagrams.push(diagram);
        await this.db.write();
        return diagram;
    }

    /**
     * Add a diagram to a project
     * 
     * @param projectId Project ID
     * @param diagramId Diagram ID to add
     * @returns Updated project
     */
    async addDiagramToProject(projectId: string, diagramId: string): Promise<Project> {
        const project = await this.getProject(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }

        const diagram = await this.getDiagram(diagramId);
        if (!diagram) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }

        // Only add if not already in the project
        if (!project.diagrams.includes(diagramId)) {
            project.diagrams.push(diagramId);
            project.updated = new Date().toISOString();
            await this.updateProject(projectId, project);
        }

        return project;
    }

    // Keep existing methods, but update as needed
    // Only showing methods that need updates here

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
     * Delete a diagram and its cached diagram
     */
    async deleteDiagram(id: string): Promise<void> {
        this.db.data.diagrams = this.db.data.diagrams.filter(d => d.id !== id);
        this.db.data.diagramCache = this.db.data.diagramCache.filter(c => c.diagramId !== id);
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
     * Cache an image for a diagram
     * Replaces existing cache if present
     */
    async cacheDiagram(diagramId: string, diagram: string): Promise<void> {
        const cacheIndex = this.db.data.diagramCache.findIndex(c => c.diagramId === diagramId);
        const cache: DiagramCache = {
            diagramId,
            diagram,
            generated: new Date().toISOString()
        };

        if (cacheIndex === -1) {
            this.db.data.diagramCache.push(cache);
        } else {
            this.db.data.diagramCache[cacheIndex] = cache;
        }

        await this.db.write();
    }

    /**
     * Retrieve cached image for a diagram
     * Returns null if no cache exists
     */
    async getCachedDiagram(diagramId: string): Promise<string | null> {
        const cache = this.db.data.diagramCache.find(c => c.diagramId === diagramId);
        return cache?.diagram || null;
    }

    /**
     * Clear cached image for a diagram
     */
    async clearDiagramCache(diagramId: string): Promise<void> {
        this.db.data.diagramCache = this.db.data.diagramCache.filter(c => c.diagramId !== diagramId);
        await this.db.write();
    }

    /**
     * Get a project that contains a specific diagram
     * This is useful for finding the project context for a diagram operation
     * 
     * @param diagramId The diagram ID to search for
     * @returns The project containing the diagram, or null if not found
     */
    async getProjectByDiagramId(diagramId: string): Promise<Project | null> {
        const project = this.db.data.projects.find(p => 
            p.diagrams && p.diagrams.includes(diagramId)
        );
        return project || null;
    }
}
