/**
 * AI ASSISTANCE DISCLAIMER
 * Parts of this code were written with the assistance of an AI language model.
 * While efforts have been made to ensure quality and correctness,
 * please review thoroughly before implementing in production environments.
 */

import { C4Diagram, C4Element, C4Relationship } from '../types-and-interfaces.js';
import { getElementMacro } from './getters.js';

// Helper function to process elements hierarchically
export function processElements(elements: C4Element[]): string[] {
    const lines: string[] = [];
    
    // Keep track of which elements we've already processed
    const processedElementIds = new Set<string>();
    
    // Step 1: First process all elements that ARE NOT in a boundary
    elements.forEach(element => {
      // Skip if this element is a child of a boundary
      if (element.parentId) {
        return;
      }
      
      // Skip if this element is a boundary - we'll handle those in step 2
      if (element.descriptor.variant === 'boundary') {
        return;
      }
      
      const id = element.id.replace(/[^\w]/g, '_');
      const name = element.name;
      const description = element.description;
      const macro = getElementMacro(element);
      const techStr = element.technology ? `, "${element.technology}"` : '';

      // Special handling for Note elements
      if (element.descriptor.baseType === 'note') {
        lines.push(`note as ${id}`);
        lines.push(element.description);
        lines.push('end note');
        processedElementIds.add(element.id);
        return;
      }
      
      // Add standalone elements
      if (element.descriptor.baseType === 'container' || element.descriptor.baseType === 'component') {
        lines.push(`${macro}(${id}, "${name}"${techStr}, "${description}")`);
      } else {
        lines.push(`${macro}(${id}, "${name}", "${description}")`);
      }
      
      // Mark as processed
      processedElementIds.add(element.id);
    });
    
    // Step 2: Process all boundary elements (with their children)
    elements.forEach(element => {
      // Skip if not a boundary
      if (element.descriptor.variant !== 'boundary') {
        return;
      }
      
      // Skip if this boundary is itself a child of another boundary
      // (we would need recursion to handle this, but for MVP we'll just make it flat)
      if (element.parentId) {
        // Just add the boundary as a regular element
        const id = element.id.replace(/[^\w]/g, '_');
        const name = element.name;
        const description = element.description;
        const macro = getElementMacro(element);
        
        lines.push(`${macro}(${id}, "${name}", "${description}")`);
        processedElementIds.add(element.id);
        return;
      }
      
      // It's a top-level boundary - render it with its children
      const id = element.id.replace(/[^\w]/g, '_');
      const name = element.name;
      const description = element.description;
      const macro = getElementMacro(element);
      
      // Start boundary
      lines.push(`${macro}(${id}, "${name}", "${description}") {`);
      
      // Find children of this boundary
      const children = elements.filter(e => e.parentId === element.id);
      
      // Process children elements
      if (children.length > 0) {
        children.forEach(child => {
          const childId = child.id.replace(/[^\w]/g, '_');
          const childName = child.name;
          const childDesc = child.description;
          const childMacro = getElementMacro(child);
          const childTechStr = child.technology ? `, "${child.technology}"` : '';

          // Special handling for Note elements inside a boundary
          if (child.descriptor.baseType === 'note') {
            lines.push(`  note as ${childId}`);
            lines.push(`  ${childDesc}`);
            lines.push('  end note');
          } else if (child.descriptor.baseType === 'container' || child.descriptor.baseType === 'component') {
            lines.push(`  ${childMacro}(${childId}, "${childName}"${childTechStr}, "${childDesc}")`);
          } else {
            lines.push(`  ${childMacro}(${childId}, "${childName}", "${childDesc}")`);
          }
          
          // Mark as processed
          processedElementIds.add(child.id);
        });
      }
      
      // Close boundary
      lines.push('}');
      
      // Mark boundary as processed
      processedElementIds.add(element.id);
    });
    
    // Step 3: Final sweep - add any elements that weren't processed yet
    // This handles elements that might have parentId but their parent doesn't exist
    elements.forEach(element => {
      if (!processedElementIds.has(element.id)) {
        const id = element.id.replace(/[^\w]/g, '_');
        const name = element.name;
        const description = element.description;
        const macro = getElementMacro(element);
        const techStr = element.technology ? `, "${element.technology}"` : '';

        // Special handling for remaining Note elements
        if (element.descriptor.baseType === 'note') {
          lines.push(`note as ${id}`);
          lines.push(element.description);
          lines.push('end note');
        } else
        
        // Add any remaining elements
        if (element.descriptor.baseType === 'container' || element.descriptor.baseType === 'component') {
          lines.push(`${macro}(${id}, "${name}"${techStr}, "${description}")`);
        } else {
          lines.push(`${macro}(${id}, "${name}", "${description}")`);
        }
        
        // Just for completion's sake
        processedElementIds.add(element.id);
      }});
    
    return lines;
}

