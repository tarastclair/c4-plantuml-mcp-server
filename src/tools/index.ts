/**
 * Tool implementations for the C4 diagram MCP server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiagramDb } from '../db.js';
import { registerNavigateWorkflowTool } from "./registerNavigateWorkflowTool.js";
import { registerUpdateElementTool } from "./registerUpdateElementTool.js";
import { registerUpdateRelationshipTool } from "./registerUpdateRelationshipTool.js";
import { registerCreateC4DiagramTool } from "./registerCreateC4DiagramTool.js";
import { registerAddSystemTool } from "./registerAddSystemTool.js";
import { registerAddPersonTool } from "./registerAddPersonTool.js";
import { registerAddExternalSystemTool } from "./registerAddExternalSystemTool.js";
import { registerAddRelationshipTool } from "./registerAddRelationshipTool.js";

/**
 * Register all tools with the MCP server
 * 
 * @param server MCP server instance
 * @param db Database instance
 */
export const registerAllTools = (server: McpServer, db: DiagramDb): void => {
  registerNavigateWorkflowTool(server, db);
  registerUpdateElementTool(server, db);
  registerUpdateRelationshipTool(server, db);
  registerCreateC4DiagramTool(server, db);
  registerAddSystemTool(server, db);
  registerAddPersonTool(server, db);
  registerAddExternalSystemTool(server, db);
  registerAddRelationshipTool(server, db);
};
