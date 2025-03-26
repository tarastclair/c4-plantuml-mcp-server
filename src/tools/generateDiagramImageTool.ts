import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs/promises";
import axios from 'axios';
import { DiagramDb } from "../db.js";
import { generateAndSaveDiagramImage } from "../plantuml-utils.js";
import { createToolResponse, getErrorMessage, createErrorResponse, createDiagramMetadata } from "../utils.js";

/**
 * Implementation of generate-diagram-image tool
 * This tool is responsible for generating the PNG image for a diagram
 * It should be used ONLY when the diagram design is complete to avoid
 * rate limiting issues with the PlantUML server
 */
export const generateDiagramImageTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "generate-diagram-image",
    `Generate a PNG image from the current state of the diagram.
    
    This tool generates a visual representation (PNG) of your C4 diagram by sending the PlantUML
    code to the PlantUML server. It should be used ONLY when you've finished designing your
    diagram to avoid rate limiting issues with the PlantUML server.
    
    All other diagram modification tools (add-element, add-relationship, etc.) only update
    the PlantUML source file but do not generate the image. You must explicitly call this
    tool when you have finished designing your diagram to create its visual representation
    for the user.
    
    Required Input Fields:
    - projectId: String (UUID from create-c4-project)
    - diagramId: String (UUID from create-context-diagram or create-container-diagram)
    
    Response Fields:
    - message: String (User-friendly message about the operation)
    - projectId: String (UUID of the project)
    - elementIds: Object (Mappings of element UUIDs to their names)`,
    {
      projectId: z.string().describe("UUID of the project from create-c4-project"),
      diagramId: z.string().describe("UUID of the diagram from create-context-diagram or create-container-diagram")
    },
    async ({ projectId, diagramId }, extra) => {
      try {
        // Check if project exists
        const project = await db.getProject(projectId);
        if (!project) {
          throw new Error(`Project ${projectId} not found. Please provide a valid project UUID.`);
        }
        
        // Check if diagram exists and belongs to the project
        const diagram = await db.getDiagram(project.id, diagramId);
        if (!diagram) {
          throw new Error(`Diagram ${diagramId} not found. Please provide a valid diagram UUID.`);
        }

        // Verify that the PUML file exists
        if (!diagram.pumlPath) {
          throw new Error("Diagram does not have a PUML file path specified.");
        }

        try {
          await fs.access(diagram.pumlPath);
        } catch (error) {
          throw new Error(`PUML file not found at ${diagram.pumlPath}. Please ensure the diagram has been created properly.`);
        }

        // Read the PUML content from file
        const pumlContent = await fs.readFile(diagram.pumlPath, 'utf8');
        
        // Generate and save the PNG image
        try {
          await generateAndSaveDiagramImage(pumlContent, diagram.pngPath);
          
          const message = `Successfully generated PNG image for diagram "${diagram.name}". The image has been saved to ${diagram.pngPath}. For any future changes to this diagram, use the update-element or update-relationship tools rather than creating a new diagram.`;

          // Build complete metadata for the diagram
          const metadata = createDiagramMetadata(diagram, projectId);

          return createToolResponse(message, metadata);
        } catch (error: any) {
          // Specific error handling for PlantUML server issues
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const statusText = error.response?.statusText || '';
            return createErrorResponse(`Status: ${status} ${statusText}`);
          }
          throw error;
        }
      } catch (error) {
        return createErrorResponse(`Error generating diagram image: ${getErrorMessage(error)}`);
      }
    }
  );
};