// Function to add relationships after all elements are defined
export function addRelationships(diagram: C4Diagram, lines: string[]): void {
  // Track processed relationships to prevent duplicates
  const processedRels = new Set<string>();
  
  // Add relationships, ensuring no duplicates
  diagram.relationships.forEach(rel => {
      const source = diagram.elements.find(e => e.id === rel.sourceId);
      const target = diagram.elements.find(e => e.id === rel.targetId);
      
      if (source && target) {
      const sourceId = source.id.replace(/[^\w]/g, '_');
      const targetId = target.id.replace(/[^\w]/g, '_');
      const techStr = rel.technology ? `, "${rel.technology}"` : '';
      
      // Create a unique key for this relationship
      const relKey = `${sourceId}-${targetId}-${rel.description}`;
      
      // Only add if we haven't seen this relationship before
      if (!processedRels.has(relKey)) {
          processedRels.add(relKey);
          lines.push(`Rel(${sourceId}, ${targetId}, "${rel.description}"${techStr})`);
      }
      }
  });
}

// INTERFACE DIAGRAM SPECIAL HANDLING
  
/**
 * Process elements for an interfaces diagram
 * Handles custom styling and organization for interface type diagrams
 * 
 * @param elements Elements to process
 * @returns Array of PlantUML lines for elements
 */
export function processInterfaceDiagramElements(elements: C4Element[]): string[] {
const lines: string[] = [];
const processedElementIds = new Set<string>();

// Process non-boundary elements first
elements.forEach(element => {
    if (element.parentId || element.descriptor.variant === 'boundary') {
    return;
    }
    
    const id = element.id.replace(/[^\w]/g, '_');
    const name = element.name;
    const description = element.description;
    const macro = getElementMacro(element);
    const techStr = element.technology ? `, "${element.technology}"` : ', ""';

    // Special handling for Note elements
    if (element.descriptor.baseType === 'note') {
      lines.push(`note as ${id}`);
      lines.push(element.description);
      lines.push('end note');
      processedElementIds.add(element.id);
      return;
    }
    
    // For interface diagrams, we add tag based on interfaceType
    let tagsStr = '';
    if (element.descriptor.interfaceType) {
    tagsStr = `, $tags="${element.descriptor.interfaceType}"`;
    }
    
    // Add standalone elements
    lines.push(`${macro}(${id}, "${name}"${techStr}, "${description}"${tagsStr})`);
    processedElementIds.add(element.id);
});

// Process boundary elements and their children
elements.forEach(element => {
    if (element.descriptor.variant !== 'boundary' || processedElementIds.has(element.id)) {
    return;
    }
    
    const id = element.id.replace(/[^\w]/g, '_');
    const name = element.name;
    const description = element.description;
    const macro = getElementMacro(element);
    
    // Start boundary
    lines.push(`${macro}(${id}, "${name}", "${description}") {`);
    
    // Process children
    const children = elements.filter(e => e.parentId === element.id);
    if (children.length > 0) {
    children.forEach(child => {
        const childId = child.id.replace(/[^\w]/g, '_');
        const childName = child.name;
        const childDesc = child.description;
        const childMacro = getElementMacro(child);
        const childTechStr = child.technology ? `, "${child.technology}"` : ', ""';
        
        // Add tag based on interfaceType
        let tagsStr = '';
        if (child.descriptor.interfaceType) {
        tagsStr = `, $tags="${child.descriptor.interfaceType}"`;
        }
        
        lines.push(`  ${childMacro}(${childId}, "${childName}"${childTechStr}, "${childDesc}"${tagsStr})`);
        processedElementIds.add(child.id);
    });
    }
    
    // Close boundary
    lines.push('}');
    processedElementIds.add(element.id);
});

// Process any remaining elements
elements.forEach(element => {
    if (!processedElementIds.has(element.id)) {
    const id = element.id.replace(/[^\w]/g, '_');
    const name = element.name;
    const description = element.description;
    const macro = getElementMacro(element);
    const techStr = element.technology ? `, "${element.technology}"` : ', ""';
    
    let tagsStr = '';
    if (element.descriptor.interfaceType) {
        tagsStr = `, $tags="${element.descriptor.interfaceType}"`;
    }
    
    lines.push(`${macro}(${id}, "${name}"${techStr}, "${description}"${tagsStr})`);
    processedElementIds.add(element.id);
    }
});

return lines;
}

