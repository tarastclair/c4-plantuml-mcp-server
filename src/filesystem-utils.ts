/**
 * filesystem-utils.ts
 * 
 * Utilities for managing the filesystem structure of C4 projects
 * 
 * We're implementing a directory-based approach where:
 * - Each project has a root directory
 * - Each diagram type has its own subdirectory
 * - Diagram relationships are encoded through naming conventions
 */

import fs from 'fs/promises';
import path from 'path';
import { DiagramType, Project } from './types-and-interfaces.js';

/**
 * Subdirectory names for each diagram type
 * Using constants to ensure consistency across the application
 */
export const DIRECTORY_NAMES = {
  [DiagramType.CONTEXT]: 'context',
  [DiagramType.CONTAINER]: 'container',
  [DiagramType.COMPONENT]: 'component',
  [DiagramType.CODE]: 'code',
  [DiagramType.INTERFACE]: 'interface'
};

/**
 * Creates the base directory structure for a new project
 * 
 * We create a subdirectory for each diagram type to keep
 * the project organized and make relationships clear
 * 
 * @param projectPath Root path for the project
 * @returns Promise resolving when directories are created
 */
export async function createProjectDirectories(projectPath: string): Promise<void> {
  try {
    // Create project root (if it doesn't exist)
    await fs.mkdir(projectPath, { recursive: true });
    
    // Create subdirectories for each diagram type
    for (const dirName of Object.values(DIRECTORY_NAMES)) {
      await fs.mkdir(path.join(projectPath, dirName), { recursive: true });
    }
  } catch (error) {
    console.error('Error creating project directories:', error);
    throw new Error(`Failed to create project directory structure: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generates the file path for a diagram's PUML file
 * 
 * This is where our naming convention enforces the implicit relationship
 * between diagrams - a container diagram for "system-x" will have the same
 * name as its context diagram, but in the container/ directory
 * 
 * @param project Project containing the diagram
 * @param diagramName Name of the diagram (used for filename)
 * @param diagramType Type of diagram (determines subdirectory)
 * @returns Object containing paths for both PUML and PNG files
 */
export function getDiagramFilePaths(
  project: Project,
  diagramName: string, 
  diagramType: DiagramType
): { pumlPath: string; pngPath: string } {
  // Create a filename-safe version of the diagram name
  const safeFileName = diagramName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
    .substring(0, 50);            // Limit length for filesystem compatibility
  
  // Get the appropriate subdirectory for this diagram type
  const subDirectory = DIRECTORY_NAMES[diagramType];
  
  // Construct file paths
  const pumlFileName = `${safeFileName}.puml`;
  const pngFileName = `${safeFileName}.png`;
  
  return {
    pumlPath: path.join(project.rootPath, subDirectory, pumlFileName),
    pngPath: path.join(project.rootPath, subDirectory, pngFileName)
  };
}

/**
 * Saves a PUML file to disk
 * 
 * @param pumlPath Path where the file should be saved
 * @param pumlContent PlantUML content to save
 * @returns Promise that resolves when file is written
 */
export async function savePumlFile(pumlPath: string, pumlContent: string): Promise<void> {
  try {
    await fs.writeFile(pumlPath, pumlContent, 'utf8');
  } catch (error) {
    console.error('Error saving PUML file:', error);
    throw new Error(`Failed to save PUML file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Saves a PNG file to disk
 * 
 * @param pngPath Path where the file should be saved
 * @param pngData Base64-encoded PNG data
 * @returns Promise that resolves when file is written
 */
export async function savePngFile(pngPath: string, pngData: string): Promise<void> {
  try {
    const buffer = Buffer.from(pngData, 'base64');
    await fs.writeFile(pngPath, buffer);
  } catch (error) {
    console.error('Error saving PNG file:', error);
    throw new Error(`Failed to save PNG file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Finds related diagrams based on naming conventions and directory structure
 * 
 * This function helps implement our "filesystem-based relationships" approach by
 * finding diagrams related to the current one through our directory structure
 * 
 * @param project Project containing the diagrams
 * @param diagramName Name of the current diagram 
 * @param diagramType Type of the current diagram
 * @returns Promise resolving to related diagram paths
 */
export async function findRelatedDiagrams(
  project: Project,
  diagramName: string,
  diagramType: DiagramType
): Promise<{
  parent?: { path: string; type: DiagramType };
  children: { path: string; type: DiagramType }[];
}> {
  const result = {
    parent: undefined as { path: string; type: DiagramType } | undefined,
    children: [] as { path: string; type: DiagramType }[]
  };
  
  const safeFileName = diagramName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  
  try {
    // Find parent diagram (if applicable)
    // Context diagrams have no parents
    if (diagramType !== DiagramType.CONTEXT) {
      // Parent relationships by diagram type
      const parentType = 
        diagramType === DiagramType.CONTAINER ? DiagramType.CONTEXT :
        diagramType === DiagramType.COMPONENT ? DiagramType.CONTAINER :
        diagramType === DiagramType.CODE ? DiagramType.COMPONENT :
        null;
      
      if (parentType) {
        const parentDir = DIRECTORY_NAMES[parentType];
        const parentPath = path.join(project.rootPath, parentDir, `${safeFileName}.puml`);
        
        try {
          // Check if the parent file exists
          await fs.access(parentPath);
          // If no error, the file exists
          result.parent = {
            path: parentPath,
            type: parentType
          };
        } catch {
          // File doesn't exist, no parent
        }
      }
    }
    
    // Find child diagrams (if applicable)
    // Code diagrams have no children
    if (diagramType !== DiagramType.CODE) {
      // Child relationships by diagram type
      const childType = 
        diagramType === DiagramType.CONTEXT ? DiagramType.CONTAINER :
        diagramType === DiagramType.CONTAINER ? DiagramType.COMPONENT :
        diagramType === DiagramType.COMPONENT ? DiagramType.CODE :
        null;
      
      if (childType) {
        const childDir = DIRECTORY_NAMES[childType];
        const childrenDir = path.join(project.rootPath, childDir);
        
        try {
          // Get all files in the children directory
          const files = await fs.readdir(childrenDir);
          
          // Find matching children
          const childFiles = files.filter(file => 
            file.startsWith(`${safeFileName}`) && file.endsWith('.puml')
          );
          
          // Add all children to result
          result.children = childFiles.map(file => ({
            path: path.join(childrenDir, file),
            type: childType
          }));
        } catch {
          // Directory doesn't exist or can't be read
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error finding related diagrams:', error);
    // Return empty result rather than throwing, to gracefully handle filesystem issues
    return { parent: undefined, children: [] };
  }
}

/**
 * Extracts content from a PUML file
 * 
 * This is used to analyze existing diagrams and extract elements
 * to help maintain relationships between diagram levels
 * 
 * @param pumlPath Path to the PUML file
 * @returns Promise resolving to the file content
 */
export async function readPumlFile(pumlPath: string): Promise<string> {
  try {
    return await fs.readFile(pumlPath, 'utf8');
  } catch (error) {
    console.error('Error reading PUML file:', error);
    throw new Error(`Failed to read PUML file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validates that a path is within a project's directory structure
 * This is a security measure to prevent writing files outside the project
 * 
 * @param projectRoot Root path of the project
 * @param filePath Path to validate
 * @returns Boolean indicating if path is within project
 */
export function isPathWithinProject(projectRoot: string, filePath: string): boolean {
  const normalizedRoot = path.normalize(projectRoot);
  const normalizedPath = path.normalize(filePath);
  return normalizedPath.startsWith(normalizedRoot);
}