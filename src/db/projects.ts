import { Low } from 'lowdb';
import { DatabaseSchema, Project } from '../types-and-interfaces.js';

/**
 * Implements the project creation logic
 * Extracted from DiagramDb to modularize our database operations
 * 
 * @param db The lowdb database instance
 * @param project Project to create
 * @returns The created project
 */
export async function createProjectImpl(
    db: Low<DatabaseSchema>, 
    project: Project
): Promise<Project> {
    db.data.projects.push(project);
    await db.write();
    return project;
}

/**
 * Implements the project retrieval logic
 * Extracted from DiagramDb to modularize our database operations
 * 
 * @param db The lowdb database instance
 * @param id Project ID to retrieve
 * @returns The project or null if not found
 */
export async function getProjectImpl(
    db: Low<DatabaseSchema>, 
    id: string
): Promise<Project | null> {
    const project = db.data.projects.find(p => p.id === id);
    return project || null;
}

/**
 * Implements the project update logic
 * Extracted from DiagramDb to modularize our database operations
 * 
 * @param db The lowdb database instance
 * @param id Project ID to update
 * @param updates Partial project updates
 * @returns The updated project
 */
export async function updateProjectImpl(
    db: Low<DatabaseSchema>, 
    id: string, 
    updates: Partial<Project>
): Promise<Project> {
    const index = db.data.projects.findIndex(p => p.id === id);
    if (index === -1) {
        throw new Error(`Project not found: ${id}`);
    }

    const project = db.data.projects[index];
    const updated = {
        ...project,
        ...updates,
        updated: new Date().toISOString()
    };

    db.data.projects[index] = updated;
    await db.write();
    return updated;
}

/**
 * Implements the project listing logic
 * Extracted from DiagramDb to modularize our database operations
 * 
 * @param db The lowdb database instance
 * @returns Array of all projects
 */
export async function listProjectsImpl(
    db: Low<DatabaseSchema>
): Promise<Project[]> {
    return db.data.projects;
}