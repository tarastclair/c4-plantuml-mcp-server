import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from 'axios';

// Import the system and user/actor identification prompts
import { 
  registerSystemIdentificationPrompt, 
  registerUserActorDiscoveryPrompt 
} from './prompts.js';

// PlantUML server utilities
const encodePlantUML = (puml: string): string => {
  return Buffer.from(puml).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const generateSVG = async (puml: string): Promise<string> => {
  const encoded = encodePlantUML(puml);
  const response = await axios.get(`https://www.plantuml.com/plantuml/svg/${encoded}`, {
    responseType: 'text'
  });
  return response.data;
};

// Create server instance
const server = new McpServer({
  name: "c4-diagrams",
  version: "1.0.0",
});

// Register prompts
registerSystemIdentificationPrompt(server);
registerUserActorDiscoveryPrompt(server);

// Existing context diagram generation tool
server.tool(
  "generateContextDiagram",
  "Generate a C4 Context diagram from the provided system, people, and relationships",
  {
    title: z.string().describe("Title of the diagram"),
    description: z.string().optional().describe("Optional description of the diagram"),
    system: z.object({
      name: z.string(),
      description: z.string()
    }),
    people: z.array(z.object({
      name: z.string(),
      description: z.string()
    })),
    relationships: z.array(z.object({
      from: z.string(),
      to: z.string(),
      description: z.string(),
      technology: z.string().optional()
    }))
  },
  async ({ title, description, system, people, relationships }) => {
    // Generate PlantUML code
    const lines = [
      '@startuml',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml',
      '',
      `title ${title}`,
      ''
    ];

    if (description) {
      lines.push(`description ${description}`, '');
    }

    // Add system
    lines.push(
      `System(${system.name.replace(/\s+/g, '_')}, "${system.name}", "${system.description}")`,
      ''
    );

    // Add people
    people.forEach(person => {
      lines.push(
        `Person(${person.name.replace(/\s+/g, '_')}, "${person.name}", "${person.description}")`
      );
    });
    lines.push('');

    // Add relationships
    relationships.forEach(rel => {
      const techStr = rel.technology ? `, "${rel.technology}"` : '';
      lines.push(
        `Rel(${rel.from.replace(/\s+/g, '_')}, ${rel.to.replace(/\s+/g, '_')}, "${rel.description}"${techStr})`
      );
    });

    lines.push('@enduml');
    const pumlCode = lines.join('\n');

    try {
      // Generate the SVG using public PlantUML server
      const svg = await generateSVG(pumlCode);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            svg,
            pumlCode  // Include the PlantUML code for debugging/reference
          })
        }]
      };
    } catch (error) {
      console.error('Error generating diagram:', error);
      throw error;
    }
  }
);

// Start the MCP server
const main = async () => {
  try {
    // Connect transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('C4 Diagrams MCP Server started successfully');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

main();