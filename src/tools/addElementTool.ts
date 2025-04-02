/**
 * AI ASSISTANCE DISCLAIMER
 * Parts of this code were written with the assistance of an AI language model.
 * While efforts have been made to ensure quality and correctness,
 * please review thoroughly before implementing in production environments.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db/index.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";
import { DiagramType, InterfaceElementType } from "../types-and-interfaces.js";
import * as personHelpers from "./internal/personElementHelpers.js";
import * as systemHelpers from "./internal/systemElementHelpers.js";
import * as containerHelpers from "./internal/containerElementHelpers.js";
import * as componentHelpers from "./internal/componentEntityHelpers.js";
import * as boundaryHelpers from "./internal/boundaryEntityHelpers.js";
import * as interfaceHelpers from "./internal/interfaceElementHelpers.js";
import * as sequenceHelpers from "./internal/sequenceEntityHelpers.js";

export const addElementTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-element",
    `Add an element to a C4 diagram.
    
    This tool allows you to add any type of element (person, system, container, component, boundary) 
    to your C4 diagrams. The required parameters vary based on the element type and variant.
    
    Required Input Fields:
    - projectId: String (UUID of the project)
    - diagramId: String (UUID of the diagram)
    - elementType: String (Type of element: "person", "system", "container", "component", "boundary", "interface", "type", "enum", "divider", "group")
    - variant: String (Variant of the element: "standard", "external", "db", "queue",  "system", "container")
    - name: String (Name of the element)
    - description: String (Description of the element)
    
    Conditional Input Fields:
    - technology: String (Required for container and component entities)
    - boundaryId: String (Optional UUID of the boundary element this element belongs to)
    - sprite: String (Optional icon for the element)
    - tags: String (Optional styling tags)
    - link: String (Optional URL link)
    - type: String (Optional type specifier, for boundaries can be "system" or "container")
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - projectId: String (UUID of the project)
    - elementIds: Object (Mappings of element IDs)
    
    You can continue to use the add-element and add-relationship tools to design your diagram,
    and when you're finished, you must call the generate-diagram-image tool to create
    a png image of the completed diagram.`,
    {
      projectId: z.string().describe("UUID of the project"),
      diagramId: z.string().describe("UUID of the diagram"),
      elementType: z.enum(["person", "system", "container", "component", "boundary", "interface", "type", "enum", "divider", "group"]).describe("Type of element to add"),
      variant: z.enum(["standard", "external", "db", "queue", "system", "container", "generic"]).describe("Variant of the element"),
      name: z.string().describe("Name of the element"),
      description: z.string().describe("Description of the element"),
      technology: z.string().optional().describe("Technology used (required for container and component entities)"),
      boundaryId: z.string().optional().describe("UUID of the boundary element this element belongs to"),
      sprite: z.string().optional().describe("Optional icon for the element"),
      tags: z.string().optional().describe("Optional styling tags"),
      link: z.string().optional().describe("Optional URL link"),
      type: z.string().optional().describe("Optional type specifier, for boundaries can be 'system', or 'container'")
    },
    async (params, extra) => {
      // Check if diagram exists and belongs to the project
      const diagram = await db.getDiagram(params.projectId, params.diagramId);
      if (!diagram) {
        throw new Error(`Diagram ${params.diagramId} not found. Please provide a valid diagram UUID.`);
      }
     
      // Validate technology field for container and component entities
      if (["container", "component"].includes(params.elementType) && 
          !params.technology) {
        return createErrorResponse("Technology is required for container and component entities");
      }

      try {
        let result;

        // Route to the appropriate helper based on element type and variant
        switch (params.elementType) {
            case "person":
                // Create person-specific params
                const personParams = {
                    projectId: params.projectId,
                    diagramId: params.diagramId,
                    name: params.name,
                    description: params.description,
                    sprite: params.sprite,
                    tags: params.tags,
                    link: params.link,
                    type: params.type
                };
                
                if (params.variant === "standard") {
                    result = await personHelpers.createStandardPerson(personParams, db);
                } else if (params.variant === "external") {
                    result = await personHelpers.createExternalPerson(personParams, db);
                } else {
                    return createErrorResponse(`Unsupported person variant: ${params.variant}`);
                }
                break;
                
            case "system":
                // Create system-specific params
                const systemParams = {
                    projectId: params.projectId,
                    diagramId: params.diagramId,
                    name: params.name,
                    description: params.description,
                    sprite: params.sprite,
                    tags: params.tags,
                    link: params.link,
                    type: params.type
                };
                
                if (params.variant === "standard") {
                    result = await systemHelpers.createStandardSystem(systemParams, db);
                } else if (params.variant === "external") {
                    result = await systemHelpers.createExternalSystem(systemParams, db);
                } else if (params.variant === "db") {
                    result = await systemHelpers.createDatabaseSystem(systemParams, db);
                } else if (params.variant === "queue") {
                    result = await systemHelpers.createQueueSystem(systemParams, db);
                } else {
                    return createErrorResponse(`Unsupported system variant: ${params.variant}`);
                }
                break;
            
            case "container":
                // Create container-specific params object
                const containerParams = {
                    projectId: params.projectId,
                    diagramId: params.diagramId,
                    name: params.name,
                    description: params.description,
                    technology: params.technology || "",  // Ensure we have a technology value
                    boundaryId: params.boundaryId,
                    sprite: params.sprite,
                    tags: params.tags,
                    link: params.link,
                    baseShape: params.type // Use type as baseShape if available
                };
                
                // Route to specific container helper based on variant
                if (params.variant === "standard") {
                    result = await containerHelpers.createStandardContainer(containerParams, db);
                } else if (params.variant === "db") {
                    result = await containerHelpers.createDatabaseContainer(containerParams, db);
                } else if (params.variant === "queue") {
                    result = await containerHelpers.createQueueContainer(containerParams, db);
                } else if (params.variant === "external") {
                    result = await containerHelpers.createExternalContainer(containerParams, db);
                } else {
                    return createErrorResponse(`Unsupported container variant: ${params.variant}`);
                }
                break;
            
            case "component":
                // Ensure technology is provided for components
                if (!params.technology) {
                    return createErrorResponse("Technology is required for component entities");
                }
                
                // Create component-specific params object
                const componentParams = {
                    projectId: params.projectId,
                    diagramId: params.diagramId,
                    name: params.name,
                    description: params.description,
                    technology: params.technology,
                    boundaryId: params.boundaryId,
                    sprite: params.sprite,
                    tags: params.tags,
                    link: params.link,
                    baseShape: params.type // Use type as baseShape if available
                };
                
                // Route to specific component helper based on variant
                if (params.variant === "standard") {
                    result = await componentHelpers.createStandardComponent(componentParams, db);
                } else if (params.variant === "db") {
                    result = await componentHelpers.createDatabaseComponent(componentParams, db);
                } else if (params.variant === "queue") {
                    result = await componentHelpers.createQueueComponent(componentParams, db);
                } else if (params.variant === "external") {
                    result = await componentHelpers.createExternalComponent(componentParams, db);
                } else {
                    return createErrorResponse(`Unsupported component variant: ${params.variant}`);
                }
                break;
            
            case "boundary":
                // Create boundary-specific params
                const boundaryParams = {
                    projectId: params.projectId,
                    diagramId: params.diagramId,
                    name: params.name,
                    description: params.description,
                    sprite: params.sprite,
                    tags: params.tags,
                    link: params.link,
                    type: params.type
                };
                
                // Route to specific boundary helper based on variant
                if (params.variant === "system" || params.variant === "standard") {
                    result = await boundaryHelpers.createSystemBoundary(boundaryParams, db);
                } else if (params.variant === "container") {
                    result = await boundaryHelpers.createContainerBoundary(boundaryParams, db);
                } else if (params.variant === "generic") {
                    result = await boundaryHelpers.createGenericBoundary(boundaryParams, db);
                } else {
                    return createErrorResponse(`Unsupported boundary variant: ${params.variant}`);
                }
                break;
                
            case "interface":
            case "type":
            case "enum":
                // Validate that we're using this in an interfaces diagram
                if (diagram.diagramType !== DiagramType.INTERFACE) {
                    return createErrorResponse("Interface elements can only be added to interfaces diagrams");
                }

                const interfaceType = params.elementType as InterfaceElementType;
                
                result = await interfaceHelpers.createInterfaceElement(
                    db, 
                    params.projectId, 
                    params.diagramId,
                    params.name,
                    params.description,
                    interfaceType, // The element type maps directly to the interface type
                    params.technology,
                    params.boundaryId
                );
                break;
            
            case "divider":
                if (diagram.diagramType !== DiagramType.SEQUENCE) {
                    return createErrorResponse("Dividers can only be added to sequence diagrams");
                }
                result = await sequenceHelpers.createDivider({
                    projectId: params.projectId,
                    diagramId: params.diagramId,
                    title: params.name
                }, db);
                break;
            
            case "group":
                if (diagram.diagramType !== DiagramType.SEQUENCE) {
                    return createErrorResponse("Groups can only be added to sequence diagrams");
                }
                result = await sequenceHelpers.createGroup({
                    projectId: params.projectId,
                    diagramId: params.diagramId,
                    title: params.name,
                    description: params.description
                }, db);
                break;
            
            default:
                return createErrorResponse(`Unsupported element type: ${params.elementType}`);
        }

        if (!result) {
          return createErrorResponse(`Unsupported element type and variant combination: ${params.elementType}/${params.variant}`);
        }

        // Create a formatted message based on the element type and variant
        const updateHelperMessage = "For any future changes to this element, use the update-element tool rather than creating a new diagram.";
        let message;
        
        if (params.elementType === "boundary") {
            // For boundaries, create a more appropriate message
            message = `Added ${params.variant} boundary "${params.name}" with ID ${result.element.id} to diagram "${result.diagram.name}".\n\n${updateHelperMessage}`;
        } else {
            // For regular elements
            const variantText = params.variant === 'standard' ? '' : ` ${params.variant}`;
            message = `Added${params.variant === 'external' ? ' external' : ''}${variantText} ${params.elementType} "${params.name}" with ID ${result.element.id} to diagram "${result.diagram.name}".\n\n${updateHelperMessage}`;
        }

        // Build complete metadata
        const metadata = createDiagramMetadata(result.diagram, params.projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error adding ${params.elementType}: ${getErrorMessage(error)}`);
      }
    }
  );
};