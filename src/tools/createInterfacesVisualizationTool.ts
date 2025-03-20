import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { generateEmptyDiagram } from "../plantuml-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, createDiagramMetadata } from "../utils.js";
import { getDiagramFilePaths } from "../filesystem-utils.js";
import { DiagramType } from "../types-and-interfaces.js"; 

/**
 * Tool for creating a new C4-styled interfaces visualization diagram
 * This specialized diagram visualizes interfaces, types, and relationships
 * between these elements to provide a clear view of the type system
 */
export const createInterfacesVisualizationTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "create-interfaces-visualization",
    `Create a new C4-styled interfaces visualization diagram within an existing architecture project.

    An interfaces diagram is a specialized C4-styled visualization that shows your type system in a 
    comprehensible format, with clear styling for interfaces, types, enums, and the relationships 
    between them. It's ideal for documenting complex type systems and API contracts.

    IMPORTANT: Before using this tool, you will need either:
    - the project ID returned from the create-c4-project tool
    - to locate the project ID of an existing project; In this case, the projectId can be found in a note
      within the PUML source code for each diagram in the existing project

    Benefits:
    - Automatic PlantUML code generation with consistent C4 styling
    - Clear visualization of interfaces, types, and their relationships
    - Customized styling to distinguish between different element types
    
    Required Input Fields:
    - projectId: String (ID of the project to add this diagram to)
    - title: String (The name of your interfaces diagram)

    Optional Input Fields:
    - description: String (A brief explanation of what the diagram represents)
    
    The response will include unique IDs that you'll need for all subsequent operations,
    and the diagram will be saved in your project's interfaces/ directory.
    
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

        // Create a new interfaces diagram
        const diagram = await db.createDiagram(
          project.id,
          title, 
          description,
          DiagramType.INTERFACE
        );

        // Get the file paths for this diagram within the project
        const { pumlPath, pngPath } = getDiagramFilePaths(project, title, DiagramType.INTERFACE);
        
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

        const message = `Created new Interfaces diagram "${title}" with ID ${diagram.id} in project "${project.name}".\n\nThe diagram has been saved to ${pumlPath}\n\nWe need to start by identifying the core interfaces, types, and enums. What type system elements would you like to visualize?`;

        // Build complete metadata for the diagram
        const metadata = createDiagramMetadata(diagram, projectId);

        return createToolResponse(message, metadata);
      } catch (error) {
        return createErrorResponse(`Error creating interfaces diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};