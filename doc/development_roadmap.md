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

- [x] Relationship Management Tools
  - [x] Add/update relationships
  - [x] Delete relationships
  - [x] Relationship validation
  - [x] Implement entry point tool for guided workflow
  - [x] Add nextPrompt field to all tool responses
  - [x] Create standard tool response format for state transitions

## Phase 3: Guided Flow Implementation
- [x] Conversation Prompts
  - [x] System identification prompts
  - [x] User/actor discovery prompts 
  - [x] External system identification prompts
  - [x] Relationship definition prompts

- [x] Prompt-Tool Integration
  - [x] Connect prompts to tool execution
  - [x] Handle user responses
  - [x] Support manual overrides
  - [x] Implement conversation state management
  - [x] Design complete guided workflow state machine
  - [x] Implement error recovery within guided flow
  - [x] Create refinement mechanisms within guided flow

## Phase 4: Polish & Documentation
- [ ] Final Integration
  - [ ] Clean up and consistency checks
  - [ ] Example conversation guide
  - [ ] Complete test suite for guided workflow
  - [ ] README updates

## Technical Dependencies
1. MCP TypeScript SDK
2. Public PlantUML server
3. lowdb for JSON storage
4. TypeScript Zod for schema validation
5. Axios for HTTP requests

## Potential Improvements
1. Support for Container and Component diagram types
2. Create standardized format for progress indication
3. More robust validation for diagram elements
4. Advanced layout customization
5. Support for alternative PlantUML servers
6. Enhanced error recovery mechanisms
7. Comprehensive logging system
8. Query/search mechanisms for diagrams
9. Multiple parallel guided workflows
10. Workflow save/resume capabilities