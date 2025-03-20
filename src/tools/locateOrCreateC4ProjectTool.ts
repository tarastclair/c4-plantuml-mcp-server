import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiagramDb } from "../db.js";
import { createProjectDirectories } from "../filesystem-utils.js";
import { createToolResponse, createErrorResponse, getErrorMessage, DiagramElementMapping } from "../utils.js";
import path from "path";
import fs from "fs/promises";
import { getAppRoot } from "../initialize.js";
import { DiagramType } from "../types-and-interfaces.js";

/**
 * 
 * This is the entry point for a user starting their C4 modeling process,
 * locating an existing or establishing a new project to contain all related diagrams.
 */

``
export const locateOrCreateC4ProjectTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "locate-or-create-c4-project",
    `A C4 project is a collection of related architecture diagrams that describe a system at different levels of detail. This tool sets up the foundation for creating a cohesive set of diagrams including Context (L1), Container (L2), Component (L3), and Code (L4) diagrams.

    IMPORTANT: If your intent is to create a container, component, or code diagram, then it is likely that a project
    already exists and you SHOULD NOT create a new project. Instead:
    1. Check for existing project IDs in any PUML code shared in the conversation
    2. Look for notes like: "This diagram is part of the X project with ID Y"
    3. If you find a project ID, DO NOT use this tool and skip directly to calling the appropriate diagram creation tool
    
    Creating multiple disconnected projects for the same system will break diagram relationships and navigation.
    
    Conditional Input Fields:
    To locate an existing project:
    - id: String (UUID of an existing project - use this if you already know the project ID)
    
    To search for or create a project:
    - name: String (Name of the architecture project to search for or create)
    - rootPath: String (Filesystem path where project directories will be created if needed)
    - description: String (A brief explanation of what the project represents)
       
    Response Fields:
    - message: String (User-friendly message about the operation)
    - projectId: String (UUID of the existing or newly created project)
    - diagrams: Object (Information about existing diagrams if a project was found)`,
    {
      id: z.string().optional().describe("UUID of an existing project - use this if you already know the project ID"),
      name: z.string().optional().describe("Name of the architecture project to search for or create"),
      rootPath: z.string().optional().describe("Filesystem path where project directories will be created if needed"),
      description: z.string().optional().describe("Optional description of what the project represents")
    },
    async ({ id, name, rootPath, description }, extra) => {
      try {
        // Input validation - ensure we have either id OR (name and rootPath)
        if (!id && (!name || !rootPath)) {
          return createErrorResponse(
            "Invalid input: You must provide either an 'id' to locate an existing project, " +
            "OR both 'name' and 'rootPath' to search for or create a project."
          );
        }
        
        // PHASE 1: Direct project lookup by ID if provided
        if (id) {
          const project = await db.getProject(id);
          if (!project) {
            return createErrorResponse(
              `No project found with ID: ${id}. Please check if the project ID is correct. ` +
              `If you're creating a new project, provide 'name' and 'rootPath' instead of 'id'.`
            );
          }
          
          // Create properly structured diagrams metadata
          const diagramsMetadata: { [diagramId: string]: DiagramElementMapping } = {};
          
          // Add each diagram to the metadata structure
          project.diagrams.forEach(diagram => {
            diagramsMetadata[diagram.id] = {
              name: diagram.name,
              type: diagram.diagramType,
              elements: {},  // We don't have detailed elements when just listing projects
              relationships: {}
            };
          });
          
          const message = `Found project "${project.name}" (ID: ${project.id}).\n\n` +
            `You should proceed with the appropriate diagram creation tool using this project ID.`;
            
          return createToolResponse(message, {
            projectId: project.id,
            // Don't include diagramId since we're not working with a specific diagram
            diagrams: diagramsMetadata
          });
        }

        // We've validated that name and rootPath are provided if we reach here
        // PHASE 2: Look for similar existing projects
        if (!name || !rootPath) {
          return createErrorResponse(
            "Invalid input: You must provide both 'name' and 'rootPath' to create a new project."
          );
        }

        const existingProjects = await db.listProjects();
        const normalizedNewName = name.toLowerCase().trim();
        
        // Look for potential matches using various similarity methods
        const potentialMatches = existingProjects.filter(project => {
          const projectName = project.name.toLowerCase().trim();
          
          // Different matching strategies
          const exactMatch = projectName === normalizedNewName;
          const includedMatch = projectName.includes(normalizedNewName) || normalizedNewName.includes(projectName);
          
          // Simple word overlap check (handles cases like "Plant API" and "API for Plants")
          const newNameWords = new Set(normalizedNewName.split(/\s+/).filter(w => w.length > 2));
          const projectNameWords = new Set(projectName.split(/\s+/).filter(w => w.length > 2));
          const wordOverlap = [...newNameWords].some(word => projectNameWords.has(word));
          
          return exactMatch || includedMatch || wordOverlap;
        });
        
        if (potentialMatches.length > 0) {
          // Found potential matches - use the first one (could enhance to select best match)
          const match = potentialMatches[0];
          
          // Determine what diagram type the user likely wants to create next
          const existingTypes = new Set(match.diagrams.map(d => d.diagramType));
          
          let suggestedNextTool = "create-context-diagram";
          
          if (existingTypes.has(DiagramType.CONTEXT) && !existingTypes.has(DiagramType.CONTAINER)) {
            suggestedNextTool = "create-container-diagram";
          } else if (existingTypes.has(DiagramType.CONTAINER) && !existingTypes.has(DiagramType.COMPONENT)) {
            suggestedNextTool = "create-component-diagram";
          } else if (existingTypes.has(DiagramType.COMPONENT) && !existingTypes.has(DiagramType.CODE)) {
            suggestedNextTool = "create-code-diagram";
          }
          
          // Format diagram information for display
          const diagramInfoText = match.diagrams.length > 0 ? 
            match.diagrams.map(d => `- ${d.name} (${d.diagramType})`).join('\n') : 
            "No diagrams created yet";
          
          // Create properly structured diagrams metadata
          const diagramsMetadata: { [diagramId: string]: DiagramElementMapping } = {};
          
          // Add each diagram to the metadata structure
          match.diagrams.forEach(diagram => {
            diagramsMetadata[diagram.id] = {
              name: diagram.name,
              type: diagram.diagramType,
              elements: {},  // We don't have detailed elements when just listing projects
              relationships: {}
            };
          });
          
          const message = `Found similar existing project "${match.name}" (ID: ${match.id}).\n\n` +
            `To maintain proper diagram relationships, you should use this existing project ID ` + 
            `with the appropriate diagram creation tool.\n\n` +
            `Existing diagrams in this project:\n${diagramInfoText}\n\n` +
            `Based on the existing diagrams, you should likely use:\n` +
            `${suggestedNextTool} with projectId: ${match.id}\n\n` +
            `What would you like to create next?`;
            
          return createToolResponse(message, {
            projectId: match.id,
            // Don't include diagramId since we're not working with a specific diagram
            diagrams: diagramsMetadata
          });
        }

        // If we reach here, no existing project was found and we need to create a new one
        // PHASE 3: Create a new project if no match found

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

        // Store the project
        await db.createProject(project);

        const message = `Created new C4 architecture project "${project.name}" with ID ${project.id} at ${fullProjectPath}.\n\n` +
          `You can now create diagrams within this project using the following tools:\n` +
          `- create-context-diagram (for Level 1 Context diagrams)\n` +
          `- create-container-diagram (for Level 2 Container diagrams)\n` +
          `- create-component-diagram (for Level 3 Component diagrams)\n` +
          `- create-code-diagram (for Level 4 Code diagrams)\n\n` +
          `What type of diagram would you like to create first?`;

        // For a new project, we have an empty diagrams structure that matches the expected type
        return createToolResponse(message, {
          projectId: project.id,
          // For new projects, use empty diagrams object
          diagrams: {}
        });
      } catch (error) {
        return createErrorResponse(`Error with project operation: ${getErrorMessage(error)}`);
      }
    }
  );
};