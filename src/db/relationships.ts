import { Low } from 'lowdb';
import { v4 as uuidv4 } from 'uuid';
import { 
    C4Relationship, 
    DatabaseSchema
} from '../types-and-interfaces.js';
import { getProjectImpl } from './projects.js';

/**
 * Add a new relationship between elements in a diagram
 * 
 * @param db The lowdb database instance
 * @param projectId Project containing the diagram
 * @param diagramId ID of the diagram to add the relationship to
 * @param relationship Relationship properties (without ID)
 * @returns The created relationship with generated ID
 */
export async function addRelationshipImpl(
    db: Low<DatabaseSchema>,
    projectId: string,
    diagramId: string, 
    relationship: Omit<C4Relationship, 'id'>
): Promise<C4Relationship> {
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
    await db.write();
    
    return newRelationship;
}

/**
 * Update an existing relationship within a diagram
 * 
 * @param db The lowdb database instance
 * @param projectId Project containing the diagram
 * @param diagramId ID of the diagram containing the relationship
 * @param relationshipId ID of the relationship to update
 * @param updates Partial relationship updates
 * @returns The updated relationship
 */
export async function updateRelationshipImpl(
    db: Low<DatabaseSchema>,
    projectId: string,
    diagramId: string, 
    relationshipId: string, 
    updates: Partial<C4Relationship>
): Promise<C4Relationship> {
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
    await db.write();
    
    return updated;
}