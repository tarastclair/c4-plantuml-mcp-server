/**
 * AI ASSISTANCE DISCLAIMER
 * Parts of this code were written with the assistance of an AI language model.
 * While efforts have been made to ensure quality and correctness,
 * please review thoroughly before implementing in production environments.
 */

import { Low } from 'lowdb';
import { v4 as uuidv4 } from 'uuid';
import { 
    C4Diagram, 
    DatabaseSchema, 
    DiagramType
} from '../types-and-interfaces.js';
import { getProjectImpl } from './projects.js';

/**
 * Find a diagram by name and type within a project
 * This is useful for our filesystem-based relationship approach
 * 
 * @param db The lowdb database instance
 * @param projectId Project containing the diagram
 * @param name Diagram name to look for
 * @param diagramType Type of diagram to find
 * @returns The matching diagram or null
 */
export async function findDiagramByNameImpl(
    db: Low<DatabaseSchema>,
    projectId: string, 
    name: string, 
    diagramType: DiagramType
): Promise<C4Diagram | null> {
    // Get the project first
    const project = await getProjectImpl(db, projectId);
    if (!project) {
        return null;
    }
    
    // Find matching diagrams in the project
    const diagrams = project.diagrams.filter(d => 
        d.diagramType === diagramType && 
        d.name.toLowerCase() === name.toLowerCase()
    );
    
    return diagrams.length > 0 ? diagrams[0] : null;
}

/**
 * Find diagrams by file path pattern
 * Useful for finding diagrams related by filesystem structure
 * Searches across all projects
 * 
 * @param db The lowdb database instance
 * @param pattern Path pattern to match against
 * @returns Array of matching diagrams with their project context
 */
export async function findDiagramsByFilePathImpl(
    db: Low<DatabaseSchema>,
    pattern: string
): Promise<C4Diagram[]> {
    const matchingDiagrams: C4Diagram[] = [];
    
    // Iterate through all projects
    for (const project of db.data.projects) {
        // Filter diagrams in this project that match the pattern
        const projectMatches = project.diagrams.filter(d => 
            d.pumlPath?.includes(pattern) || 
            d.pngPath?.includes(pattern)
        );
        
        // Add matching diagrams to our results
        matchingDiagrams.push(...projectMatches);
    }
    
    return matchingDiagrams;
}

/**
 * Create a new C4 diagram within a specified project
 * @param db The lowdb database instance
 * @param projectId ID of the project to add this diagram to
 * @param name Name of the diagram
 * @param description Optional description
 * @param diagramType Type of C4 diagram (defaults to Context)
 * @param pumlPath Optional path to PlantUML file
 * @param pngPath Optional path to PNG render
 * @returns The created diagram
 */
export async function createDiagramImpl(
    db: Low<DatabaseSchema>,
    projectId: string,
    name: string, 
    description?: string,
    diagramType: DiagramType = DiagramType.CONTEXT,
    pumlPath?: string,
    pngPath?: string
): Promise<C4Diagram> {
    // Find the project
    const project = await getProjectImpl(db, projectId);
    if (!project) {
        throw new Error(`Project not found: ${projectId}`);
    }

    const now = new Date().toISOString();
    const diagram: C4Diagram = {
        id: uuidv4(),
        projectId, // Include reference to parent project
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

    // Add the diagram to the project
    project.diagrams.push(diagram);
    project.updated = now;
    
    // Save the updated project
    await db.write();
    
    return diagram;
}

/**
 * Retrieve a diagram by ID from a specific project
 * 
 * @param db The lowdb database instance
 * @param projectId Project containing the diagram
 * @param diagramId Diagram ID to retrieve
 * @returns The diagram or null if not found
 */
export async function getDiagramImpl(
    db: Low<DatabaseSchema>,
    projectId: string, 
    diagramId: string
): Promise<C4Diagram | null> {
    // Find the project first
    const project = await getProjectImpl(db, projectId);
    if (!project) {
        return null;
    }
    
    // Find the diagram in the project
    const diagram = project.diagrams.find(d => d.id === diagramId);
    return diagram || null;
}

/**
 * Update a diagram's properties within its project
 * 
 * @param db The lowdb database instance
 * @param projectId Project containing the diagram
 * @param diagramId ID of the diagram to update
 * @param updates Partial diagram updates
 * @returns The updated diagram
 */
export async function updateDiagramImpl(
    db: Low<DatabaseSchema>,
    projectId: string, 
    diagramId: string, 
    updates: Partial<C4Diagram>
): Promise<C4Diagram> {
    // Get the project
    const project = await getProjectImpl(db, projectId);
    if (!project) {
        throw new Error(`Project not found: ${projectId}`);
    }

    // Find the diagram in the project
    const diagramIndex = project.diagrams.findIndex(d => d.id === diagramId);
    if (diagramIndex === -1) {
        throw new Error(`Diagram not found: ${diagramId}`);
    }

    // Get the existing diagram
    const diagram = project.diagrams[diagramIndex];
    
    // Create the updated diagram with timestamp
    const updated = {
        ...diagram,
        ...updates,
        updated: new Date().toISOString()
    };

    // Ensure we don't accidentally change the projectId relationship
    if (updates.projectId && updates.projectId !== projectId) {
        // If trying to move to a different project, that should be
        // handled by a dedicated "moveDiagram" method instead
        throw new Error("Cannot change diagram's project through update. Use addDiagramToProject instead.");
    }

    // Update the diagram in the project
    project.diagrams[diagramIndex] = updated;
    
    // Save changes
    await db.write();
    
    return updated;
}

/**
 * List all diagrams within a specific project
 * 
 * @param db The lowdb database instance
 * @param projectId ID of the project to list diagrams from
 * @returns Array of diagrams in the project
 */
export async function listDiagramsImpl(
    db: Low<DatabaseSchema>,
    projectId: string
): Promise<C4Diagram[]> {
    // Get the project
    const project = await getProjectImpl(db, projectId);
    if (!project) {
        throw new Error(`Project not found: ${projectId}`);
    }
    
    // Return all diagrams in the project
    return project.diagrams;
}