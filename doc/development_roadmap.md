# C4 Context Diagram MCP Server - Development Roadmap

## Overview
This MCP server will enable interactive creation of C4 Context diagrams through both guided conversations and direct tool usage. The server will integrate with PlantUML for diagram generation and maintain state using a lightweight filesystem-based storage approach.

## Success Criteria
1. Users can create C4 Context diagrams through guided conversation
2. Generated diagrams follow C4 methodology
3. SVGs are generated correctly via PlantUML
4. Diagram state persists between sessions
5. Both guided and manual updates are supported

## Phase 1: Core Infrastructure
- [x] Storage Layer Implementation
  - [x] Analyze and adapt sticky-notes-server storage patterns
  - [x] Implement basic JSON file storage using lowdb
  - [x] Create CRUD operations for diagram state
  - [x] Add SVG caching mechanism
  - [x] Implement robust error handling for database operations

- [x] Core Types and Interfaces
  - [x] C4 element types (System, Person, External System)
  - [x] Relationship types
  - [x] Diagram state interface
  - [x] Storage layer interface
  - [x] Tool input/output types

- [x] PlantUML Integration
  - [x] HTTP client setup for PlantUML server
  - [x] SVG generation and response handling
  - [x] Basic error handling for server communication

## Phase 2: Tool Implementation
- [x] Element Management Tools
  - [x] Add/update system
  - [x] Add/update person
  - [x] Add/update external system
  - [x] Delete elements
  - [x] Implement relationship validation
  - [x] Support unique ID generation
  - [x] Manage diagram timestamps

- [ ] Relationship Management Tools
  - [x] Add/update relationships
  - [x] Delete relationships
  - [x] Relationship validation
  - [ ] Implement entry point tool for guided workflow
  - [ ] Add nextPrompt field to all tool responses
  - [ ] Create standard tool response format for state transitions

## Phase 3: Guided Flow Implementation
- [x] Conversation Prompts
  - [x] System identification prompts
  - [x] User/actor discovery prompts 
  - [x] External system identification prompts
  - [x] Relationship definition prompts

- [ ] Prompt-Tool Integration
  - [x] Connect prompts to tool execution
  - [x] Handle user responses
  - [x] Support manual overrides
  - [ ] Implement conversation state management
  - [ ] Design complete guided workflow state machine
  - [ ] Implement error recovery within guided flow
  - [ ] Create refinement mechanisms within guided flow

## Phase 4: Polish & Documentation
- [ ] Final Integration
  - [x] Clean up and consistency checks
  - [x] Basic error handling improvements
  - [ ] Example conversation guide
  - [ ] Complete test suite for guided workflow
  - [ ] Create standardized format for progress indication
  - [ ] README updates

## Next Implementation Step
Implement the entry point tool and conversation state management to enable multi-step guided flows. This requires:

1. Creating a dedicated entry point tool (`createC4Diagram`) that:
   - Creates an initial blank diagram
   - Returns the first prompt to trigger (`identifySystem`)
   - Has a clear description to help the LLM recognize when to use it

2. Updating all tool responses to include:
   - The `nextPrompt` field to trigger the next step
   - Required context parameters for the next prompt
   - Standardized state transition format

3. Designing and implementing the full state machine for the guided workflow

## Rationale for Next Steps
Implementing conversation state management will:
- Create a cohesive flow between different prompt stages
- Enable the LLM to remember previous context and decisions
- Support guided, step-by-step diagram creation
- Allow for revisiting and modifying previous choices
- Enhance the user experience through contextual awareness
- Provide a clear entry point for conversation initiation
- Create a consistent user experience regardless of background knowledge

## Technical Dependencies
1. MCP TypeScript SDK
2. Public PlantUML server
3. lowdb for JSON storage
4. TypeScript Zod for schema validation
5. Axios for HTTP requests

## Potential Improvements
1. Support for Container and Component diagram types
2. More robust validation for diagram elements
3. Advanced layout customization
4. Support for alternative PlantUML servers
5. Enhanced error recovery mechanisms
6. Comprehensive logging system
7. Query/search mechanisms for diagrams
8. Multiple parallel guided workflows
9. Workflow save/resume capabilities