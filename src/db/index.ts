import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
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
import {
    addElementImpl,
    updateElementImpl
} from './elements.js';
import {
    addRelationshipImpl,
    updateRelationshipImpl
} from './relationships.js';

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
        return await addElementImpl(this.db, projectId, diagramId, element);
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
        return await updateElementImpl(this.db, projectId, diagramId, elementId, updates);
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
        return await addRelationshipImpl(this.db, projectId, diagramId, relationship);
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
        return await updateRelationshipImpl(this.db, projectId, diagramId, relationshipId, updates);
    }
}
