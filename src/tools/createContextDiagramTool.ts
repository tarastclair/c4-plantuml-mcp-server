import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateEmptyDiagram } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";
import { getDiagramFilePaths } from "../filesystem-utils.js";
import { DiagramType } from "../types-and-interfaces.js"; 

/**
 * Tool for creating a new C4 Context diagram within a project
 * This is typically the first diagram created for a system
 */
export const createContextDiagramTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "create-context-diagram",
    `Create a new C4 Context diagram within an existing architecture project.

    A Context diagram (C4 Level 1) shows your system in its environment, focusing on people and systems rather than technologies or implementation details. Use this when you need a high-level overview that stakeholders can easily understand.

    IMPORTANT: Before using this tool, you will need either:
    - the project ID returned from the create-c4-project tool
    - to locate the project ID of an existing project; In this case, the projectId can be found in a note within the PUML source code for each diagram in the existing project

    DO NOT create a new project if you have access to an existing project ID. Reusing the same project ID ensures proper relationships between different diagram levels.

    Benefits:
    - Automatic PlantUML code generation without needing to write syntax
    - Shows your system, its users, and external system dependencies
    - Perfect for explaining the big picture to executives and stakeholders
    
    Required Input Fields:
    - projectId: String (ID of the project to add this diagram to)
    - title: String (The name of your system/diagram)

    Optional Input Fields:
    - description: String (A brief explanation of what the diagram represents)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    and the diagram will be saved in your project's context/ directory.
    
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

        // Create a new context diagram
        const diagram = await db.createDiagram(
          project.id,
          title, 
          description,
          DiagramType.CONTEXT
        );

        // Get the file paths for this diagram within the project
        const { pumlPath, pngPath } = getDiagramFilePaths(project, title, DiagramType.CONTEXT);
        
        // Update diagram with file paths
        await db.updateDiagram(project.id, diagram.id, {
          pumlPath,
          pngPath
        });

        try {
          // Generate the diagram PUML and save it to disk
          const pngData = await generateEmptyDiagram(diagram, pumlPath);
        } catch (diagramError) {
          console.warn(`Failed to generate initial diagram: ${getErrorMessage(diagramError)}`);
        }

        const message = `Created new Context diagram "${title}" with ID ${diagram.id} in project "${project.name}".\n\nThe diagram has been saved to ${pumlPath}\n\nWe need to start by identifying the core system. What is it called, and what does it do?`;

        // Build complete metadata for the diagram
        const metadata = createDiagramMetadata(diagram, projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error creating context diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};