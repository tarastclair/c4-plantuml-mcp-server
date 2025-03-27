# Implementation Plan for Adding Support For Sequence Diagrams

We will be extending the support for our custom MCP server to include the generation of the C4-styled sequence diagrams from the same c4-PlantUML library that we've been using for the rest of this project. You have access to the relevant documentation in the `c4-plantuml-readme.md` file in the project knowledge and the relevant section on that document is titled "(C4 styled) Sequence diagram". We need a plan to implement this support in our custom MCP server in a pattern that mimics our other supported diagram types, e.g.:
- Types and interfaces in `src\types-and-interfaces.ts`
- PlantUML-related functions in `src\plantuml-utils\index.ts`
- Database implementation in `src\db\index.ts`
- Create diagram tool example in `src\tools\createComponentDiagramTool.ts`
- Entity helpers example in `src\tools\internal\componentEntityHelpers.ts`
- ...which are called by the main element creation tool in `src\tools\addElementTool.ts`

## Understanding C4-Styled Sequence Diagrams

From the documentation, C4-styled sequence diagrams are not native sequence diagrams but rather a blend of C4 elements (Person, System, Container, etc.) used in a sequence diagram context. Key differences from standard sequence diagrams include:

1. Boundaries are defined differently (without `{` and `}`, using `Boundary_End()` instead)
2. Element descriptions are typically hidden unless explicitly activated
3. Special relationship handling with the `Rel()` function that supports additional parameters like `$index` and `$rel`
4. Support for sequence-specific features like grouping messages, dividers, and delays
5. Import statement is different: `!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Sequence.puml`

## Implementation Plan

### 1. Types and Interfaces (`src\types-and-interfaces.ts`)

We'll need to add:

- A new diagram type enum value for `SequenceDiagram`
- New interfaces for sequence-specific elements:
  - `SequenceBoundary` (different from our existing boundaries)
  - `SequenceMessage` (relationships in sequence context)
  - `SequenceActivation` (for lifecycle index management)
  - `SequenceGroup` (for grouping messages)
  - `SequenceDivider` (for separators)

### 2. PlantUML Utils (`src\plantuml-utils.ts`)

We'll need to extend with:

- A new function `generateSequenceDiagramPuml()` similar to our existing generators
- Helper functions for sequence-specific features:
  - `generateSequenceBoundary()`
  - `generateSequenceMessage()`
  - `generateSequenceActivation()`
  - `generateSequenceGroup()`
  - `generateSequenceDivider()`
- Special handling for the `$index` and `$rel` parameters in relationships

### 3. Database Implementation (`src\db\index.ts`)

Extensions will include:

- New collections for sequence-specific elements
- Functions to create, read, update, and delete sequence elements
- Support for tracking activation indices and ensuring they're correctly sequenced

### 4. Create Diagram Tool (`src\tools\createSequenceDiagramTool.ts`)

We'll need to develop:

- A new tool to create sequence diagrams with specific initialization
- Support for the different diagram options like `SHOW_ELEMENT_DESCRIPTIONS` and `SHOW_FOOT_BOXES`
- Handling for the sequence-specific initialization (which differs from other C4 diagrams)

### 5. Entity Helpers (`src\tools\internal\sequenceEntityHelpers.ts`)

These will include functions for:

- Adding participants (derived from our existing C4 elements)
- Managing activation indices
- Creating sequence-specific constructs like groups and dividers
- Special boundary handling (different from our standard boundaries)

### 6. Main Element Creation Tool (`src\tools\addElementTool.ts`)

Modifications required:

- Support for sequence-specific element types
- Special handling for boundaries (without `{` and `}`, using `Boundary_End()`)
- Logic to manage activation indices for proper message sequencing

### 7. Relationship Tool (`src\tools\addRelationshipTool.ts`) 

Significant extensions:

- Enhanced support for sequence messages with `$index` and `$rel` parameters
- Special arrow types supported in sequence diagrams
- Functions to create different types of message flows (synchronous, asynchronous, reply)

## Key Challenges

1. **Boundary Representation**: C4 sequence diagrams handle boundaries differently. Instead of using the `{}` notation, they require explicit `Boundary_End()` calls.

2. **Activation Management**: We need to track message indices and activation lifelines correctly, as sequence diagrams require precise ordering.

3. **Relationship Styling**: Sequence messages have additional styling requirements through the `$rel` parameter that allows for different arrow types.

4. **Specialized Constructs**: Sequence diagrams support additional constructs like groups, dividers, and delays that don't exist in other C4 diagrams.

## Integration Strategy

We will use the same pattern as our existing diagrams but with adaptations for sequence-specific features:

1. Add a new diagram type option in our diagram creation tool
2. Extend our existing element creation tools to handle sequence-specific variants
3. Add special handling for sequence relationships to support message flows
4. Create new tools specifically for sequence-only elements (groups, dividers)
5. Modify our PlantUML generation to include sequence-specific imports and syntax

## Additional notes

- We should reuse existing element types (Person, System, etc.) in sequence diagrams
- We should auto-increment the `$index` parameter for relationships to ensure proper sequencing
- We DO NOT need to validate message flow (e.g., ensure lifelines exist before messages can be sent)

## Example diagram

```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Sequence.puml

Container(c1, "Single-Page Application", "JavaScript and Angular", "Provides all of the Internet banking functionality to customers via their web browser.")

Container_Boundary(b, "API Application")
  Component(c2, "Sign In Controller", "Spring MVC Rest Controller", "Allows users to sign in to the Internet Banking System.")
  Component(c3, "Security Component", "Spring Bean", "Provides functionality Related to signing in, changing passwords, etc.")
Boundary_End()

ContainerDb(c4, "Database", "Relational Database Schema", "Stores user registration information, hashed authentication credentials, access logs, etc.")

Rel(c1, c2, "Submits credentials to", "JSON/HTTPS")
Rel(c2, c3, "Calls isAuthenticated() on")
Rel(c3, c4, "select * from users where username = ?", "JDBC")

SHOW_LEGEND()
@enduml
```