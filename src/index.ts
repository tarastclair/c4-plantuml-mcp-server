import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeDatabase, createServer } from './initialize.js';
import { registerAllTools } from './tools.js';

/**
 * Main application function
 * Initializes and starts the MCP server
 */
const main = async () => {
  try {
    // Initialize database
    const db = await initializeDatabase();
    
    // Create MCP server instance
    const server = createServer();
    
    // Register tools
    registerAllTools(server, db);
    
    // Connect transport and start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('C4 Diagrams MCP Server started successfully');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

// Run the application
main();