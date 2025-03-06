# Example Container (C2) Diagram Implementation

This document illustrates how our revised approach will work when extending support to C2 (Container) diagrams, using a real-world example workflow.

## User Interaction Example

Here's how a typical conversation might flow when a user wants to create a Container diagram:

**User**: "I'd like to create a Container diagram for our payment processing system."

**Claude**: "I'd be happy to help with that. Let me ask a few questions to get started:
1. Is this part of an existing architecture project, or should we create a new one?
2. If it's a new project, where would you like to save the diagram files?"

**User**: "This is a new project. Save the files to C:/Users/username/Documents/ArchitectureDiagrams."

**Claude**: *[calls create-arch-diagram and set-diagram-save-location tools]*
"Great! I've set up a new architecture project with directories for all C4 diagram types. Let's start by creating a Container diagram for your payment processing system.

Would you like to create a high-level Context diagram first to establish the system boundaries, or jump directly to the Container diagram?"

**User**: "Let's create a Context diagram first to establish the boundaries."

**Claude**: *[calls create-context-diagram tool]*
"I'll help you create a Context diagram for the payment processing system. Let's start by identifying the key elements:

1. What is the main purpose of your payment processing system?
2. Who are the primary users or actors?
3. What external systems does it interact with?"

**User**: *[provides information about the system]*

**Claude**: *[calls add-system, add-person, add-external-system, and add-relationship tools]*
"Based on your description, I've created a Context diagram for your payment processing system showing users, external systems, and key relationships. 

Now, would you like to zoom into the Payment Processing System to create a Container diagram showing its internal components?"

**User**: "Yes, let's create a Container diagram now."

**Claude**: *[calls create-container-diagram tool, using naming conventions to reference the Context diagram]*
"I'll create a Container diagram that zooms into the Payment Processing System. This will show the major containers (applications, data stores, etc.) within your system.

Looking at the Context diagram, I see the Payment Processing System interacts with Customers, Merchants, and the Bank Gateway. Let's identify the main containers within this system:

1. What applications or services make up the Payment Processing System?
2. What databases or data stores are part of it?
3. Are there any message queues or other specialized containers?"

*[continues with Container diagram creation...]*

## Technical Walkthrough

Here's a technical walkthrough of what happens in the C2 implementation:

### 1. Project Creation

When the user requests to create a Container diagram, the first steps involve setting up the project:

```typescript
// The AI calls the create-arch-diagram tool
const projectResponse = await server.callTool({
  name: "create-arch-diagram",
  arguments: {
    title: "Payment Processing Architecture",
    description: "C4 diagrams for the payment processing system"
  }
});

// Then calls set-diagram-save-location
const saveLocationResponse = await server.callTool({
  name: "set-diagram-save-location",
  arguments: {
    projectId: projectResponse.projectId,
    path: "C:/Users/username/Documents/ArchitectureDiagrams"
  }
});
```

This creates the following directory structure:
```
C:/Users/username/Documents/ArchitectureDiagrams/Payment Processing Architecture/
├── context/
├── container/
├── component/
└── code/
```

### 2. Context Diagram Creation

Before creating the Container diagram, the AI creates a Context diagram:

```typescript
const contextResponse = await server.callTool({
  name: "create-context-diagram",
  arguments: {
    projectId: projectResponse.projectId,
    title: "Payment-Processing-System-Context",
    description: "High-level context view of the payment processing system"
  }
});

// Add elements to the context diagram
const systemResponse = await server.callTool({
  name: "add-system",
  arguments: {
    diagramId: contextResponse.diagramId,
    name: "Payment Processing System",
    description: "Handles all payment processing activities"
  }
});

// Add other elements and relationships...
```

This creates:
```
context/
└── Payment-Processing-System-Context.puml  // Also generates .png
```

### 3. Container Diagram Creation

Now the AI can create a Container diagram that references the Context diagram by name/location:

```typescript
const containerResponse = await server.callTool({
  name: "create-container-diagram",
  arguments: {
    projectId: projectResponse.projectId,
    title: "Payment-Processing-System-Container",
    description: "Container-level view showing applications and datastores",
    systemName: "Payment Processing System"  // Used to find relevant elements in Context diagram
  }
});
```

Behind the scenes, the tool:

1. Gets the project path
2. Looks for a Context diagram with a similar name in the context/ directory
3. Reads the PUML content to find the specified system element
4. Creates a new Container diagram
5. Sets up file paths for the Container diagram:
   ```
   container/
   └── Payment-Processing-System-Container.puml  // Also generates .png
   ```

