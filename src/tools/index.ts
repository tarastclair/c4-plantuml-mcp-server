/**
 * Tool implementations for the C4 diagram MCP server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiagramDb } from '../db.js';
import { updateElementTool } from "./updateElementTool.js";
import { updateRelationshipTool } from "./updateRelationshipTool.js";
import { createContextDiagramTool } from "./createContextDiagramTool.js";
import { addElementTool } from "./addElementTool.js";
import { addRelationshipTool } from "./addRelationshipTool.js";
import { locateOrCreateC4ProjectTool } from "./locateOrCreateC4ProjectTool.js";
import { deleteElementTool } from "./deleteElementTool.js";
import { createContainerDiagramTool } from "./createContainerDiagramTool.js";
import { createComponentDiagramTool } from "./createComponentDiagramTool.js";
import { generateDiagramImageTool } from "./generateDiagramImageTool.js";

/**
 * Register all tools with the MCP server
 * 
 * @param server MCP server instance
 * @param db Database instance
 */
export const registerAllTools = (server: McpServer, db: DiagramDb): void => {
  updateElementTool(server, db);
  updateRelationshipTool(server, db);
  createContextDiagramTool(server, db);
  addElementTool(server, db);
  addRelationshipTool(server, db);
  locateOrCreateC4ProjectTool(server, db);
  deleteElementTool(server, db);
  createContainerDiagramTool(server, db);
  createComponentDiagramTool(server, db);
  generateDiagramImageTool(server, db);
};
