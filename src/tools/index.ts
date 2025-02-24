/**
 * Tool implementations for the C4 diagram MCP server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiagramDb } from '../db.js';
import { navigateWorkflowTool } from "./navigateWorkflowTool.js";
import { updateElementTool } from "./updateElementTool.js";
import { updateRelationshipTool } from "./updateRelationshipTool.js";
import { createContextDiagramTool } from "./createC4DiagramTool.js";
import { addSystemTool } from "./addSystemTool.js";
import { registerAddPersonTool } from "./addPersonTool.js";
import { addExternalSystemTool } from "./addExternalSystemTool.js";
import { addRelationshipTool } from "./addRelationshipTool.js";

/**
 * Register all tools with the MCP server
 * 
 * @param server MCP server instance
 * @param db Database instance
 */
export const registerAllTools = (server: McpServer, db: DiagramDb): void => {
  navigateWorkflowTool(server, db);
  updateElementTool(server, db);
  updateRelationshipTool(server, db);
  createContextDiagramTool(server, db);
  addSystemTool(server, db);
  registerAddPersonTool(server, db);
  addExternalSystemTool(server, db);
  addRelationshipTool(server, db);
};
