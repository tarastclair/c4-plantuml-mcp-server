import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  SystemIdentificationSchemaShape,
  UserActorDiscoverySchemaShape,
  ExternalSystemIdentificationSchemaShape,
  RelationshipDefinitionSchemaShape
} from './schemas.js';

/**
 * Registers the system identification prompt with the MCP server
 * This prompt helps users identify and describe the core system in the C4 diagram
 * 
 * @param server - The MCP server instance
 */
export const registerSystemIdentificationPrompt = (server: McpServer) => {
  server.prompt(
    "systemIdentification",
    SystemIdentificationSchemaShape,
    ({ name, description }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `System identified: ${name} - ${description}`
        }
      }]
    })
  );
};

/**
 * Registers the user/actor discovery prompt with the MCP server
 * This prompt helps identify people or roles that interact with the system
 * 
 * @param server - The MCP server instance
 */
export const registerUserActorDiscoveryPrompt = (server: McpServer) => {
  server.prompt(
    "userActorDiscovery",
    UserActorDiscoverySchemaShape,
    ({ name, description }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `User/Actor identified: ${name} - ${description}`
        }
      }]
    })
  );
};

/**
 * Registers the external system identification prompt with the MCP server
 * This prompt helps identify external systems that interact with the core system
 * 
 * @param server - The MCP server instance
 */
export const registerExternalSystemIdentificationPrompt = (server: McpServer) => {
  server.prompt(
    "externalSystemIdentification",
    ExternalSystemIdentificationSchemaShape,
    ({ name, description }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `External system identified: ${name} - ${description}`
        }
      }]
    })
  );
};

/**
 * Registers the relationship definition prompt with the MCP server
 * This prompt helps define relationships between elements in the diagram
 * 
 * @param server - The MCP server instance
 */
export const registerRelationshipDefinitionPrompt = (server: McpServer) => {
  server.prompt(
    "relationshipDefinition",
    RelationshipDefinitionSchemaShape,
    ({ from, to, description, technology }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: technology 
            ? `Relationship defined: ${from} → ${to}: ${description} (using ${technology})`
            : `Relationship defined: ${from} → ${to}: ${description}`
        }
      }]
    })
  );
};

/**
 * Register all prompts with the MCP server
 * This function centralizes prompt registration for easier management
 * 
 * @param server - The MCP server instance
 */
export const registerAllPrompts = (server: McpServer) => {
  registerSystemIdentificationPrompt(server);
  registerUserActorDiscoveryPrompt(server);
  registerExternalSystemIdentificationPrompt(server);
  registerRelationshipDefinitionPrompt(server);
};