/**
 * Add relationships for an interfaces diagram
 * Handles relationship tagging and styling for interface type diagrams
 * 
 * @param diagram Diagram containing relationships
 * @param lines Array of PlantUML lines to append to
 */
export function addInterfaceDiagramRelationships(diagram: C4Diagram, lines: string[]): void {
  // Track processed relationships to prevent duplicates
  const processedRels = new Set<string>();
  
  // Add relationships with appropriate tags
  diagram.relationships.forEach(rel => {
      const source = diagram.elements.find(e => e.id === rel.sourceId);
      const target = diagram.elements.find(e => e.id === rel.targetId);
      
      if (source && target) {
      const sourceId = source.id.replace(/[^\w]/g, '_');
      const targetId = target.id.replace(/[^\w]/g, '_');
      
      // Create a unique key for this relationship
      const relKey = `${sourceId}-${targetId}-${rel.description}`;
      
      // Only add if we haven't seen this relationship before
      if (!processedRels.has(relKey)) {
          processedRels.add(relKey);
          
          // Add tag if relationship type is in metadata
          let tagsStr = '';
          if (rel.metadata?.type && typeof rel.metadata.type === 'string') {
          tagsStr = `, $tags="${rel.metadata.type}"`;
          }
          
          lines.push(`Rel(${sourceId}, ${targetId}, "${rel.description}"${tagsStr})`);
      }
      }
  });
}

// SEQUENCE DIAGRAM SPECIAL HANDLING

/**
 * Process elements for a sequence diagram
 * For sequence diagrams, we don't support boundaries to avoid complexity
 * Also exclude Note elements since they aren't supported in sequence diagrams
 */
export function processSequenceElements(elements: C4Element[]): string[] {
  const lines: string[] = [];
  const processedElementIds = new Set<string>();
  
  // Process all elements as standalone participants
  elements.forEach(element => {
    // Skip any boundary elements - we're not supporting them for sequence diagrams
    if (element.descriptor.variant === 'boundary') {
      return;
    }
    
    // Skip Note elements - they're not supported in C4-PlantUML sequence diagram elements
    // Notes in sequence diagrams have a different syntax and should be handled separately
    if (element.descriptor.baseType === 'note') {
      return;
    }
    
    const id = element.id.replace(/[^\w]/g, '_');
    const name = element.name;
    const description = element.description;
    const macro = getElementMacro(element);
    const techStr = element.technology ? `, "${element.technology}"` : '';

    // Add standalone elements (participants in sequence diagram)
    if (element.descriptor.baseType === 'container' || element.descriptor.baseType === 'component') {
      lines.push(`${macro}(${id}, "${name}"${techStr}, "${description}")`);
    } else {
      lines.push(`${macro}(${id}, "${name}", "${description}")`);
    }
    
    processedElementIds.add(element.id);
  });
  
  return lines;
}

