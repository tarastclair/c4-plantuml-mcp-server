**Tara**
I need to create a C4 Context diagram for a video streaming service called StreamFlix

**Claude**
Let's start by discussing our goals for this StreamFlix C4 Context diagram. As architects working on a POC, we need to ensure we capture the essential components while keeping it focused enough for decision-makers.

Could you help me understand:
1. What are the key business capabilities that StreamFlix needs to demonstrate in this POC?
2. Are there any specific technical constraints or requirements we should consider?
3. What decisions are the executives trying to make based on this prototype?

While you think about those questions, let me create an initial C4 diagram that we can iterate on together. We'll focus on the core streaming service functionality to start.

`createC4Diagram`
```
{
  `title`: `StreamFlix Video Streaming Service`,
  `description`: `Core system architecture for video streaming platform focusing on essential components needed for POC demonstration`
}
---
Created new diagram (ID: f9d2e0cf-17d0-4480-8d00-4bb7b47ffebb). Let's start by identifying the core system. What is it called, and what does it do?
```

Let's start by adding our core system:

`add-system`
```
{
  `name`: `StreamFlix Platform`,
  `diagramId`: `f9d2e0cf-17d0-4480-8d00-4bb7b47ffebb`,
  `description`: `Core streaming platform that manages content delivery, user authentication, and streaming session management`
}
---
Now, let's identify the users or actors who interact with this system.
```

Let's add a typical streaming service user:

`add-person`
```
{
  `name`: `Streaming User`,
  `diagramId`: `f9d2e0cf-17d0-4480-8d00-4bb7b47ffebb`,
  `description`: `End user who browses content and streams videos across different devices`
}
---
Great! Are there any other users or actors who interact with the system?
```

We should also consider some essential external systems. For a video streaming service, we'll likely need:

`add-external-system`
```
{
  `name`: `CDN Provider`,
  `diagramId`: `f9d2e0cf-17d0-4480-8d00-4bb7b47ffebb`,
  `description`: `Content Delivery Network for distributing video content globally with low latency`
}
---
Great! Are there any other external systems that interact with your core system?
```

`add-external-system`
```
{
  `name`: `Payment Gateway`,
  `diagramId`: `f9d2e0cf-17d0-4480-8d00-4bb7b47ffebb`,
  `description`: `Handles secure payment processing for subscriptions and purchases`
}
---
Now, let's define the relationships between these elements more precisely.
```

Let's define the key relationships:

`add-relationship`
```
{
  `sourceId`: `2`,
  `targetId`: `1`,
  `diagramId`: `f9d2e0cf-17d0-4480-8d00-4bb7b47ffebb`,
  `technology`: `HTTPS/REST API`,
  `description`: `Views content, manages account, and controls playback`
}
```

...
