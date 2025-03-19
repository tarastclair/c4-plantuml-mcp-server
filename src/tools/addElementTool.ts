// addElementTool.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";
import * as personHelpers from "./internal/personElementHelpers.js";
import * as systemHelpers from "./internal/systemElementHelpers.js";
import * as containerHelpers from "./internal/containerElementHelpers.js";

export const addElementTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-element",
    `Add an element to a C4 diagram.
    
    This tool allows you to add any type of element (person, system, container, component) 
    to your C4 diagrams. The required parameters vary based on the element type and variant.
    
    Required Input Fields:
    - projectId: String (UUID of the project)
    - diagramId: String (UUID of the diagram)
    - elementType: String (Type of element: "person", "system", "container", or "component")
    - variant: String (Variant of the element: "standard", "external", "db", "queue", or "boundary")
    - name: String (Name of the element)
    - description: String (Description of the element)
    
    Conditional Input Fields:
    - technology: String (Required for container and component entities)
    - sprite: String (Optional icon for the element)
    - tags: String (Optional styling tags)
    - link: String (Optional URL link)
    - type: String (Optional type specifier)
    
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
      elementType: z.enum(["person", "system", "container", "component"]).describe("Type of element to add"),
      variant: z.enum(["standard", "external", "db", "queue", "boundary"]).describe("Variant of the element"),
      name: z.string().describe("Name of the element"),
      description: z.string().describe("Description of the element"),
      technology: z.string().optional().describe("Technology used (required for container and component entities)"),
      sprite: z.string().optional().describe("Optional icon for the element"),
      tags: z.string().optional().describe("Optional styling tags"),
      link: z.string().optional().describe("Optional URL link"),
      type: z.string().optional().describe("Optional type specifier")
    },
    async (params, extra) => {
      // Validate technology field for container and component entities
      if (["container", "component"].includes(params.elementType) && !params.technology) {
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
                }
                // Add other system variants as needed
                break;
            
            case "container":
                if (params.variant === "standard" || params.variant === "db" || params.variant === "queue" || params.variant === "external") {
                    // Create container-specific params object with only the properties needed by container helpers
                    const containerParams = {
                    projectId: params.projectId,
                    diagramId: params.diagramId,
                    name: params.name,
                    description: params.description,
                    technology: params.technology || "",  // Ensure we have a technology value
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
                    }
                } else if (params.variant === "boundary") {
                    // Boundary has a different parameter structure - create boundary-specific params
                    const boundaryParams = {
                    projectId: params.projectId,
                    diagramId: params.diagramId,
                    name: params.name,
                    description: params.description,
                    tags: params.tags,
                    link: params.link
                    };
                    
                    result = await containerHelpers.createContainerBoundary(boundaryParams, db);
                }
                break;
            
          case "component":
            // Similar routing for component variants
            break;
        }

        if (!result) {
          return createErrorResponse(`Unsupported element type and variant combination: ${params.elementType}/${params.variant}`);
        }

        // Create a formatted message based on the element type and variant
        const variantText = params.variant === 'standard' ? '' : ` ${params.variant}`;
        const message = `Added${params.variant === 'external' ? ' external' : ''}${variantText} ${params.elementType} "${params.name}" with ID ${result.element.id} to diagram "${result.diagram.name}".\n\nWhat would you like to add next?`;

        // Build complete metadata
        const metadata = createDiagramMetadata(result.diagram, params.projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error adding ${params.elementType}: ${getErrorMessage(error)}`);
      }
    }
  );
};