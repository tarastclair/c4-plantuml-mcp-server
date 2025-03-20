# C4 Diagram MCP Server

This project delivers an MCP server that enables creating architectural diagrams using PlantUML. The server helps you build your diagrams through natural conversation while ensuring adherence to [C4 abstractions and diagram types](https://c4model.com/).

The server uses [C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML) by referencing their raw `.puml` files in the generated PUML syntax for your diagram(s).

Here is an example of a context diagram generated exclusively by Claude for this code base:
![Context diagram for this code base](./doc/img/plantuml-mcp-server-context-diagram.png)

## Feature Roadmap
- [x] Support context diagram creation
- [x] Support boundaries (nested boundaries not included)
- [x] Support bi-directional relationships
- [x] Support extended system types (Db, Queue)
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

*Insert video here*

### Tips

- You do not need any other MCP servers configured in order for this tool to be functional, but having `sequential-thinking` installed will greatly enhance your experience.
- This tool will generate PUML source code and png images for your diagrams using a pre-configured directory structure. You can include the path where you would like that directory to be created in your initial prompt.
- If you generate different diagram levels across multiple chats, it is recommended that you upload the generated PUML source code from each completed diagram to the project knowledge (or utilize the `filesystem` MCP server and point Claude to the directory) so that it has access to all of the IDs to fetch in the database.
- If the call to the `generate-diagram-image` tool to create the png version of your diagram fails, as it sometimes does because we are using the public PlantUML server for this beta version of the code base, you can ask it to try again with a prompt like "Can you try again to generate the diagram image?".