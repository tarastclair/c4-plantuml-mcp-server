# C4 Diagram Skill Conversion Plan

## Research Summary

### What Are Claude Code Skills?
- **Definition**: Modular capabilities with `SKILL.md` + optional scripts/docs that Claude autonomously activates based on description matching
- **Key Principle**: Progressive disclosure - metadata loads at startup, full content loads on-demand, reference docs load only when needed
- **Execution Model**: Claude calls scripts via Bash tool; scripts are stateless and should handle errors internally
- **Official Examples**: https://github.com/anthropics/skills (algorithmic-art, mcp-builder, etc.)
- **✅ Validated**: Our approach has been validated against official documentation and example skills

### Skills vs MCP Servers
- **MCP Servers**: Long-running processes with stdio transport, expose tools via MCP protocol
- **Skills**: Prompt-based instructions that call standalone scripts; no persistent process
- **This Conversion**: Replace MCP server architecture with script-based execution model

### Key Documentation
- Skills best practices: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices.md
- Claude Code skills: https://docs.claude.com/en/docs/claude-code/skills.md
- Skills repo: https://github.com/anthropics/skills

### Critical Design Patterns Observed
1. **Multi-phase workflows**: mcp-builder uses 4 phases (research → implement → review → evaluate)
2. **Hierarchical file structure**: SKILL.md < 500 lines, reference/ for docs, scripts/ for executables, templates/ for boilerplate
3. **Self-documenting code**: Scripts include explicit error handling and config justification
4. **Single artifact delivery**: Skills like algorithmic-art produce one self-contained output

### Key Conventions from Official Documentation

**Metadata Conventions:**
- Use third-person descriptions ("Creates and manages..." not "Create and manage...")
- Include both what the skill does AND when to use it
- Add multiple trigger words to improve discovery
- Simplified YAML format (no brackets for arrays)

**File Organization:**
- SKILL.md must be under 500 lines
- Reference docs should be one-level deep (no nested references)
- Files >100 lines need table of contents
- Use markdown link syntax: `[Title](./reference/file.md)`
- Use `./` prefix for relative paths

