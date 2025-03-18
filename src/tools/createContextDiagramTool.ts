import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateEmptyDiagram } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, buildEntityMappings } from "../utils.js";
import { getDiagramFilePaths, savePumlFile, savePngFile } from "../filesystem-utils.js";
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

    IMPORTANT: Before using this tool, you must first create a project using the create-c4-project tool.
    You will need the project ID returned from that tool to create a context diagram.

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
    - entityIds: Object (Mappings of entity IDs by diagram)`,
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
          title, 
          description,
          DiagramType.CONTEXT
        );

        // Get the file paths for this diagram within the project
        const { pumlPath, pngPath } = getDiagramFilePaths(project, title, DiagramType.CONTEXT);
        
        // Update diagram with file paths
        await db.updateDiagram(diagram.id, {
          pumlPath,
          pngPath
        });

        try {
          // Generate and save the diagram files (both PUML and PNG)
          const pngData = await generateEmptyDiagram(diagram, pumlPath, pngPath);
          
          // Cache the diagram in the database
          if (pngData) {
            await db.cacheDiagram(diagram.id, pngData);
          }
        } catch (diagramError) {
          console.warn(`Failed to generate initial diagram: ${getErrorMessage(diagramError)}`);
        }

        // Add the diagram to the project
        await db.addDiagramToProject(projectId, diagram.id);

        const message = `Created new Context diagram "${title}" with ID ${diagram.id} in project "${project.name}".\n\nThe diagram has been saved to ${pumlPath}\n\nWe need to start by identifying the core system. What is it called, and what does it do?`;

        // Build entity mappings to help the client know what entities are available
        const entityMappings = buildEntityMappings(diagram);

        return createToolResponse(message, {
          projectId,
          entityIds: entityMappings
        });
      } catch (error) {
        return createErrorResponse(`Error creating context diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};