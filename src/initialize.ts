/**
 * AI ASSISTANCE DISCLAIMER
 * Parts of this code were written with the assistance of an AI language model.
 * While efforts have been made to ensure quality and correctness,
 * please review thoroughly before implementing in production environments.
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { DiagramDb } from './db/index.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the root directory of our application
 * This ensures consistent path resolution regardless of where the process is started
 */
export const getAppRoot = () => {
  // Go up one level from src to get to the app root
  return path.resolve(__dirname, '..');
};

/**
 * Initialize the database with the given path or default
 * Creates necessary directories if they don't exist
 * 
 * @param customDbPath Optional absolute path to database directory
 * @returns Initialized database instance
 */
export const initializeDatabase = async (customDbPath?: string): Promise<DiagramDb> => {
  try {
    // Use a data directory in our app root by default
    const dbPath = customDbPath || path.join(getAppRoot(), 'data');
    
    // Log the path we're trying to use
    console.error('Initializing database at:', dbPath);
    
    // Ensure data directory exists
    await fs.mkdir(dbPath, { recursive: true });
    
    const db = new DiagramDb(dbPath);
    await db.initialize();
    console.error('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

/**
 * Create and configure the MCP server instance
 * 
 * @returns Configured MCP server instance
 */
export const createServer = (): McpServer => {
  return new McpServer({
    name: "c4-diagram-server",
    version: "0.1.0",
  });
};