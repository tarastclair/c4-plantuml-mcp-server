/**
 * AI ASSISTANCE DISCLAIMER
 * Parts of this code were written with the assistance of an AI language model.
 * While efforts have been made to ensure quality and correctness,
 * please review thoroughly before implementing in production environments.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db/index.js";
import { generateEmptyDiagram } from "../plantuml-utils/index.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";
import { getDiagramFilePaths } from "../filesystem-utils.js";
import { DiagramType } from "../types-and-interfaces.js"; 

export const createSequenceDiagramTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "create-sequence-diagram",
    `Create a new C4-styled Sequence diagram within an existing architecture project.
    
    C4-PlantUML offers limited sequence diagram support that allows reusing existing elements 
    and relationships as participants and calls in a time-sequenced interaction flow.
    
    Note: For simplicity, this implementation does not support boundaries in sequence diagrams.

    Benefits:
    - Automatic PlantUML code generation
    - Shows interactions between components over time
    - Perfect for explaining complex flows to stakeholders
    
    Required Input Fields:
    - projectId: String (ID of the project to add this diagram to)
    - title: String (The name of your sequence diagram)

    Optional Input Fields:
    - description: String (A brief explanation of what the diagram represents)
    - showElementDescriptions: Boolean (Whether to show element descriptions in the diagram)
    - showFootBoxes: Boolean (Whether to show foot boxes in the diagram)
    - showIndex: Boolean (Whether to show message indices in the diagram)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    and the diagram will be saved in your project's sequence/ directory.`,
    {
      projectId: z.string().describe("ID of the project to add this diagram to"),
      title: z.string().describe("Title for the new diagram"),
      description: z.string().optional().describe("Optional description of what the diagram represents"),
      showElementDescriptions: z.boolean().optional().describe("Whether to show element descriptions in the diagram"),
      showFootBoxes: z.boolean().optional().describe("Whether to show foot boxes in the diagram"),
      showIndex: z.boolean().optional().describe("Whether to show message indices in the diagram")
    },
    async ({ projectId, title, description, showElementDescriptions, showFootBoxes, showIndex }, extra) => {
      try {
        // Check if project exists
        const project = await db.getProject(projectId);
        if (!project) {
          return createErrorResponse(`Project not found with ID: ${projectId}`);
        }

        // Create a new sequence diagram
        const diagram = await db.createDiagram(
          project.id,
          title, 
          description,
          DiagramType.SEQUENCE
        );

        // Add sequence-specific metadata options
        const metadata: Record<string, unknown> = {};
        if (showElementDescriptions !== undefined) metadata.showElementDescriptions = showElementDescriptions;
        if (showFootBoxes !== undefined) metadata.showFootBoxes = showFootBoxes;
        if (showIndex !== undefined) metadata.showIndex = showIndex;
        
        if (Object.keys(metadata).length > 0) {
          await db.updateDiagram(project.id, diagram.id, { metadata });
        }

        // Get the file paths for this diagram within the project
        const { pumlPath, pngPath } = getDiagramFilePaths(project, title, DiagramType.SEQUENCE);
        
        // Update diagram with file paths
        await db.updateDiagram(project.id, diagram.id, {
          pumlPath,
          pngPath
        });

        try {
          // Generate the diagram PUML and save it to disk
          await generateEmptyDiagram(diagram, pumlPath);
        } catch (diagramError) {
          console.warn(`Failed to generate initial diagram: ${getErrorMessage(diagramError)}`);
        }

        const message = `Created new Sequence diagram "${title}" with ID ${diagram.id} in project "${project.name}".\n\nThe diagram has been saved to ${pumlPath}\n\nLet's start by adding participants (Person, System, Container, Component) to your sequence diagram.\n\nTip: You can add special sequence elements like dividers and groups using the add-element tool with elementType="divider" or elementType="group".`;

        // Build complete metadata for the diagram
        const toolMetadata = createDiagramMetadata(diagram, projectId);

        return createToolResponse(message, toolMetadata);
      } catch (error) {
        return createErrorResponse(`Error creating sequence diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};