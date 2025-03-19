# Unified Entity Creation Architecture

## Overview

This document outlines our approach for simplifying the tooling in our C4 PlantUML MCP server by implementing a unified entity creation system. Rather than having separate tools for each entity type (person, system, container, etc.) and their variants, we'll create a unified approach that routes to specific helpers based on the entity type and variant.

## Goals

1. Reduce the number of permission prompts users encounter
2. Simplify code maintenance by centralizing common logic
3. Make it easier to add new entity types and variants
4. Provide a consistent user interface

## Implementation Plan

### Directory Structure

```
src/
└── tools/
    ├── internal/
    │   ├── personEntityHelpers.ts
    │   ├── systemEntityHelpers.ts
    │   ├── containerEntityHelpers.ts
    │   ├── componentEntityHelpers.ts
    │   ├── boundaryEntityHelpers.ts
    │   └── relationshipHelpers.ts
    ├── addEntityTool.ts
    ├── addRelationshipTool.ts
    └── ... (other tools)
```

### Supported Entity Types & Variants

Based on the [C4-PlantUML documentation](https://github.com/plantuml-stdlib/C4-PlantUML?tab=readme-ov-file#system-context--system-landscape-diagrams), we need to support the following entity types and variants:

#### 1. Person Entity Types (personEntityHelpers.ts)

| Entity Type | Variant   | C4-PlantUML Macro | Description             |
|-------------|-----------|-------------------|-------------------------|
| person      | standard  | Person()          | Standard person         |
| person      | external  | Person_Ext()      | External person         |

#### 2. System Entity Types (systemEntityHelpers.ts)

| Entity Type | Variant   | C4-PlantUML Macro | Description             |
|-------------|-----------|-------------------|-------------------------|
| system      | standard  | System()          | Standard system         |
| system      | external  | System_Ext()      | External system         |
| system      | db        | SystemDb()        | Database system         |
| system      | queue     | SystemQueue()     | Message queue system    |
| system      | external+db | SystemDb_Ext()  | External database system|
| system      | external+queue | SystemQueue_Ext() | External message queue system |

#### 3. Container Entity Types (containerEntityHelpers.ts)

| Entity Type | Variant   | C4-PlantUML Macro | Description             |
|-------------|-----------|-------------------|-------------------------|
| container   | standard  | Container()       | Standard container      |
| container   | external  | Container_Ext()   | External container      |
| container   | db        | ContainerDb()     | Database container      |
| container   | queue     | ContainerQueue()  | Message queue container |
| container   | external+db | ContainerDb_Ext() | External database container |
| container   | external+queue | ContainerQueue_Ext() | External message queue container |

#### 4. Component Entity Types (componentEntityHelpers.ts)

| Entity Type | Variant   | C4-PlantUML Macro | Description             |
|-------------|-----------|-------------------|-------------------------|
| component   | standard  | Component()       | Standard component      |
| component   | external  | Component_Ext()   | External component      |
| component   | db        | ComponentDb()     | Database component      |
| component   | queue     | ComponentQueue()  | Message queue component |
| component   | external+db | ComponentDb_Ext() | External database component |
| component   | external+queue | ComponentQueue_Ext() | External message queue component |

#### 5. Boundary Entity Types (boundaryEntityHelpers.ts)

| Entity Type | Variant   | C4-PlantUML Macro | Description             |
|-------------|-----------|-------------------|-------------------------|
| boundary    | enterprise | Enterprise_Boundary() | Enterprise boundary |
| boundary    | system    | System_Boundary() | System boundary         |
| boundary    | container | Container_Boundary() | Container boundary   |

#### 6. Relationships (relationshipHelpers.ts)

| Relationship Type | Variant | C4-PlantUML Macro | Description             |
|-------------------|---------|-------------------|-------------------------|
| relationship      | standard | Rel()            | Standard relationship   |
| relationship      | bidirectional | BiRel()     | Bidirectional relationship |
| relationship      | up      | Rel_U(), Rel_Up() | Upward relationship     |
| relationship      | down    | Rel_D(), Rel_Down() | Downward relationship |
| relationship      | left    | Rel_L(), Rel_Left() | Leftward relationship |
| relationship      | right   | Rel_R(), Rel_Right() | Rightward relationship |
| relationship      | back    | Rel_Back()        | Back relationship       |
| relationship      | neighbor | Rel_Neighbor()   | Neighbor relationship   |

### Main Entry Points

1. **add-entity Tool**
   - Takes entity type, variant, and other parameters
   - Routes to the appropriate helper function

2. **add-relationship Tool**
   - Takes relationship type, source, target, and other parameters
   - Routes to the appropriate relationship helper

### Implementation Status

- [x] Create internal directory structure
- [x] Implement personEntityHelpers.ts
- [x] Implement systemEntityHelpers.ts
- [x] Implement containerEntityHelpers.ts
- [x] Implement relationshipHelpers.ts
- [x] Create unified addEntityTool.ts
- [x] Create unified addRelationshipTool.ts
- [x] Update tools/index.ts to register new unified tools
- [x] Validate that we can still create context diagrams
- [x] Implement delete DB functions
- [ ] Validate that we can now create container diagrams
- [ ] Implement componentEntityHelpers.ts
- [ ] Implement boundaryEntityHelpers.ts
- [ ] Update addEntityTool.ts to support all entity types
- [ ] Validate that we can now create component diagrams
- [ ] ...code diagrams


## Next Steps

1. Implement the internal helper directory structure
2. Start with containerEntityHelpers.ts to support Container diagrams
3. Create the unified addEntityTool.ts with support for Container entities
4. Update tools/index.ts to register the new tool
5. Test with Claude Desktop
6. Extend to other entity types as needed