import { DiagramType, InterfaceElementType, InterfaceRelationshipType } from '../types-and-interfaces.js';

/**
 * Gets the appropriate PlantUML include statement based on diagram type
 * Different diagram types require different library includes
 * 
 * @param diagramType Type of C4 diagram
 * @returns PlantUML include statement
 */
export function getPlantUMLImport(diagramType: DiagramType): string {
  switch (diagramType) {
    case DiagramType.CONTEXT:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml';
    case DiagramType.CONTAINER:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml';
    case DiagramType.COMPONENT:
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml';
    case DiagramType.CODE:
      // For code diagrams, we still use the component library
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml';
    case DiagramType.INTERFACE:
      // For interfaces diagrams, we use Component as base and add custom definitions
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml';
    default:
      // Default to context diagram
      return '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml';
  }
}

/**
 * Gets the PlantUML macro name for a specific element
 * Based on its base type and variant (e.g., System, Person, ContainerDb, etc.)
 * 
 * @param element Element to get macro for
 * @returns PlantUML macro name
 */
export function getElementMacro(element: {
  descriptor: { baseType: string; variant?: string; boundaryType?: string, interfaceType?: string }
}): string {
  const { baseType, variant, boundaryType, interfaceType  } = element.descriptor;
  
  // Handle boundary elements
  if (variant === 'boundary') {
    if (boundaryType === 'system') {
      return 'System_Boundary';
    } else if (boundaryType === 'container') {
      return 'Container_Boundary';
    } else {
      return 'Boundary'; // Default boundary
    }
  }

  if (interfaceType) {
    return 'Component'; // We use Component for all interface elements, with tags for styling
  }
  
  // Start with the base element type (capitalized)
  let macro = baseType.charAt(0).toUpperCase() + baseType.slice(1);
  
  // Add variant suffixes
  if (variant === 'db') {
    macro += 'Db';
  } else if (variant === 'queue') {
    macro += 'Queue';
  }
  
  // Add external suffix if needed
  if (variant === 'external') {
    macro += '_Ext';
  }
  
  return macro;
}

/**
 * Gets the tag for an interface diagram element type
 * Used to apply the correct styling in the PlantUML diagram
 * 
 * @param interfaceType Type of interface element
 * @returns PlantUML $tags parameter value
 */
export function getInterfaceElementTag(interfaceType: InterfaceElementType): string {
  return interfaceType; // We use the element type directly as the tag
}

/**
 * Gets the relationship tag for an interface relationship type
 * Used to apply the correct styling in the PlantUML diagram
 * 
 * @param relType Type of relationship in interface diagram
 * @returns PlantUML $tags parameter value
 */
export function getInterfaceRelationshipTag(relType: InterfaceRelationshipType): string {
  return relType; // Use the relationship type directly as the tag
}

/**
 * Returns the setup section for interfaces diagrams
 * Defines custom styling tags for interfaces, types, and enums
 * 
 * @returns PlantUML setup code as string
 */
export function getInterfaceDiagramSetup(): string {
  const lines: string[] = [];
  
  // Hide stereotypes for cleaner diagram
  lines.push('HIDE_STEREOTYPE()');
  lines.push('');
  
  // Add custom styling for interface elements
  lines.push('\'Type system tags with C4 blue gradient colors');
  lines.push('AddElementTag("interface", $bgColor="#18437D", $fontColor="#ffffff", $borderColor="#0b2b52")');
  lines.push('AddElementTag("type", $bgColor="#2A69C0", $fontColor="#ffffff", $borderColor="#1d4b8c")');
  lines.push('AddElementTag("enum", $bgColor="#8CBBF2", $fontColor="#000000", $borderColor="#5c98d9")');
  lines.push('');
  
  // Add relationship styling
  lines.push('\'Simple relationship style');
  lines.push('AddRelTag("contains", $lineStyle = DashedLine())');
  lines.push('AddRelTag("implements", $lineColor="#18437D")');
  lines.push('AddRelTag("extends", $lineColor="#2A69C0")');
  lines.push('AddRelTag("references", $lineColor="#5c98d9")');
  lines.push('');
  
  return lines.join('\n');
}