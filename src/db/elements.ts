/**
 * AI ASSISTANCE DISCLAIMER
 * Parts of this code were written with the assistance of an AI language model.
 * While efforts have been made to ensure quality and correctness,
 * please review thoroughly before implementing in production environments.
 */

import { Low } from 'lowdb';
import { v4 as uuidv4 } from 'uuid';
import { 
    C4Element, 
    DatabaseSchema
} from '../types-and-interfaces.js';
import { getProjectImpl } from './projects.js';

/**
 * Add a new element to a diagram within a project
 * 
 * @param db The lowdb database instance
 * @param projectId Project containing the diagram
 * @param diagramId ID of the diagram to add the element to
 * @param element Element properties (without ID)
 * @returns The created element with generated ID
 */
export async function addElementImpl(
    db: Low<DatabaseSchema>,
    projectId: string, 
    diagramId: string, 
    element: Omit<C4Element, 'id'>
): Promise<C4Element> {
    // Get the project and diagram
    const project = await getProjectImpl(db, projectId);
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
    await db.write();
    
    return newElement;
}

/**
 * Update an existing element within a diagram
 * 
 * @param db The lowdb database instance
 * @param projectId Project containing the diagram
 * @param diagramId ID of the diagram containing the element
 * @param elementId ID of the element to update
 * @param updates Partial element updates
 * @returns The updated element
 */
export async function updateElementImpl(
    db: Low<DatabaseSchema>,
    projectId: string, 
    diagramId: string, 
    elementId: string, 
    updates: Partial<C4Element>
): Promise<C4Element> {
    // Get the project and diagram
    const project = await getProjectImpl(db, projectId);
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
    await db.write();
    
    return updated;
}