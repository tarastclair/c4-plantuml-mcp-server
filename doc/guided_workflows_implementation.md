# Guided Workflows Implementation Methodology

## The High-Level Goal

We want to create an interactive experience where the user and AI assistant can collaboratively build a C4 Context diagram through natural conversation. The conversation should:

1. Guide users step-by-step through building the diagram
2. Ask intelligent questions to gather required information
3. Allow users to see diagram updates after each step
4. Support flexible back-and-forth refinement

## How MCP Prompts Help Us

MCP prompts are like conversation templates that help structure the dialog. Think of them as pre-written scripts that guide the conversation but allow for dynamic responses.

### Simplified Example Flow

Here's the complete flow we'll implement, including how the conversation begins:

```
1. User expresses intent: "I need a C4 diagram for my banking system"
2. Claude recognizes the need and calls our entry point tool "createC4Diagram"
3. Entry point tool creates a blank diagram and returns with nextPrompt="identifySystem"
4. Client requests the "identifySystem" prompt from our server
5. Claude uses this prompt to ask about the core system
6. User provides system details
7. Claude calls our "addSystem" tool with those details
8. Tool returns with nextPrompt="discoverActors"
9. Claude uses "discoverActors" prompt to ask about users/actors
10. User provides actor details
11. Claude calls our "addActors" tool
12. Tool returns with nextPrompt="identifyExternalSystems"
13. Claude asks about external systems
14. User provides external system details
15. Claude calls our "addExternalSystems" tool
16. Tool returns with nextPrompt="defineRelationships"
17. Claude asks about relationships
18. Diagram is complete and can be refined
```

### Entry Point Implementation Requirements

The entry point tool is crucial as it initiates the guided workflow:

1. **Clear identification**: The tool should have a descriptive name like `createC4Diagram` and a clear description that helps Claude recognize when to use it
2. **Simple parameters**: It should accept basic parameters (title, optional description) to start the diagram
3. **State initialization**: It should create the initial diagram state and return the diagram ID
4. **Workflow kickoff**: It must return a `nextPrompt` field that starts the guided workflow

Example entry point tool:
```typescript
server.tool(
  "createC4Diagram",
  "Create a new C4 Context diagram and start the guided modeling process",
  {
    title: z.string().describe("Title for the new diagram"),
    description: z.string().optional().describe("Optional description of what the diagram represents")
  },
  async ({ title, description }) => {
    // Create a new blank diagram
    const diagram = await db.createDiagram(title, description);
    
    // Generate empty diagram SVG
    const svg = await generateEmptyDiagramSVG(diagram.id);
    
    // Return with the first prompt to use
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          diagramId: diagram.id,
          svg: svg,
          nextPrompt: "identifySystem",  // Start the guided workflow
          title: title
        })
      }]
    };
  }
);
```

## Implementation Strategy

### 1. Create Prompts for Each Step

We'll create a prompt for each step in the diagram creation process:

```typescript
// 1. Prompt for identifying the core system
server.prompt(
  "identifySystem",
  {
    systemName: z.string().optional()
  },
  ({ systemName }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: systemName 
          ? `Let's document the "${systemName}" system. Could you describe what this system does?`
          : "Let's start by identifying the core system. What's the name of the system we're documenting?"
      }
    }]
  })
);

// 2. Prompt for discovering users/actors
server.prompt(
  "discoverActors",
  {
    systemName: z.string()
  },
  ({ systemName }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Now let's identify who uses the "${systemName}" system. Who are the main types of users or actors that interact with it?`
      }
    }]
  })
);

// And so on for external systems and relationships...
```

### 2. Connect Prompts to Tools

When the user responds to a prompt, we'll use that information to call the appropriate tool:

```typescript
// Create an "addSystem" tool that's called after system identification
server.tool(
  "addSystem",
  {
    name: z.string(),
    description: z.string()
  },
  async ({ name, description }) => {
    // Create system in database
    // Generate PlantUML with just the system
    // Return the diagram SVG
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          svg: generatedSvg,
          nextPrompt: "discoverActors", // Signal which prompt should come next
          systemName: name  // Pass context to the next prompt
        })
      }]
    };
  }
);
```

### 3. Maintain Conversation State

Each tool response includes information about the next step in the conversation:

```typescript
// After adding actors
server.tool(
  "addActors",
  {
    actors: z.array(z.object({
      name: z.string(),
      description: z.string()
    })),
    systemId: z.string()
  },
  async ({ actors, systemId }) => {
    // Store actors in database
    // Update diagram with actors and relationships to system
    // Return updated diagram
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          svg: updatedSvg,
          nextPrompt: "identifyExternalSystems",
          diagramId: diagramId,
          systemName: retrievedSystemName
        })
      }]
    };
  }
);
```

### 4. Complete the Conversation Loop

The client (Claude) uses our prompts and processes our tool responses:

1. User expresses need for a C4 diagram
2. Claude recognizes this intent and calls our entry point tool
3. Entry point tool creates a diagram and specifies the first prompt to use
4. Claude uses that prompt to ask initial questions
5. User provides details
6. Claude calls the appropriate tool with those details
7. The tool:
   - Updates the diagram
   - Generates a visualization
   - Tells Claude which prompt to use next (via `nextPrompt`)
8. Claude shows the diagram and uses the next prompt
9. This cycle continues until the diagram is complete

### LLM and Client Responsibilities

For this workflow to function properly:

1. **LLM (Claude)**:
   - Recognizes user intent to create a diagram
   - Discovers and calls the appropriate entry point tool
   - Understands the tool response format including the `nextPrompt` field
   - Uses each prompt to guide the user through the workflow
   - Calls appropriate tools based on user responses
   
2. **MCP Client (e.g., Claude Desktop)**:
   - Exposes available tools to the LLM (handled automatically)
   - Processes tool responses and extracts the `nextPrompt` field
   - Requests the specified prompt from the server
   - Presents prompt messages to the LLM
   - Handles prompt parameters specified in tool responses

## Practical Implementation Example

Here's what one complete interaction step would look like in code:

```typescript
// 1. The prompt that initiates this step
// Prompts are templates that help guide the conversation by providing pre-defined questions
server.prompt(
  // The unique name of this prompt - used when we want to reference/trigger this prompt
  "identifyExternalSystems",
  
  // Schema definition using Zod - defines what parameters this prompt accepts
  // These parameters allow the prompt to be context-aware based on previous steps
  {
    // We need the system name to personalize the question for the user's specific system
    systemName: z.string(),
    
    // We need the diagram ID to maintain state continuity between conversation steps
    // This ensures we're working with the same diagram throughout the conversation
    diagramId: z.string()
  },
  
  // The prompt handler function - generates the actual message to send to the user
  // It receives the parameters defined in the schema above
  ({ systemName, diagramId }) => ({
    // The messages array defines what will be shown to the user
    // In MCP, these simulate conversation turns that the LLM will use as context
    messages: [{
      // This message appears as if it's from a user, but it's actually our prompt template
      // "user" role is used because the LLM (Claude) will be in the "assistant" role
      role: "user",
      content: {
        // Text content type is standard for messages (could also be images, etc.)
        type: "text",
        
        // The actual prompt text - notice how we inject the systemName to personalize it
        // We're using a structured format to help users think comprehensively
        // The bullet points guide users to consider common external system types
        text: `Now, what external systems does "${systemName}" interact with? Think about:
        - Payment processing
        - Authentication services
        - Third-party APIs
        - Data services`
      }
    }]
  })
);

