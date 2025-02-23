# C4 Context Diagram MCP Server

An MCP server that provides a guided workflow for creating C4 Context diagrams using PlantUML. The server helps you build your diagrams through natural conversation while ensuring adherence to C4 methodology.

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Claude Desktop App (latest version)
- Internet connection (for PlantUML server access)

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/plantuml-mcp-server.git
cd plantuml-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuring Claude Desktop

1. Open Claude Desktop and access the config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the following configuration (adjust paths according to your environment):

```json
{
  "mcpServers": {
    "c4-context": {
      "command": "node",
      "args": [
        "ABSOLUTE/PATH/TO/plantuml-mcp-server/build/index.js"
      ]
    }
  }
}
```

3. Restart Claude Desktop using `CTRL+Q` or `CMD+Q`

## Usage Example

Once configured, you can start a new diagram by telling Claude something like:

"I need to create a C4 Context diagram for [your system]"

Claude will guide you through:
1. Defining your core system
2. Identifying users and actors
3. Adding external system dependencies
4. Establishing relationships between components
5. Refining the diagram details

The conversation will generate PlantUML diagrams that follow C4 methodology, which Claude will render for you automatically.

## Available Tools

The server provides both guided workflow and direct tools:

### Guided Workflow
- Start a new diagram
- Add systems, people, and external systems
- Define relationships
- Modify existing elements
- Review and refine the diagram

### Direct Tools
- `add-system`: Add a new system to the diagram
- `add-person`: Add a person/actor to the diagram
- `add-external-system`: Add an external system dependency
- `update-relationships`: Modify relationships between elements
- `generate-svg`: Generate a new SVG of the current diagram

## Troubleshooting

1. **Claude doesn't show the hammer icon**
   - Verify your claude_desktop_config.json syntax
   - Ensure the path to index.js is absolute and correct
   - Check Claude's logs for errors
   - Restart Claude Desktop

2. **SVG Generation Fails**
   - Confirm internet connectivity
   - Check if the PlantUML server is accessible
   - Review syntax of your diagram elements

3. **Common Error Messages**
   - "Command not found": Verify Node.js installation and path
   - "ENOENT": Check file paths in your config
   - "Module not found": Run npm install again