/**
 * Combined function to handle processing special elements and relationships
 */
export function processSequenceSpecialElementsAndRelationships(diagram: C4Diagram): string[] {
  const lines: string[] = [];
  
  // Type definitions for our event tracking
  type DividerStartEvent = { 
    type: 'divider-start';
    title: string;
    timestamp: number;
  };
  
  type DividerEndEvent = { 
    type: 'divider-end';
    title: string; 
    timestamp: number;
  };
  
  type RelationshipEvent = { 
    type: 'relationship';
    sourceId: string;
    targetId: string;
    rel: C4Relationship;
    timestamp: number;
  };
  
  // Note: Sequence diagram notes are not currently supported
  // PlantUML sequence diagrams require notes to be attached to participants
  // as "note left of", "note right of", or "note over"
  
  type DiagramEvent = DividerStartEvent | DividerEndEvent | RelationshipEvent;
  
  // Collection of all events (dividers and relationships)
  const events: DiagramEvent[] = [];
  
  // Step 1: Extract all divider elements and their timestamps
  const dividerElements = diagram.elements.filter(
    element => element.metadata?.isSequenceDivider
  );
  
  // Add divider start events
  dividerElements
    .filter(element => !element.name.startsWith('End of'))
    .forEach(element => {
      events.push({
        type: 'divider-start',
        title: element.metadata?.dividerTitle as string || element.name,
        timestamp: new Date((element.metadata?.created as string) || '').getTime() || 0
      });
    });
  
  // Add divider end events
  dividerElements
    .filter(element => element.name.startsWith('End of'))
    .forEach(element => {
      events.push({
        type: 'divider-end',
        title: element.name.replace('End of ', ''),
        timestamp: new Date((element.metadata?.created as string) || '').getTime() || 0
      });
    });
  
  // Step 2: Extract all relationships and their timestamps
  diagram.relationships.forEach(rel => {
    const source = diagram.elements.find(e => e.id === rel.sourceId);
    const target = diagram.elements.find(e => e.id === rel.targetId);
    
    if (source && target) {
      // Skip relationships involving Note elements since they're not supported
      // in the standard C4-PlantUML sequence diagram format
      if (source.descriptor.baseType === 'note' || target.descriptor.baseType === 'note') {
        return;
      }
      
      events.push({
        type: 'relationship',
        sourceId: source.id.replace(/[^\w]/g, '_'),
        targetId: target.id.replace(/[^\w]/g, '_'),
        rel: rel,
        timestamp: new Date((rel.metadata?.created as string) || '').getTime() || 0
      });
    }
  });
  
  // Step 3: Sort all events by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);
  
  // Step 4: Generate PUML content in the correct order
  events.forEach(event => {
    if (event.type === 'divider-start') {
      lines.push(`== ${event.title} ==`);
    } else if (event.type === 'divider-end') {
      lines.push(`== End of ${event.title} ==`);
    } else if (event.type === 'relationship') {
      // Format the relationship
      const sourceId = event.sourceId;
      const targetId = event.targetId;
      const description = event.rel.description;
      const techStr = event.rel.technology ? `, "${event.rel.technology}"` : '';
      
      // Add any special relationship parameters
      const relParam = event.rel.metadata?.rel ? `$rel="${event.rel.metadata.rel}"` : '';
      
      // Add the relationship line
      lines.push(`Rel(${sourceId}, ${targetId}, "${description}"${techStr},,,,,, ${relParam})`);
    }
  });
  
  return lines;
}