The tool doesn't need explicit parent-child relationships in the database - it uses the filesystem structure and naming conventions to establish the relationship.

### 4. Reading Existing Context

When adding containers, the tool references the Context diagram using the filesystem:

```typescript
const addContainerResponse = await server.callTool({
  name: "add-container",
  arguments: {
    diagramId: containerResponse.diagramId,
    name: "Payment Gateway API",
    technology: "Java, Spring Boot",
    description: "Processes payment requests from multiple channels"
  }
});
```

The tool:
1. Looks for the related Context diagram in the filesystem
2. Parses the PUML content to understand system context
3. Provides contextual guidance in its response:
   ```
   "I notice from the Context diagram that this system interacts with 'Bank Gateway' and 'Customers'. 
   Consider how this container relates to these external entities."
   ```

### 5. Relationship Handling

When adding relationships between containers, the tool provides context-aware guidance:

```typescript
const relationshipResponse = await server.callTool({
  name: "add-relationship",
  arguments: {
    diagramId: containerResponse.diagramId,
    sourceId: addContainerResponse.elementId,
    targetId: dbContainerId,
    description: "Stores transaction data",
    technology: "JPA, JDBC"
  }
});
```

### 6. Diagram Generation and File Management

Throughout this process, the tools handle file management:

1. The Container diagram PUML file is continuously updated
2. A PNG visualization is generated using PlantUML
3. Both are saved to the specified filesystem locations

## Implementation Details

### Container-Specific Elements

The Container diagram supports specialized element types:

```puml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

Person(customer, "Customer", "A customer of the payment system")
System_Ext(bank, "Bank System", "External banking system")

System_Boundary(paymentSystem, "Payment Processing System") {
  Container(api, "Payment API", "Java, Spring Boot", "Handles payment requests")
  ContainerDb(db, "Transaction Database", "PostgreSQL", "Stores all transaction data")
  Container(processor, "Payment Processor", "Java", "Processes payments")
  ContainerQueue(queue, "Transaction Queue", "RabbitMQ", "Queues payments for processing")
}

Rel(customer, api, "Makes payments", "HTTPS")
Rel(api, queue, "Queues payment", "AMQP")
Rel(processor, queue, "Reads from", "AMQP")
Rel(processor, db, "Stores results", "JDBC")
Rel(processor, bank, "Sends payment", "HTTPS")
@enduml
```

### Database Structure

The database is simpler without explicit relationships:

```typescript
// In the database:
{
  // Project
  "id": "proj123",
  "name": "Payment Processing Architecture",
  "rootPath": "C:/Users/username/Documents/ArchitectureDiagrams/Payment Processing Architecture",
  "diagrams": ["ctx123", "cont789"],
  // ...
},

// Context diagram
{
  "id": "ctx123",
  "name": "Payment-Processing-System-Context",
  "diagramType": "context",
  "pumlPath": ".../context/Payment-Processing-System-Context.puml",
  "pngPath": ".../context/Payment-Processing-System-Context.png",
  "elements": [
    {
      "id": "sys456",
      "type": "system",
      "name": "Payment Processing System",
      "description": "Handles all payment processing activities"
    }
    // other elements...
  ]
  // No explicit relationship to Container diagram
},

// Container diagram
{
  "id": "cont789",
  "name": "Payment-Processing-System-Container",
  "diagramType": "container",
  "pumlPath": ".../container/Payment-Processing-System-Container.puml",
  "pngPath": ".../container/Payment-Processing-System-Container.png",
  "elements": [
    {
      "id": "api123",
      "type": "container",
      "name": "Payment API",
      "technology": "Java, Spring Boot",
      "description": "Handles payment requests"
    }
    // other containers...
  ],
  // Optional metadata that can reference source system
  "metadata": {
    "sourceSystem": "Payment Processing System"
  }
}
```

## Key Implementation Benefits

This example illustrates how our implementation:

1. **Simplifies Database Structure**: No complex parent-child relationships in the database

2. **Uses Filesystem Effectively**: Directory structure and naming conventions encode diagram relationships

3. **Provides Contextual Guidance**: The AI can find and reference related diagrams through filesystem organization

4. **Operates Without Workflow States**: The conversation flows naturally without rigid state management

5. **Leverages AI Capabilities**: Relies on the AI's ability to understand naming patterns and file organization

6. **Supports Natural Navigation**: Users can easily reference different diagram levels using familiar terminology

This approach allows for a natural conversation flow while maintaining relationships between diagram levels through filesystem organization rather than complex database structures. It simplifies our implementation while still providing all the necessary context for effective C4 modeling.
