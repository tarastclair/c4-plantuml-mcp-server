/**
 * createContainerDiagramTool.ts
 * 
 * Tool for creating a new C4 Container diagram within a project
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateEmptyDiagram } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";
import { getDiagramFilePaths, findRelatedDiagrams } from "../filesystem-utils.js";
import { DiagramType } from "../types-and-interfaces.js"; 

/**
 * Tool for creating a new C4 Container diagram within a project
 * This allows zooming into a specific system to show its components
 */
export const createContainerDiagramTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "create-container-diagram",
    `Create a new C4 Container diagram within an existing architecture project.

    A Container diagram (C4 Level 2) zooms into a software system to show the containers (applications, data stores, microservices, etc.) that make up that system. Use this to show how system responsibilities are distributed across containers and how these containers communicate.

    IMPORTANT: Before using this tool, you must first create a project using the create-c4-project tool.
    You will need the project ID returned from that tool to create a container diagram.

    Benefits:
    - Shows the high-level technical building blocks and their interactions
    - Clarifies the architecture without going into implementation details
    - Helps identify major technology decisions required
    
    Required Input Fields:
    - projectId: String (ID of the project to add this diagram to)
    - title: String (The name of your system/diagram)

    Optional Input Fields:
    - description: String (A brief explanation of what the diagram represents)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    and the diagram will be saved in your project's container/ directory.
    
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

        // Create a new container diagram
        const diagram = await db.createDiagram(
          project.id,
          title, 
          description,
          DiagramType.CONTAINER
        );

        // Get the file paths for this diagram within the project
        const { pumlPath, pngPath } = getDiagramFilePaths(project, title, DiagramType.CONTAINER);
        
        // Update diagram with file paths
        await db.updateDiagram(project.id, diagram.id, {
          pumlPath,
          pngPath
        });

        // Look for a corresponding context diagram
        let contextMessage = "";
        try {
          const relatedDiagrams = await findRelatedDiagrams(project, title, DiagramType.CONTAINER);
          if (relatedDiagrams.parent) {
            contextMessage = `\n\nThis container diagram is linked to the context diagram with the same name. Elements from the context diagram can be referenced in this container diagram.`;
          } else {
            contextMessage = `\n\nNo matching context diagram found. For best C4 modeling practices, consider creating a context diagram first to establish the system boundary.`;
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

        const message = `Created new Container diagram "${title}" with ID ${diagram.id} in project "${project.name}".\n\nThe diagram has been saved to ${pumlPath}${contextMessage}\n\nLet's start by identifying the major containers (applications, data stores, services) that make up this system. What's the first container you'd like to add?`;

        // Build complete metadata for the diagram
        const metadata = createDiagramMetadata(diagram, projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error creating container diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};