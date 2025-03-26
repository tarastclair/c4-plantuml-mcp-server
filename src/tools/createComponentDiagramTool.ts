/**
 * createComponentDiagramTool.ts
 * 
 * Tool for creating a new C4 Component diagram within a project
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db/index.js";
import { generateEmptyDiagram } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";
import { getDiagramFilePaths, findRelatedDiagrams } from "../filesystem-utils.js";
import { DiagramType } from "../types-and-interfaces.js"; 

/**
 * Tool for creating a new C4 Component diagram within a project
 * This allows zooming into a specific container to show its components
 */
export const createComponentDiagramTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "create-component-diagram",
    `Create a new C4 Component diagram within an existing architecture project.
    
    If you need to make changes to an existing diagram, use the update-element and update-relationship tools instead.

    A Component diagram (C4 Level 3) zooms into a specific container to show the components that make up that container. Use this to show how container responsibilities are distributed across components and how these components interact.

    IMPORTANT: Before using this tool, you will need either:
    - the project ID returned from the create-c4-project tool
    - to locate the project ID of an existing project; In this case, the projectId can be found in a note within the PUML source code for each diagram in the existing project

    DO NOT create a new project if you have access to an existing project ID. Reusing the same project ID ensures proper relationships between different diagram levels.
    
    Benefits:
    - Shows the internal architecture of a specific container
    - Clarifies how responsibilities are distributed across components
    - Helps identify key classes, data structures, and libraries needed
    
    Required Input Fields:
    - projectId: String (ID of the project to add this diagram to)
    - title: String (The name of your container/diagram)

    Optional Input Fields:
    - description: String (A brief explanation of what the diagram represents)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    and the diagram will be saved in your project's component/ directory.
    
    Response Fields:
    - message: String (User-friendly message about the update)
    - projectId: String (UUID of the project)
    - elementIds: Object (Mappings of element IDs by diagram)
    
    You can use the add-element and add-relationship tools to design your diagram,
    and when you're finished, you must call the generate-diagram-image tool to create
    a png image of the completed diagram.`,
    {
      projectId: z.string().describe("ID of the project to add this diagram to"),
      title: z.string().describe("Title for the new diagram"),
      description: z.string().optional().describe("Optional description of what the diagram represents")
    },
    async ({ projectId, title, description }, extra) => {
      try {
        // First, check if the project exists
        const project = await db.getProject(projectId);
        if (!project) {
          return createErrorResponse(`Project not found with ID: ${projectId}`);
        }

        // Create a new component diagram
        const diagram = await db.createDiagram(
          project.id,
          title, 
          description,
          DiagramType.COMPONENT
        );

        // Get the file paths for this diagram within the project
        const { pumlPath, pngPath } = getDiagramFilePaths(project, title, DiagramType.COMPONENT);
        
        // Update diagram with file paths
        await db.updateDiagram(project.id, diagram.id, {
          pumlPath,
          pngPath
        });

        // Look for corresponding container diagrams
        let containerMessage = "";
        try {
          const relatedDiagrams = await findRelatedDiagrams(project, title, DiagramType.COMPONENT);
          if (relatedDiagrams.parent) {
            containerMessage = `\n\nThis component diagram is linked to the container diagram with the same name. Elements from the container diagram can be referenced in this component diagram.`;
          } else {
            containerMessage = `\n\nNo matching container diagram found. For best C4 modeling practices, consider creating a container diagram first to establish the container boundary.`;
          }
        } catch (error) {
          console.warn(`Failed to find related diagrams: ${getErrorMessage(error)}`);
        }

        try {
          // Generate the diagram PUML and save it to disk
          await generateEmptyDiagram(diagram, pumlPath);
        } catch (diagramError) {
          console.warn(`Failed to generate initial diagram: ${getErrorMessage(diagramError)}`);
        }

        const updateHelperMessage = "For any future changes to this diagram, use the update-element or update-relationship tools rather than creating a new diagram.";
        const message = `Created new Component diagram "${title}" with ID ${diagram.id} in project "${project.name}".\n\nThe diagram has been saved to ${pumlPath}${containerMessage}\n\nLet's start by identifying the major components (classes, modules, services) that make up this container.\n\n${updateHelperMessage}`;

        // Build complete metadata for the diagram
        const metadata = createDiagramMetadata(diagram, projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error creating component diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};