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
    Project,
    DiagramType
} from '../types-and-interfaces.js';
import {
    createProjectImpl,
    getProjectImpl,
    updateProjectImpl,
    listProjectsImpl
} from './projects.js';
import {
    findDiagramByNameImpl,
    findDiagramsByFilePathImpl,
    createDiagramImpl,
    getDiagramImpl,
    updateDiagramImpl,
    listDiagramsImpl
} from './diagrams.js';

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
    private db: Low<DatabaseSchema>;

    constructor(dbPath: string) {
        // Ensure we have a consistent db file location
        const adapter = new JSONFile<DatabaseSchema>(join(dbPath, 'diagrams.json'));
        this.db = new Low(adapter, { 
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
        return await createProjectImpl(this.db, project);
    }

    /**
     * Get a project by ID
     * @param id Project ID
     * @returns The project or null if not found
     */
    async getProject(id: string): Promise<Project | null> {
        return await getProjectImpl(this.db, id);
    }

    /**
     * Update a project's properties
     * @param id Project ID
     * @param updates Partial project updates
     * @returns The updated project
     */
    async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
        return await updateProjectImpl(this.db, id, updates);
    }

    /**
     * List all projects
     * @returns Array of all projects
     */
    async listProjects(): Promise<Project[]> {
        return await listProjectsImpl(this.db);
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
        return await findDiagramByNameImpl(this.db, projectId, name, diagramType);
    }

    /**
     * Find diagrams by file path pattern
     * Useful for finding diagrams related by filesystem structure
     * Searches across all projects
     * 
     * @param pattern Path pattern to match against
     * @returns Array of matching diagrams with their project context
     */
    async findDiagramsByFilePath(pattern: string): Promise<C4Diagram[]> {
        return await findDiagramsByFilePathImpl(this.db, pattern);
    }

    /**
    * Create a new C4 diagram within a specified project
    * @param projectId ID of the project to add this diagram to
    * @param name Name of the diagram
    * @param description Optional description
    * @param diagramType Type of C4 diagram (defaults to Context)
    * @param pumlPath Optional path to PlantUML file
    * @param pngPath Optional path to PNG render
    * @returns The created diagram
    */
    async createDiagram(
        projectId: string,
        name: string, 
        description?: string,
        diagramType: DiagramType = DiagramType.CONTEXT,
        pumlPath?: string,
        pngPath?: string
    ): Promise<C4Diagram> {
        return await createDiagramImpl(
            this.db, 
            projectId, 
            name, 
            description, 
            diagramType, 
            pumlPath, 
            pngPath
        );
    }

    /**
    * Retrieve a diagram by ID from a specific project
    * 
    * @param projectId Project containing the diagram
    * @param diagramId Diagram ID to retrieve
    * @returns The diagram or null if not found
    */
    async getDiagram(projectId: string, diagramId: string): Promise<C4Diagram | null> {
        return await getDiagramImpl(this.db, projectId, diagramId);
    }

    /**
    * Update a diagram's properties within its project
    * 
    * @param projectId Project containing the diagram
    * @param diagramId ID of the diagram to update
    * @param updates Partial diagram updates
    * @returns The updated diagram
    */
    async updateDiagram(projectId: string, diagramId: string, updates: Partial<C4Diagram>): Promise<C4Diagram> {
        return await updateDiagramImpl(this.db, projectId, diagramId, updates);
    }

    /**
    * List all diagrams within a specific project
    * 
    * @param projectId ID of the project to list diagrams from
    * @returns Array of diagrams in the project
    */
    async listDiagrams(projectId: string): Promise<C4Diagram[]> {
        return await listDiagramsImpl(this.db, projectId);
    }

    /**
    * Add a new element to a diagram within a project
    * 
    * @param projectId Project containing the diagram
    * @param diagramId ID of the diagram to add the element to
    * @param element Element properties (without ID)
    * @returns The created element with generated ID
    */
    async addElement(projectId: string, diagramId: string, element: Omit<C4Element, 'id'>): Promise<C4Element> {
        // Get the project and diagram
        const project = await this.getProject(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        
        // Find the diagram in the project
        const diagramIndex = project.diagrams.findIndex(d => d.id === diagramId);
        if (diagramIndex === -1) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }
        
        const diagram = project.diagrams[diagramIndex];
        
        // Create the new element with a generated ID
        const newElement: C4Element = {
            ...element,
            id: uuidv4()
        };
    
        // Add element to the diagram
        diagram.elements.push(newElement);
        
        // Update timestamp on the diagram
        diagram.updated = new Date().toISOString();
        
        // Save changes
        await this.db.write();
        
        return newElement;
    }

    /**
    * Update an existing element within a diagram
    * 
    * @param projectId Project containing the diagram
    * @param diagramId ID of the diagram containing the element
    * @param elementId ID of the element to update
    * @param updates Partial element updates
    * @returns The updated element
    */
    async updateElement(
        projectId: string, 
        diagramId: string, 
        elementId: string, 
        updates: Partial<C4Element>
    ): Promise<C4Element> {
        // Get the project and diagram
        const project = await this.getProject(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        
        // Find the diagram in the project
        const diagramIndex = project.diagrams.findIndex(d => d.id === diagramId);
        if (diagramIndex === -1) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }
        
        const diagram = project.diagrams[diagramIndex];
        
        // Find the element in the diagram
        const elementIndex = diagram.elements.findIndex(e => e.id === elementId);
        if (elementIndex === -1) {
            throw new Error(`Element not found: ${elementId}`);
        }
        
        // Get the existing element
        const element = diagram.elements[elementIndex];
        
        // Create the updated element
        const updated = { ...element, ...updates };
        
        // Update the element in the diagram
        diagram.elements[elementIndex] = updated;
        
        // Update timestamp on the diagram
        diagram.updated = new Date().toISOString();
        
        // Save changes
        await this.db.write();
        
        return updated;
    }

    /**
    * Add a new relationship between elements in a diagram
    * 
    * @param projectId Project containing the diagram
    * @param diagramId ID of the diagram to add the relationship to
    * @param relationship Relationship properties (without ID)
    * @returns The created relationship with generated ID
    */
    async addRelationship(
        projectId: string,
        diagramId: string, 
        relationship: Omit<C4Relationship, 'id'>
    ): Promise<C4Relationship> {
        // Get the project and diagram
        const project = await this.getProject(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        
        // Find the diagram in the project
        const diagramIndex = project.diagrams.findIndex(d => d.id === diagramId);
        if (diagramIndex === -1) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }
        
        const diagram = project.diagrams[diagramIndex];
        
        // Validate that both source and target elements exist
        const sourceExists = diagram.elements.some(e => e.id === relationship.sourceId);
        const targetExists = diagram.elements.some(e => e.id === relationship.targetId);
        
        if (!sourceExists || !targetExists) {
            throw new Error('Source or target element not found');
        }
        
        // Create the new relationship with a generated ID
        const newRelationship: C4Relationship = {
            ...relationship,
            id: uuidv4()
        };
        
        // Add relationship to the diagram
        diagram.relationships.push(newRelationship);
        
        // Update timestamp on the diagram
        diagram.updated = new Date().toISOString();
        
        // Save changes
        await this.db.write();
        
        return newRelationship;
    }

    /**
    * Update an existing relationship within a diagram
    * 
    * @param projectId Project containing the diagram
    * @param diagramId ID of the diagram containing the relationship
    * @param relationshipId ID of the relationship to update
    * @param updates Partial relationship updates
    * @returns The updated relationship
    */
    async updateRelationship(
        projectId: string,
        diagramId: string, 
        relationshipId: string, 
        updates: Partial<C4Relationship>
    ): Promise<C4Relationship> {
        // Get the project and diagram
        const project = await this.getProject(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        
        // Find the diagram in the project
        const diagramIndex = project.diagrams.findIndex(d => d.id === diagramId);
        if (diagramIndex === -1) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }
        
        const diagram = project.diagrams[diagramIndex];
        
        // Find the relationship in the diagram
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
        
        // Create the updated relationship
        const updated = { ...relationship, ...updates };
        
        // Update the relationship in the diagram
        diagram.relationships[relationshipIndex] = updated;
        
        // Update timestamp on the diagram
        diagram.updated = new Date().toISOString();
        
        // Save changes
        await this.db.write();
        
        return updated;
    }
}
