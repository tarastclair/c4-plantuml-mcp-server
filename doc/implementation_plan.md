# Implementation Plan for Extended C4 Diagram Support

## Background

Our current MCP server successfully supports C1 (Context) diagrams using PlantUML. Based on feedback and example conversations, we've observed that the AI can effectively use our tools without a rigid workflow or state machine. This suggests an opportunity to simplify our approach while extending support to all C4 diagram types.

## Core Design Principles

1. **Simplify Over-Engineering**: Remove the existing workflow state machine and related code to reduce complexity.

2. **Leverage Filesystem Structure**: Use the filesystem for both storage and context reference, enabling the AI to understand relationships between diagram types.

3. **Filesystem-Based Relationships**: Rely on filesystem structure and naming conventions to maintain diagram hierarchies rather than explicit database relationships.

4. **Project-Based Organization**: Introduce a project concept as a container for related diagrams of various types (C1-C4).

## Implementation Phases

### Phase 1: Simplify Current Implementation (DONE)
- Remove the workflow state management system
- Strip unnecessary complexity from existing tools
- Update interfaces to eliminate workflow state dependencies
- Keep the core diagram generation functionality

### Phase 2: Enhance File Management (DONE)
- Implement the project concept as a container for related diagrams
- Create a structured filesystem approach with dedicated directories
- Save both PUML and PNG outputs for each diagram
- Add tool descriptions that encourage the AI to ask for save locations
- Establish consistent naming conventions that encode relationships

### Phase 3: Evaluation (C1) (DONE)
- Test the current implementation with example conversations
- Verify that the AI correctly asks for file locations
- Ensure proper saving of both PUML and PNG files
- Make adjustments based on findings

### Phase 4: Add C2 - Container Support
- Create container diagram element types
- Implement container-specific tools
- Use filesystem structure and naming to establish context-container relationships
- Enable content extraction from existing diagrams for context

### Phase 5: Relationship Enhancement
- Implement utilities to extract information from existing PUML files
- Enable tools to reference related diagrams using filesystem conventions
- Ensure the AI can navigate diagram hierarchies naturally

### Phase 6: Evaluation (C2)
- Test container diagram creation and referencing
- Verify proper relationships to context diagrams via filesystem
- Ensure the AI can navigate between diagrams effectively

### Phase 7-8: Expand to C3 and C4
- Apply the same pattern to component and code diagrams
- Maintain consistent filesystem structure and naming conventions
- Ensure each level properly references its parent context

## Project Structure

Projects will be organized with a clear filesystem structure that encodes diagram relationships:

```
/user-specified-path/project-name/
├── context/     # C1 - Context diagrams
│   ├── system-name.puml
│   └── system-name.png
├── container/   # C2 - Container diagrams
│   ├── system-name.puml     # Same name as parent system in context/
│   └── system-name.png
├── component/   # C3 - Component diagrams
│   ├── container-name.puml  # Same name as parent container in container/
│   └── container-name.png
└── code/        # C4 - Code diagrams
    ├── component-name.puml  # Same name as parent component in component/
    └── component-name.png
```

Each diagram will be saved as both a PUML source file and a generated PNG, enabling the AI to reference existing diagrams when creating new ones. The naming conventions and directory structure encode the relationships between diagram levels.

## Tool Design Approach

Tools will be designed with clear, instructive descriptions that guide the AI's interaction without enforcing rigid workflows. Key considerations include:

1. **Entry Point**: A unified `create-arch-diagram` tool to set up projects and guide initial diagram creation.

2. **File Management**: Tools that ask for and manage file locations appropriately.

3. **Context Awareness**: Tools that can reference and extract information from existing diagrams to provide better context.

4. **Filesystem Navigation**: Tools that use naming conventions and directory structure to find related diagrams.

5. **Content Analysis**: Tools that analyze PUML file content to understand relationships between diagram levels.

## Success Criteria

Our implementation will be successful if:

1. The AI can create all four levels of C4 diagrams without requiring a state machine
2. Diagrams maintain proper relationships between levels through filesystem organization
3. The AI can reference existing diagrams when creating new ones
4. The approach remains simple, removing rather than adding complexity
5. Users can easily navigate between different diagram levels in conversation
