# C4 Diagram Skill Conversion Plan Architecture and Design

## Language Choice Strategy

**Rationale for Language Selection:**
- JavaScript was used in the original MCP implementation for ease of deployment
- With Skills, there is no deployment - scripts run locally via Claude's Bash tool
- Language choice should optimize for minimal setup and installation steps

**Language Selection Criteria:**
1. **Bash (preferred)**: Use for simple operations to minimize dependencies
   - Directory/file operations
   - Simple validation checks
   - Orchestration of other tools
   - No installation required - available on all Unix-like systems

2. **Python (when needed)**: Use for more complex behavior requiring:
   - HTTP requests with retry logic
   - Complex error handling and parsing
   - Data transformation or templating
   - More readable for complex algorithms
   - Widely available, minimal setup required

3. **Avoid JavaScript/Node.js**: Requires Node.js installation, adds unnecessary dependency

**Script Language Assignments:**
- `init-structure.sh` - **Bash** (simple directory creation)
- `render-diagram.py` - **Python** (HTTP requests, retry logic, error handling)

## Requirements and Dependencies

**System Requirements:**
- **Bash** - Available on all Unix-like systems (Linux, macOS, WSL)
- **Python 3.6+** - Widely available, minimal standard library dependencies
- **Internet access** - To reach public PlantUML server (http://www.plantuml.com/plantuml/)
- **File system write permissions** - In working directory

**Python Dependencies:**
- Uses Python standard library (`urllib` for HTTP requests, `json`, `sys`, `os`, `time`)
- No external packages required (no pip install needed)
- Falls back gracefully if `requests` library is available but not required

**Why Bash + Python?**
- **Minimal setup**: Both typically pre-installed on developer systems
- **No package managers**: No npm/pip installs required for basic functionality
- **Cross-platform**: Works on Linux, macOS, WSL without modification
- **Maintainable**: Clear, readable code for simple operations

**Verification Step for SKILL.md:**
Include a requirements section that Claude can reference to inform users of prerequisites.

## Key Changes from MCP Architecture

| MCP Server | Skill |
|------------|-------|
| Persistent process with stdio transport | Stateless scripts called by Claude |
| 12 MCP tools exposed | 2 minimal scripts (bash + python) |
| MCP SDK dependency | Zero external protocol dependencies |
| LowDB for state management | File-based storage using directory structure |
| Project discovery & fuzzy matching | Rely on diagrams/ directory in current working directory |
| Dedicated update/delete tools | Edit tool with Claude's natural language understanding |
| Requires filesystem MCP server | Uses Claude's native Bash/Read/Write/Edit tools |
| Tool registration in index.ts | Script execution via `bash/python3 scripts/` |
| Maintains state between calls | Completely stateless - rebuilds context from files |
| Node.js/JavaScript required | Bash + Python (widely available, minimal dependencies) |

## Progressive Disclosure Strategy

**Always Loaded (SKILL.md)**
- Workflow phases with specific commands
- When to use each diagram type (brief overview)
- Script execution patterns
- Error handling instructions
- Requirements and dependencies

**Lazy-Loaded (reference/) - Linked with Markdown Syntax**
- [C4 Model Theory](./reference/c4-model.md) - Detailed explanation of C4 model levels and principles
- [Diagram Types Guide](./reference/diagram-types.md) - When to use context/container/component/sequence diagrams
- [Syntax Reference](./reference/syntax-reference.md) - Element macros, ID sanitization, special syntax rules
- [Best Practices](./reference/best-practices.md) - Design tips, common patterns, and anti-patterns
- [C4-PlantUML Library Docs](./reference/c4-plantuml-readme.md) - Complete library documentation (for deep dives)

**Templates - Loaded on Demand**
- Load when creating new diagram using Read tool
- Provide boilerplate PUML structure with C4-PlantUML imports
- Include helpful placeholder comments with syntax examples:
  - Context: Person, System, System_Ext relationship examples
  - Container: Container, ContainerDb, ContainerQueue examples
  - Component: Component with technology parameter examples
  - Sequence: Divider syntax, relationship ordering, special options
- Based on boilerplate from original `generateEmptyDiagram()` function

**Convention Notes:**
- Use `./` prefix for relative paths in SKILL.md links
- Reference docs should be one-level deep (no nested references)
- Files >100 lines should include table of contents
- Use consistent terminology throughout all documentation

## Design Philosophy & Intentional Changes from MCP design

The Skills conversion represents **intentional architectural simplification** rather than missing functionality:

**1. No "Project" Concept**
- **MCP Version**: Projects were database entities with names, IDs, metadata, and discovery features
- **Skills Version**: The `doc/diagrams/` directory at project root IS your project
- **Rationale**: Skills must be stateless; project discovery/fuzzy matching requires persistent state
- **Impact**: Skill creates/uses `doc/diagrams/` at project root automatically
- **Trade-off**: Simpler but fixed location at doc/diagrams/

**2. Natural Language Editing Over Programmatic Tools**
- **MCP Version**: Dedicated tools for update-element, update-relationship, delete-entity
- **Skills Version**: Claude uses Edit tool with natural language understanding
- **Rationale**: Claude's intelligence can parse PUML and make surgical edits without structured database
- **Example**: "Remove the database container and its relationships" → Claude reads PUML, identifies lines, uses Edit tool
- **Trade-off**: Requires Claude to understand context vs. simple API calls; more flexible but less predictable

**3. File-Based State Reconstruction**
- **MCP Version**: LowDB stores elements, relationships, metadata with IDs and foreign keys
- **Skills Version**: All state lives in PUML files; Claude parses to understand structure
- **Rationale**: Git-friendly, human-readable, no database setup, portable
- **Example**: To find all elements → Read PUML file and parse Person/System/Container macros
- **Trade-off**: No relational integrity validation; Claude must infer relationships from syntax

**4. Minimal Scripts, Maximum Claude Intelligence**
- **MCP Version**: 12 specialized tools with validation, error handling, state management
- **Skills Version**: 2 utility scripts (init-structure.sh, render-diagram.py) + Claude's native tools
- **Rationale**: Reduce maintenance burden, leverage Claude's reasoning over procedural code
- **Impact**: Claude handles diagram logic through Read/Write/Edit; scripts only for filesystem and HTTP
- **Trade-off**: More dependent on Claude's understanding; less guardrails but more adaptable

## Stateless Architecture Philosophy

Since Skills execute on-demand rather than running as persistent processes, the architecture must be **completely stateless**:

1. **No Database**: All state is stored in the file system
   - Diagram structure → Directory structure (`doc/diagrams/{type}/`)
   - Diagram content → PUML files (`{name}.puml`)
   - Rendered output → PNG files (`{name}.png`)

2. **Context Rebuilding**: Each skill invocation starts fresh
   - Phase 1 always checks if directory structure exists
   - Claude uses Read tool to parse existing PUML files
   - Claude understands diagram state from file contents

3. **File-Based Discovery**:
   - List diagrams: `ls doc/diagrams/context/` shows all context diagrams
   - Find elements: Read PUML file and parse element definitions
   - Check relationships: Parse PUML relationship syntax

4. **Idempotent Operations**:
   - Running Phase 1 multiple times is safe (checks before creating)
   - Editing diagrams uses Edit tool with precise string matching
   - Rendering creates/overwrites PNG files

**Advantages of Stateless File-Based Approach:**
- **Simplicity**: No database synchronization or migration issues
- **Transparency**: Users can view/edit PUML files directly in their editor
- **Version Control**: Git-friendly - all changes are trackable
- **Portability**: Copy `doc/diagrams/` folder = copy entire project
- **Debugging**: Easy to inspect state by reading files
- **No Lock-In**: PUML files work with any PlantUML tool
- **Fewer Dependencies**: No LowDB or database library needed

## SKILL.md Metadata

```yaml
---
name: c4-diagrams
description: Creates and manages C4 architecture diagrams using PlantUML. Use when the user wants to visualize software architecture, create context/container/component/sequence diagrams, document system design with the C4 model, or mentions architecture diagrams, system design, or PlantUML. Supports iterative diagram building through conversational workflow.
allowed-tools: Bash, Read, Write, Edit
---
```

**Key Conventions Applied:**
- **Third-person description** for consistency with official examples
- **Enhanced trigger words** (architecture diagrams, system design, PlantUML) to improve skill discovery
- **Simplified YAML format** (no brackets around tools list)

## SKILL.md Workflow (Multi-Phase)

**Phase 1: Initialize Diagram Directory Structure**

**Note:** There is no "project" concept in Skills version - the `doc/diagrams/` directory at project root IS your project location. No project metadata, names, or discovery features.

**Check for existing structure:**
1. Use Bash to check if `doc/diagrams/` exists: `ls -la doc/diagrams 2>/dev/null`
2. If it exists and contains subdirectories `context/`, `container/`, `component/`, `sequence/`, proceed to Phase 2
3. If missing or incomplete, initialize structure

**Initialize structure:**
1. Run initialization script: `bash .claude/skills/c4-diagrams/scripts/init-structure.sh`
2. Script will create:
   - `doc/diagrams/context/` - For context-level diagrams
   - `doc/diagrams/container/` - For container-level diagrams
   - `doc/diagrams/component/` - For component-level diagrams
   - `doc/diagrams/sequence/` - For sequence diagrams
3. Verify creation succeeded before proceeding to Phase 2

**Error handling:** If script fails, report error to user and ask if they have write permissions in project directory.

---

**Phase 2: Diagram File Setup**

**Determine diagram details from user request:**
1. Identify diagram type: context | container | component | sequence
2. Extract diagram name from user request (convert to lowercase, replace spaces with hyphens)
3. Construct target path: `doc/diagrams/{type}/{name}.puml`

**Check if diagram exists:**
1. Use Bash to check: `ls doc/diagrams/{type}/{name}.puml 2>/dev/null`
2. If exists: Read file to understand current state, proceed to Phase 3 or 4
3. If new: Continue to template initialization

**Initialize new diagram from template:**
1. Read appropriate template: `Read .claude/skills/c4-diagrams/templates/{type}.puml`
2. Write template to target location: `doc/diagrams/{type}/{name}.puml`
3. Optionally replace placeholder values with user-specified title/labels
4. Proceed to Phase 3

---

**Phase 3: Add Elements to Diagram**

**Parse current diagram state:**
1. Read the PUML file: `Read doc/diagrams/{type}/{name}.puml`
2. Identify existing elements (Person, System, Container, Component)
3. Understand current layout and groupings

**Add new elements:**
1. Based on diagram type and user request, determine element type to add
2. For reference on element syntax, consult [Element Types Reference](./reference/element-types.md) if needed
3. Use Edit tool to add element definitions at appropriate location in file
4. Follow C4-PlantUML syntax conventions

**Validation:**
1. Read the edited PUML file to verify changes
2. Check for syntax errors (unclosed parentheses, missing quotes, etc.)
3. If errors found, fix them before proceeding
4. Confirm all elements have proper types, labels, and descriptions

---

**Phase 4: Define Relationships**

**Parse existing elements:**
1. Read PUML file to identify all defined elements and their identifiers
2. Understand existing relationships to avoid duplicates

**Add new relationships:**
1. Determine which elements should be connected based on user request
2. Add relationship syntax using appropriate relationship types (Rel, Rel_U, Rel_D, Rel_L, Rel_R, etc.)
3. Use Edit tool to add relationships in the relationships section of the file
4. Include descriptive labels for each relationship

**Validation:**
1. Verify relationship syntax is correct
2. Confirm referenced element identifiers exist in the diagram
3. Check that relationship directions make logical sense

---

**Phase 5: Render Diagram Image**

**Generate PNG from PUML:**
1. Run rendering script: `python3 .claude/skills/c4-diagrams/scripts/render-diagram.py doc/diagrams/{type}/{name}.puml`
2. Script will:
   - POST PUML content to PlantUML server API
   - Receive PNG image response
   - Save to `doc/diagrams/{type}/{name}.png`
3. Report success and image location to user

**Error handling:**
1. If rendering fails, script will retry with exponential backoff
2. If all retries fail, report error to user with suggestion to check PUML syntax
3. User can manually validate PUML at http://www.plantuml.com/plantuml/uml/

**Next steps:**
- Offer to regenerate if user requests changes
- Suggest adding more elements or relationships
- Offer to create additional diagram types

## Script Responsibilities

**init-structure.sh** (Bash)
- Check if `doc/diagrams/` directory exists at project root
- Create directory structure if missing:
  - `doc/diagrams/context/`
  - `doc/diagrams/container/`
  - `doc/diagrams/component/`
  - `doc/diagrams/sequence/`
- Exit with success (code 0) if structure is valid
- Exit with error code (non-zero) if unable to create structure
- **Self-documenting requirements:**
  - Clear error messages explaining what went wrong
  - Success message confirming structure creation
  - Idempotent: safe to run multiple times
- **Language choice rationale:** Simple directory operations - bash minimizes dependencies

**render-diagram.py** (Python)
- **Input:** Path to `.puml` file (e.g., `doc/diagrams/context/system.puml`)
- **Output:** PNG image saved to same directory with same name (e.g., `doc/diagrams/context/system.png`)
- POSTs to public PlantUML server API
- **Self-documenting requirements:**
  - Justified constants example:
    ```python
    # Retry up to 3 times - balances reliability with speed for typical server response times
    MAX_RETRIES = 3

    # Wait 1s, then 2s, then 4s - exponential backoff prevents overwhelming server
    RETRY_DELAYS = [1, 2, 4]
    ```
  - Clear error messages for each failure type:
    - Network errors
    - HTTP error responses
    - Invalid PUML syntax errors from server
    - File write errors
  - Success message with path to generated PNG
  - Use Python standard library `urllib` or `requests` (widely available)
- **Language choice rationale:** HTTP requests with retry logic and error handling - Python provides cleaner, more readable implementation than bash with curl

## Feature Coverage & Gaps

**✅ Core Features Covered (60% of MCP functionality):**
- Creating all core diagram types: context, container, component, sequence
- Adding elements with standard types (Person, System, Container, Component, boundaries)
- Adding relationships with descriptions and technology parameters
- PNG rendering with retry logic and error handling
- Directory structure initialization and management
- Syntax knowledge extraction (templates + reference docs)
- Stateless, git-friendly workflow

**⏸️ Deferred Features (To be added after core validation):**
- **Interface Diagrams**: Complete diagram type with interface/type/enum elements
  - Reason: Validate core diagram types work well first, then add specialized type
  - Original tool: `create-interfaces-visualization` with custom element types and styling
- **CODE Diagrams**: Level 4 C4 diagrams (mentioned in some references but not fully implemented)

**🚫 Intentionally Removed Features (By design, not gaps):**
- **Project Discovery & Fuzzy Matching**: No `locate-or-create-c4-project` equivalent
  - Reason: Requires persistent state; Skills are stateless
  - Alternative: User navigates to correct directory before invoking skill
- **Project Metadata**: No project names, descriptions, or tracking
  - Reason: `diagrams/` directory is the project; no separate metadata layer
- **Relationship IDs**: No explicit IDs for relationships in storage
  - Reason: Relationships defined by PUML syntax, identified by source-target-description
- **Database Validation**: No referential integrity checks, no "element exists" validation
  - Reason: Claude + PlantUML parser provide validation; errors surface during rendering

**🔄 Natural Language Approach (Using Edit tool instead of dedicated tools):**
- **Element Updates**: Claude reads PUML, identifies element line, uses Edit tool to modify
  - Original: `update-element` tool with structured parameters
- **Relationship Updates**: Claude identifies relationship line, edits description/technology/direction
  - Original: `update-relationship` tool with validation
- **Deletions**: Claude removes element lines + related relationship lines
  - Original: `delete-entity` with cascading deletion logic
- **Rationale**: Bet on Claude's natural language understanding over rigid programmatic tools
- **Advantage**: More flexible - can handle "change all external systems to blue" type requests
- **Risk**: Requires careful parsing; Claude must understand PUML structure

**⚠️ Advanced Features Not Initially Supported:**
- Note elements (different syntax from standard elements)
- Sprite, tags, link parameters for relationships
- All directional relationship variants (Rel_U, Rel_D, Rel_L, Rel_R, etc.)
- Sequence diagram metadata options (showElementDescriptions, showFootBoxes, showIndex)
- Boundary parent-child relationships (basic support via indentation)

**Decision**: Focus on core create/read/update/delete workflow with natural language flexibility. Add advanced features based on user feedback and usage patterns.







