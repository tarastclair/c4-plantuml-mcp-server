import { C4Diagram, C4Element } from '../types-and-interfaces.js';
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
          
          if (child.descriptor.baseType === 'container' || child.descriptor.baseType === 'component') {
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
 * Process elements for a sequence diagram
 * For sequence diagrams, we don't support boundaries to avoid complexity
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
 * Add relationships for sequence diagrams
 * Special handling for $index and $rel parameters
 */
export function addSequenceRelationships(diagram: C4Diagram, lines: string[]): void {
  // Track processed relationships to prevent duplicates
  const processedRels = new Set<string>();
  
  // Use the relationships as they are (no sorting by index)
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
        
        // Format the relationship with proper parameter positioning
        const relParam = rel.metadata?.rel ? `$rel="${rel.metadata.rel}"` : '';
        
        // Add 5 empty commas to position $rel at the end
        lines.push(`Rel(${sourceId}, ${targetId}, "${rel.description}"${techStr},,,,,, ${relParam})`);
      }
    }
  });
}

/**
 * Generate PlantUML source for special sequence diagram elements
 * Handles sequence-specific constructs like dividers and groups
 */
export function processSequenceSpecialElements(elements: C4Element[]): string[] {
  const lines: string[] = [];
  
  // Sort elements by creation time if available to maintain sequence
  const sortedElements = [...elements].sort((a, b) => {
    const createdA = a.metadata?.created as string;
    const createdB = b.metadata?.created as string;
    if (createdA && createdB) {
      return new Date(createdA).getTime() - new Date(createdB).getTime();
    }
    return 0;
  });
  
  // Process special sequence elements like dividers and groups
  sortedElements.forEach(element => {
    if (element.metadata?.isSequenceDivider) {
      // Generate divider syntax
      const title = element.metadata.dividerTitle as string || element.name;
      lines.push(`== ${title} ==`);
    } else if (element.metadata?.isSequenceGroup) {
      // Generate group syntax
      const title = element.metadata.groupTitle as string || element.name;
      const description = element.metadata.groupDescription as string || element.description;
      
      if (element.metadata.isGroupEnd) {
        lines.push('end');
      } else {
        lines.push(`group ${title}`);
      }
    }
  });
  
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