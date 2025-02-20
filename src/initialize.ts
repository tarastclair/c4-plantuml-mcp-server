import path from 'path';
import { DiagramDb } from './db.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Initialize the database with the given path or default
 * Creates the database if it doesn't exist
 * 
 * @param customDbPath Optional path to database directory
 * @returns Initialized database instance
 */
export const initializeDatabase = async (customDbPath?: string): Promise<DiagramDb> => {
  const dbPath = customDbPath || path.join(process.cwd(), 'data');
  const db = new DiagramDb(dbPath);
  
  try {
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
    name: "c4-diagrams",
    version: "1.0.0",
  });
};
