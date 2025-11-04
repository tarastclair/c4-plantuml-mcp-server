## Extracted Knowledge from TypeScript Implementation

The following C4-PlantUML domain knowledge was encoded in the original TypeScript MCP implementation and must be preserved in the Skills conversion:

### From `generatePuml.ts`

**Diagram Generation Logic:**
- `@startuml` / `@enduml` wrapper structure
- Proper include statement based on diagram type (via `getPlantUMLImport`)
- `HIDE_STEREOTYPE()` directive for cleaner output
- Title and optional description note
- Diagram-type-specific processing:
  - Standard: `processElements` → `addRelationships`
  - Interface: `processInterfaceDiagramElements` → `addInterfaceDiagramRelationships` with custom tags
  - Sequence: `processSequenceElements` → `processSequenceSpecialElementsAndRelationships` with timestamp ordering

**Empty Diagram Boilerplate (lines 132-213):**
- Extracted to enhance templates with commented examples
- Context: Person, System, System_Ext, Rel examples
- Container: Container, ContainerDb, Rel examples
- Component: Component with technology examples
- Sequence: Dividers `== Title ==`, group syntax, SHOW_ELEMENT_DESCRIPTIONS()

### From `generatePumlHelpers.ts`

**Element Processing (lines 12-150):**
- Three-step hierarchical processing:
  1. Non-boundary, non-child elements first
  2. Boundaries with their children (2-space indentation)
  3. Orphaned elements (parent doesn't exist)
- ID sanitization: `element.id.replace(/[^\w]/g, '_')`
- Technology parameter only for container/component: `${techStr}`
- Note elements use special multi-line syntax

**Relationship Processing (lines 153-177):**
- Deduplication via Set tracking: `sourceId-targetId-description`
- Technology parameter optional: `, "${technology}"`
- Standard format: `Rel(sourceId, targetId, "Description")`

**Sequence Diagram Special Handling (lines 332-478):**
- Critical insight: Dividers and relationships must be timestamp-ordered
- Event-based processing:
  - Divider start: `== Title ==`
  - Divider end: `== End of Title ==`
  - Relationships: `Rel(...)` with optional `$rel` parameter
- Sort all events by timestamp before generating PUML

**Interface Diagram Handling (lines 179-323):**
- Custom tags for element types: `$tags="interface|type|enum"`
- Custom styling via `AddElementTag` and `AddRelTag`
- Not initially supported in Skills version (can be added later)

### From `getters.ts`

**Include Statement Mapping (lines 17-37):**
```
CONTEXT    → C4_Context.puml
CONTAINER  → C4_Container.puml
COMPONENT  → C4_Component.puml
CODE       → C4_Component.puml
INTERFACE  → C4_Component.puml
SEQUENCE   → C4_Sequence.puml
```

**Element Macro Mapping (lines 46-87):**
```
Base Types: person → Person, system → System, container → Container, component → Component
Variants:
  external → _Ext suffix (System_Ext)
  db → Db suffix (ContainerDb, ComponentDb)
  queue → Queue suffix (ContainerQueue, ComponentQueue)
Boundaries:
  boundary + system → System_Boundary
  boundary + container → Container_Boundary
  boundary + default → Boundary
Special:
  note → Note (multi-line syntax)
```

**Interface Diagram Setup (lines 117-140):**
- Custom color schemes for interface/type/enum
- Relationship styling for contains/implements/extends/references
- Not initially supported (preserve for future enhancement)

### Key Syntax Rules to Document

1. **ID Requirements**: Must be valid identifiers, non-word chars become underscores
2. **Technology Parameter**: Only for Container and Component elements
3. **Parameter Order**:
   - Basic: `(id, "Name", "Description")`
   - With tech: `(id, "Name", "Technology", "Description")`
4. **Boundary Children**: Must be indented with 2 spaces
5. **Sequence Ordering**: Relationships and dividers sorted by creation timestamp
6. **Note Syntax**: Different from other elements (multi-line with `end note`)

This knowledge will be distributed across:
- **Templates**: Boilerplate examples in commented code
- **syntax-reference.md**: Comprehensive macro and syntax guide
- **SKILL.md**: Quick reference for common patterns
- **c4-plantuml-readme.md**: Full library documentation for deep dives
