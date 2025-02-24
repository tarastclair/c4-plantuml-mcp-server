# C4 Diagram MCP Server

This project delivers an MCP server that provides a guided workflow for creating architectural diagrams using PlantUML. The server helps you build your diagrams through natural conversation while ensuring adherence to [C4 abstractions and diagram types](https://c4model.com/).

The server uses [C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML) by referencing their raw `.puml` files in the generated PUML syntax for your diagram(s).

Here is an example of a context diagram generated exclusively by Claude for this code base:
![Context diagram for this code base](./doc/img/plantuml-mcp-server-context-diagram.png)

## Feature Roadmap
- [ ] Support context diagram creation
- [ ] Support system boundaries
- [ ] Support bi-directional relationships
- [ ] Support extended system types (Db, Queue)
- [ ] Support icons and sprites
- [ ] Support container diagram creation
- [ ] Support component diagram creation
- [ ] Support code diagram creation
- [ ] Support diagram styling: toggle legend on/off
- [ ] Support diagram styling: layout-as-sketch for working diagrams

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Internet connection (for PlantUML server access)

## Installation

1. Clone this repository

2. Install dependencies:
```bash
cd plantuml-mcp-server
npm install
```

3. Build the project:
```bash
npm run build
```

## Example Integration with Claude Desktop

1. Open Claude Desktop and access the config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the following configuration (adjust paths according to your environment):

```json
{
  "mcpServers": {
    "c4-diagrams": {
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

"I need to create a context diagram for this code base."

Claude will help you work through:
1. Defining your core system
2. Identifying users and actors
3. Adding external system dependencies
4. Establishing relationships between components
5. Refining the diagram details

The conversation will generate a PlantUML diagram that follows C4 methodology.