**Script Execution:**
- "Run `script.js`" = execute the script
- "See `script.js`" = read as reference
- Scripts must handle errors internally (don't punt to Claude)
- Use justified constants with explanatory comments
- Clear, specific error messages for each failure type

**Workflow Patterns:**
- Provide specific, actionable instructions
- Include explicit validation steps
- Add "run validator → fix errors → repeat" loops
- Give concrete commands (not just descriptions)
- Include error handling guidance

**Progressive Disclosure:**
- SKILL.md contains workflow and essential info
- Reference docs load on-demand
- Templates load when creating new diagrams
- Use consistent terminology throughout all files

**Testing & Evaluation:**
- Test across Haiku, Sonnet, and Opus models
- Create evaluation scenarios following mcp-builder pattern
- Include realistic, complex, independent test cases
- Cover both success and error scenarios

---

## Proposed Skill Architecture

The following is a proposed architecture for the C4 Diagram Skill conversion, following best practices and conventions outlined above. For more details, please see the [skill-conversion-architecture.md](./skill-conversion-architecture.md) document.

**Skill Package Structure:**
```
.claude/skills/c4-diagrams/
├── SKILL.md                    # Main workflow (< 500 lines)
├── scripts/
│   ├── init-structure.sh       # Create/verify doc/diagrams/ directory structure (Bash)
│   └── render-diagram.py       # API call to PlantUML server (Python)
├── reference/
│   ├── c4-model.md             # C4 model concepts (lazy-loaded)
│   ├── c4-plantuml-readme.md   # Full C4-PlantUML library documentation (already exists)
│   ├── diagram-types.md        # Context/Container/Component/Sequence guide
│   ├── syntax-reference.md     # Element macros, ID rules, special syntax
│   └── best-practices.md       # Design tips and patterns
└── templates/
    ├── context.puml            # Context diagram with examples
    ├── container.puml          # Container diagram with examples
    ├── component.puml          # Component diagram with examples
    └── sequence.puml           # Sequence diagram with examples
```

**Note on Syntax Knowledge Transfer:**
The original MCP implementation encoded C4-PlantUML syntax knowledge in TypeScript code (`generatePuml.ts` and helpers). This knowledge has been extracted and will be preserved in:
1. **Enhanced Templates** - Rich boilerplate comments showing element syntax examples
2. **Syntax Reference** - Comprehensive guide to macros, ID sanitization rules, special handling
3. **C4-PlantUML README** - Full library documentation (already exists at `doc/reference/c4-plantuml-readme.md`)

Claude will use Read (template) + Write (new file) for diagram initialization, with syntax knowledge available on-demand through reference documentation.

**Working Directory Structure (Created by Skill):**
```
doc/diagrams/                   # Created at project root
├── context/                    # Context-level diagrams
│   ├── diagram-name.puml
│   └── diagram-name.png
├── container/                  # Container-level diagrams
│   ├── diagram-name.puml
│   └── diagram-name.png
├── component/                  # Component-level diagrams
│   ├── diagram-name.puml
│   └── diagram-name.png
└── sequence/                   # Sequence diagrams
    ├── diagram-name.puml
    └── diagram-name.png
```



## Implementation Questions to Resolve

1. **Stateless Context Rebuilding**: How does Claude efficiently parse existing PUML files to understand diagram state?
   - ✅ Solution: Use Claude's Read tool to parse PUML, Claude is good at understanding structured text

2. **Dependency Management**: What dependencies are acceptable?
   - ✅ Solution: Bash + Python standard library only - no package managers needed
   - ✅ Eliminated Node.js requirement entirely

3. **Error Recovery**: How should scripts handle PlantUML server failures?
   - ✅ Solution: Implement exponential backoff retry logic with justified constants
   - ✅ Clear error messages for Claude to report to user

4. **Template Copying**: Should we use a script or Claude's native tools?
   - ✅ **Resolved**: Claude uses Read (template) + Write (new file) directly
   - No separate script needed - simplifies architecture
   - Claude can handle parameter substitution inline

5. **Language Selection**: What languages should scripts use?
   - ✅ **Resolved**: Bash for simple operations, Python for complex logic
   - Minimizes setup and installation steps
   - Both widely available on developer systems

6. **Testing Strategy**: Create evaluation questions like mcp-builder pattern?
   - ✅ Yes, follow mcp-builder approach
   - Test creating each diagram type
   - Test editing existing diagrams
   - Test relationship additions
   - Test error scenarios (invalid syntax, missing files)

### Intentionally Out of Scope

The following features from the original MCP implementation are **deliberately not included** in the Skills conversion:

1. **Project Discovery & Management**
   - ❌ `locate-or-create-c4-project` tool with fuzzy matching and project search
   - ❌ Project-level metadata (names, IDs, descriptions)
   - ❌ Project database or registry
   - **Reason**: Skills must be stateless; persistent project state contradicts this principle
   - **Alternative**: `doc/diagrams/` at project root becomes the implicit project location

2. **Dedicated Update/Delete Tools**
   - ❌ `update-element` tool for modifying elements
   - ❌ `update-relationship` tool for changing relationships
   - ❌ `delete-entity` tool with cascading deletion
   - **Reason**: Natural language approach - Claude uses Edit tool to parse PUML and make changes
   - **Philosophy**: Bet on Claude's intelligence to understand "remove the database and its relationships" vs. rigid programmatic APIs
   - **Trade-off**: More flexible but requires Claude to maintain understanding of PUML structure

3. **Database-Backed Validation**
   - ❌ Referential integrity checks (element exists, relationship targets valid)
   - ❌ Relationship IDs and tracking
   - ❌ Element descriptor database storage
   - **Reason**: File-based state; validation happens through PlantUML parser and Claude's understanding
   - **Trade-off**: Errors surface during rendering instead of at input time

4. **Interface Diagrams (Deferred, Not Removed)**
   - ⏸️ `create-interfaces-visualization` with custom element types
   - ⏸️ Interface/type/enum elements with special styling
   - **Status**: Deferred until core diagram types are validated
   - **Plan**: Add as future enhancement once Skills workflow is proven

---

## Next Steps

### 1. (COMPLETE) Create Diagram Templates (templates/*.puml)

**Files:**
- `context.puml` - Context diagram boilerplate
- `container.puml` - Container diagram boilerplate
- `component.puml` - Component diagram boilerplate
- `sequence.puml` - Sequence diagram boilerplate

**Contents (based on TypeScript `generateEmptyDiagram` function):**

Each template should include:
- Proper C4-PlantUML include statement for diagram type
- `HIDE_STEREOTYPE()` directive
- Title placeholder
- Diagram-specific commented examples:

**Context template:**
```plantuml
' Person(user, "User", "A user of the system")
' System(system, "System", "Description of the system")
' System_Ext(external, "External System", "An external system")
' Rel(user, system, "Uses")
```

**Container template:**
```plantuml
' Container(web_app, "Web Application", "React", "The main web interface")
' ContainerDb(database, "Database", "PostgreSQL", "Stores user data")
' Rel(web_app, database, "Reads/writes")
```

**Component template:**
```plantuml
' Component(controller, "Controller", "Spring MVC", "Handles HTTP requests")
' Component(service, "Service", "Spring Service", "Business logic")
' Rel(controller, service, "Uses")
```

**Sequence template:**
```plantuml
' Person(user, "User", "A user of the system")
' Component(c1, "Controller", "Spring MVC", "Handles HTTP requests")
' Rel(user, c1, "Makes API request", "HTTP")
' == Authentication Step ==
' group Login Process
' Rel(c1, db, "Verifies credentials", "JDBC")
' end
' SHOW_ELEMENT_DESCRIPTIONS()
```

**Key Syntax Rules to Document:**
- IDs must be valid identifiers (use underscores not hyphens)
- Container/Component elements support optional technology parameter
- Boundaries use `System_Boundary` or `Container_Boundary` with `{ }` syntax
- Sequence diagrams support dividers with `== Title ==` syntax

### 2. (COMPLETE) Build scripts/init-structure.sh

**Requirements:**
- Written in **bash** for minimal dependencies
- Idempotent: safe to run multiple times
- Clear success/error messages
- Exit code 0 for success, non-zero for failure
- Self-documenting with comments explaining purpose

**Behavior:**
- Check if `doc/diagrams/` exists at project root
- Create subdirectories: doc/diagrams/context/, doc/diagrams/container/, doc/diagrams/component/, doc/diagrams/sequence/
- Report what was created or verified
- Use standard bash commands (mkdir, test, echo)

### 3. (COMPLETE) Build scripts/render-diagram.py

**Requirements:**
- Written in **Python** for better HTTP/retry handling
- Use Python standard library only (urllib, json, sys, os, time)
- Self-documenting with justified constants:
  ```python
  # Retry up to 3 times - balances reliability with speed
  MAX_RETRIES = 3
  # Exponential backoff prevents overwhelming server
  RETRY_DELAYS = [1, 2, 4]
  ```
- Clear error messages for each failure type
- Success message with generated PNG path

**Behavior:**
- Read PUML file from provided path (command-line argument)
- POST to PlantUML server API using urllib
- Retry with exponential backoff on failure
- Save PNG response to same directory as PUML file
- Return structured output (success/failure with details)
- Use argparse for clean command-line interface

### 4. (COMPLETE) Create SKILL.md (Following Official Conventions)

**Frontmatter:**
- Third-person description with enhanced trigger words
- Simplified YAML format (no brackets)

**Structure:**
- Requirements section (Bash, Python 3.6+, no external dependencies, internet access)
- 5 detailed phases with specific commands and validation steps
- Use markdown links for reference docs: `[Element Types](./reference/element-types.md)`
- Clear error handling guidance for each phase
- Brief diagram type overview (details in reference docs)

**Best Practices Applied:**
- Under 500 lines total
- Specific, actionable instructions
- Validation loops explicitly stated
- One-level-deep references

### 5. Write Reference Documentation

**reference/c4-model.md**
- C4 model theory and principles
- The four levels explained
- When to use C4 diagrams
- Include TOC if >100 lines

**reference/diagram-types.md**
- Detailed guide on context/container/component/sequence diagrams
- When to use each type
- Examples of good use cases
- Include TOC if >100 lines

**reference/syntax-reference.md** (NEW - extracts knowledge from TypeScript code)
- **Element Macro Reference**: Comprehensive mapping of element types to PlantUML macros
  - Base types: Person, System, Container, Component
  - Variants: System_Ext, ContainerDb, ContainerQueue, ComponentDb, ComponentQueue
  - Boundaries: System_Boundary, Container_Boundary, Boundary
  - Special: Note elements (different syntax)
- **ID Sanitization Rules**:
  - Replace non-word characters with underscores
  - Example: "web-app" → "web_app"
- **Parameter Rules**:
  - Basic: `Person(id, "Name", "Description")`
  - With technology: `Container(id, "Name", "Technology", "Description")`
  - Container/Component always support technology parameter
- **Boundary Syntax**:
  - Opening: `System_Boundary(id, "Name", "Description") {`
  - Children indented with 2 spaces
  - Closing: `}`
- **Special Diagram Type Handling**:
  - Sequence: Timestamp-ordered relationships, divider syntax `== Title ==`
  - Interface: Custom tags for styling (not initially supported)
- **Include Statements by Diagram Type**:
  - Context: `C4_Context.puml`
  - Container: `C4_Container.puml`
  - Component: `C4_Component.puml`
  - Sequence: `C4_Sequence.puml`
- Include TOC if >100 lines

**reference/best-practices.md**
- Design tips and common patterns
- Anti-patterns to avoid
- Layout and organization recommendations
- Naming conventions
- Include TOC if >100 lines

**reference/c4-plantuml-readme.md** (ALREADY EXISTS)
- Full C4-PlantUML library documentation from upstream repo
- Already located at `doc/reference/c4-plantuml-readme.md`
- Move to skill reference/ directory during conversion
- This is the complete reference for advanced users
- ~30k tokens, so use as deep-dive reference only

**Requirements for All Reference Docs:**
- One-level deep (no nested references)
- Consistent terminology throughout
- Table of contents for files >100 lines
- Referenced from SKILL.md with markdown links

### 6. Test Across Models

Following best practices:
- Test with Claude Haiku, Sonnet, and Opus
- Verify skill activation on appropriate triggers
- Ensure instructions work across all models
- Adjust complexity if needed for faster models

### 7. Create Evaluation Scenarios

Following mcp-builder pattern:
- 10 complex, independent evaluation questions
- Cover all diagram types (context, container, component, sequence)
- Test operations: create, edit, add elements, add relationships, render
- Test error scenarios: invalid syntax, missing files, permissions
- Realistic, verifiable scenarios
- XML format output for structured evaluation

---

**Note**: Information from an in-depth code analysis of the original MCP TypeScript implementation has been extracted and summarized in the [skill-conversion-mcp-reference-details.md](./skill-conversion-mcp-reference-details.md) document. This ensures that critical syntax knowledge is preserved and accessible within the new Skill architecture.