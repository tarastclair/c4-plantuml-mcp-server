import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const main = async () => {
  try {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["build/index.js"]
    });

    const client = new Client(
      {
        name: "c4-test-client",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    await client.connect(transport);
    console.log("Connected to server");

    const result = await client.callTool({
      name: "generateContextDiagram",
      arguments: {
        title: "E-Commerce System - System Context",
        description: "System Context diagram for our e-commerce platform",
        system: {
          name: "E-Commerce System",
          description: "Allows customers to browse products, place orders, and manage their accounts"
        },
        people: [
          {
            name: "Customer",
            description: "A registered customer of the e-commerce platform"
          },
          {
            name: "Customer Service Agent",
            description: "Handles customer inquiries and order issues"
          }
        ],
        relationships: [
          {
            from: "Customer",
            to: "E-Commerce System",
            description: "Views products, places orders",
            technology: "HTTPS/Web Browser"
          },
          {
            from: "Customer Service Agent",
            to: "E-Commerce System",
            description: "Manages orders, handles returns",
            technology: "Web Application"
          }
        ]
      }
    }) as CallToolResult;

    if (result.content?.[0]?.type === "text") {
      const { svg, pumlCode } = JSON.parse(result.content[0].text);
      console.log("\nPlantUML Code:");
      console.log(pumlCode);
      console.log("\nSVG Output Length:", svg.length, "bytes");
    }

    await transport.close();
    
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

main();