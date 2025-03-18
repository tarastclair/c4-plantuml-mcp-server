import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { createProjectDirectories } from "../filesystem-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage } from "../utils.js";
import path from "path";
import fs from "fs/promises";
import { getAppRoot } from "../initialize.js";

/**
 * Implements the create-c4-project tool which initializes a new C4 project
 * 
 * This is the entry point for a user starting their C4 modeling process,
 * establishing a project to contain all related diagrams.
 */
export const createC4ProjectTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "create-c4-project",
    `Create a new C4 architecture project and establish a filesystem structure for your diagrams.

    A C4 project is a collection of related architecture diagrams that describe a system at different levels of detail. This tool sets up the foundation for creating a cohesive set of diagrams including Context (L1), Container (L2), Component (L3), and Code (L4) diagrams.

    IMPORTANT: Before using this tool, you should first ask the user where they want to save their diagrams on their computer. The user needs to specify a directory path where they have write permissions.

    Examples of good questions to ask:
    - "Where would you like to save your C4 architecture diagrams on your computer?"
    - "What directory path should I use for your architecture project?"
    - "Do you have a preferred location for storing your C4 diagrams?"

    This tool will create:
    1. A project entry in the database
    2. A directory structure on the user's filesystem:
       - <project-path>/context/    (for Context diagrams)
       - <project-path>/container/  (for Container diagrams)
       - <project-path>/component/  (for Component diagrams)
       - <project-path>/code/       (for Code diagrams)

    After creating a project, you'll need to use one of these tools to create actual diagrams:
    - create-context-diagram
    - create-container-diagram
    - create-component-diagram
    - create-code-diagram
    
    Required Input Fields:
    - name: String (Name of the project)
    - rootPath: String (Filesystem path where project directories will be created)

    Optional Input Fields:
    - description: String (A brief explanation of what the project represents)
    
    The response will include the project ID needed for subsequent diagram creation operations.
    
    Response Fields:
    - message: String (User-friendly message about the operation)
    - projectId: String (UUID of the created project)`,
    {
      name: z.string().describe("Name of the architecture project"),
      rootPath: z.string().describe("Filesystem path where project directories will be created"),
      description: z.string().optional().describe("Optional description of what the project represents")
    },
    async ({ name, rootPath, description }, extra) => {
      try {
        // Normalize and validate the path
        let normalizedPath = rootPath;

        // Handle relative paths by converting to absolute
        if (!path.isAbsolute(normalizedPath)) {
          normalizedPath = path.resolve(getAppRoot(), normalizedPath);
        }

        // Create a project-specific subdirectory based on the name
        const safeProjectName = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50);

        const fullProjectPath = path.join(normalizedPath, safeProjectName);

        try {
          // Check if we can access/create the directory
          await fs.access(path.dirname(fullProjectPath));
        } catch (accessError) {
          return createErrorResponse(
            `Cannot access the specified directory path. Please ensure the directory exists and you have permission to write to it: ${normalizedPath}`
          );
        }

        // Create the project directories
        await createProjectDirectories(fullProjectPath);

        // Create project in database
        const now = new Date().toISOString();
        const project = {
          id: crypto.randomUUID(), // Using native crypto for UUID
          name,
          description,
          rootPath: fullProjectPath,
          diagrams: [],
          created: now,
          updated: now,
        };

        // Store the project (assuming we've updated the DiagramDb class with project methods)
        await db.createProject(project);

        const message = `Created new C4 architecture project "${project.name}" with ID ${project.id} at ${fullProjectPath}.\n\nYou can now create diagrams within this project using the following tools:\n- create-context-diagram (for Level 1 Context diagrams)\n- create-container-diagram (for Level 2 Container diagrams)\n- create-component-diagram (for Level 3 Component diagrams)\n- create-code-diagram (for Level 4 Code diagrams)\n\nWhat type of diagram would you like to create first?`;

        return createToolResponse(message, {
            projectId: project.id,
            diagramId: '',
            diagrams: {}
          });
      } catch (error) {
        return createErrorResponse(`Error creating project: ${getErrorMessage(error)}`);
      }
    }
  );
};