// 2. The tool that processes the user's response
// Tools perform actual operations based on user input and update the diagram state
server.tool(
  // Unique tool name - the LLM will decide when to call this tool based on context
  "addExternalSystems",
  
  // Input schema - strictly defines what parameters this tool requires
  // This is critical for type safety and validation
  {
    // The diagram ID ensures we're modifying the correct diagram
    // This maintains continuity with the previous steps
    diagramId: z.string(),
    
    // An array of external systems that the user identified in their response
    // Using an array allows handling multiple systems in one operation
    // The nested object structure ensures we capture both name and description
    externalSystems: z.array(z.object({
      name: z.string(),
      description: z.string()
    }))
  },
  
  // The actual tool implementation function - this contains the business logic
  // It receives the validated parameters matching the schema above
  async ({ diagramId, externalSystems }) => {
    try {
      // First, retrieve the current state of the diagram
      // This is crucial because we're building on previous work
      const diagram = await db.getDiagram(diagramId);
      
      // Safety check - if diagram doesn't exist, we can't proceed
      // This prevents errors from cascading into corrupt diagram states
      if (!diagram) throw new Error("Diagram not found");
      
      // Iterate through each external system provided by the user
      // Using a loop handles variable numbers of systems elegantly
      for (const system of externalSystems) {
        // Add each system to the diagram database
        // We explicitly set the type as 'external-system' to ensure correct rendering
        // This distinguishes from internal systems in the C4 model
        await db.addElement(diagramId, {
          type: 'external-system',  // Type determines how it's rendered in PlantUML
          name: system.name,
          description: system.description
        });
      }
      
      // Get the updated diagram with all new external systems
      // This fresh retrieval ensures we have the complete current state
      const updatedDiagram = await db.getDiagram(diagramId);
      
      // Generate a visual representation of the current diagram state
      // This creates the SVG that will be shown to the user
      const svg = await generateDiagramSVG(updatedDiagram);
      
      // Cache the SVG for performance
      // This prevents regenerating the same diagram repeatedly
      await db.cacheSVG(diagramId, svg);
      
      // Return a structured result that both shows the diagram and guides next steps
      // This is how we maintain the conversational flow
      return {
        // The content array allows returning multiple content pieces if needed
        content: [{
          type: "text",
          
          // We use JSON to structure the response with multiple pieces of information
          // The LLM will extract and use this structured data
          text: JSON.stringify({
            // The SVG to display - provides visual feedback to the user
            svg,
            
            // The diagram ID - maintains continuity to the next step
            diagramId,
            
            // System name - keeps context personalized in follow-up prompts
            systemName: diagram.name,
            
            // Critical: tells the LLM which prompt to use next
            // This creates the guided conversation flow
            nextPrompt: "defineRelationships",
            
            // Passes the IDs of systems we just added
            // These will be needed to create relationships in the next step
            externalSystemIds: externalSystems.map(s => s.id)
          })
        }]
      };
    } catch (error) {
      // Proper error handling is crucial for maintaining a good user experience
      // We format errors as regular responses rather than throwing exceptions
      return {
        content: [{
          type: "text",
          text: `Error adding external systems: ${error.message}`
        }],
        // The isError flag tells the LLM this operation failed
        // This allows the LLM to handle the error gracefully in conversation
        isError: true
      };
    }
  }
);
```

## Benefits of This Approach

1. **Natural Conversation**: Users just chat naturally without learning complex commands
2. **Guided Expertise**: The prompts help ensure all important diagram elements are covered
3. **Visual Feedback**: Users see the diagram evolve as they provide information
4. **Flexible Refinement**: Can go back and modify elements as needed
5. **Persistence**: Diagram state is saved between sessions
6. **Intuitive Entry**: Users can start the flow with natural requests without needing to know specific commands
7. **Consistent Experience**: The flow guides users through a complete process regardless of their expertise

This approach combines MCP's prompt capabilities with tool execution to create a guided, conversational experience that feels natural while producing professional C4 diagrams.