/**
 * Tool implementations for the C4 diagram MCP server
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiagramDb } from './db.js';
import { createToolResponse, createErrorResponse, getErrorMessage } from './utils.js';
import { generateDiagramSVG, generateEmptyDiagramSVG, writeSvgToFile } from './plantuml-utils.js';
import { DiagramWorkflowState, updateWorkflowState, createErrorRecoveryState } from './workflow-state.js';
import { C4Element, ElementType, C4Relationship } from './types-and-interfaces.js';

/**
 * Register all tools with the MCP server
 * 
 * @param server MCP server instance
 * @param db Database instance
 */
export const registerAllTools = (server: McpServer, db: DiagramDb): void => {
  registerNavigateWorkflowTool(server, db);
  registerUpdateElementTool(server, db);
  registerUpdateRelationshipTool(server, db);
  registerCreateC4DiagramTool(server, db);
  registerAddSystemTool(server, db);
  registerAddPersonTool(server, db);
  registerAddExternalSystemTool(server, db);
  registerAddRelationshipTool(server, db);
};

/**
 * Implementation of navigate-workflow tool
 * Allows for non-linear navigation through the workflow
 */
const registerNavigateWorkflowTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "navigate-workflow",
    "Navigate to a different step in the guided workflow",
    {
      diagramId: z.string().describe("ID of the diagram"),
      targetState: z.enum([
        'system-identification',
        'actor-discovery',
        'external-system-identification',
        'relationship-definition',
        'refinement',
        'complete'
      ]).describe("The workflow state to navigate to")
    },
    async ({ diagramId, targetState }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram not found: ${diagramId}`);
        }

        // Get current workflow state
        const currentState = await db.getWorkflowState(diagramId);
        if (!currentState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        // Map string state to enum
        const targetStateEnum = targetState === 'system-identification' 
          ? DiagramWorkflowState.SYSTEM_IDENTIFICATION
          : targetState === 'actor-discovery' 
          ? DiagramWorkflowState.ACTOR_DISCOVERY
          : targetState === 'external-system-identification' 
          ? DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION
          : targetState === 'relationship-definition' 
          ? DiagramWorkflowState.RELATIONSHIP_DEFINITION
          : targetState === 'refinement' 
          ? DiagramWorkflowState.REFINEMENT
          : DiagramWorkflowState.COMPLETE;
        
        // Get prompt name for target state
        const nextPromptName = targetState === 'system-identification' 
          ? 'systemIdentification'
          : targetState === 'actor-discovery' 
          ? 'userActorDiscovery'
          : targetState === 'external-system-identification' 
          ? 'externalSystemIdentification'
          : targetState === 'relationship-definition' 
          ? 'relationshipDefinition'
          : targetState === 'refinement' 
          ? 'diagramRefinement'
          : 'diagramComplete';

        // Update workflow state
        const nextState = updateWorkflowState(currentState, nextPromptName);
        await db.updateWorkflowState(diagramId, nextState);

        // Get SVG for diagram
        let svg = await db.getCachedSVG(diagramId);
        if (!svg) {
          svg = await generateDiagramSVG(diagram);
        // Cache SVG and write to file
        await db.cacheSVG(diagramId, svg);
        const svgPath = await writeSvgToFile(diagramId, svg);
        }

        // Prepare appropriate message based on the target state
        let message = "";
        switch (targetStateEnum) {
          case DiagramWorkflowState.SYSTEM_IDENTIFICATION:
            message = "Let's identify or modify the core system. What is it called, and what does it do?";
            break;
          case DiagramWorkflowState.ACTOR_DISCOVERY:
            message = "Let's identify or modify the users or actors. Who interacts with this system?";
            break;
          case DiagramWorkflowState.EXTERNAL_SYSTEM_IDENTIFICATION:
            message = "Let's identify or modify external systems. What other systems does this system interact with?";
            break;
          case DiagramWorkflowState.RELATIONSHIP_DEFINITION:
            message = "Let's define or modify relationships between elements. How do these components interact?";
            break;
          case DiagramWorkflowState.REFINEMENT:
            message = "Let's refine the diagram. What would you like to improve?";
            break;
          case DiagramWorkflowState.COMPLETE:
            message = "The diagram is complete. You can export it or continue making refinements.";
            break;
          default:
            message = "What would you like to work on next?";
            break;
        }

        return createToolResponse(message, {
          diagramId,
          svg,
          nextPrompt: nextPromptName,
          workflowState: nextState
        });
      } catch (error) {
        // If we encounter an error, try to create a recovery state
        try {
          const currentState = await db.getWorkflowState(diagramId);
          if (currentState) {
            const recoveryState = createErrorRecoveryState(
              currentState,
              `Error navigating workflow: ${getErrorMessage(error)}`,
              currentState.currentState // Stay in current state on error
            );
            await db.updateWorkflowState(diagramId, recoveryState);
          }
        } catch (stateError) {
          // If we can't update state, just continue
        }
        
        return createErrorResponse(`Error navigating workflow: ${getErrorMessage(error)}`);
      }
    }
  );
};

/**
 * Implementation of update-element tool for diagram refinement
 * Allows modifying existing elements
 */
const registerUpdateElementTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "update-element",
    "Update an existing element in the C4 diagram",
    {
      diagramId: z.string().describe("ID of the diagram"),
      elementId: z.string().describe("ID of the element to update"),
      name: z.string().optional().describe("New name for the element"),
      description: z.string().optional().describe("New description for the element"),
      type: z.enum(['system', 'person', 'external-system']).optional().describe("New type for the element")
    },
    async ({ diagramId, elementId, name, description, type }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram not found: ${diagramId}`);
        }

        // Find the element to update
        const element = diagram.elements.find(e => e.id === elementId);
        if (!element) {
          throw new Error(`Element not found: ${elementId}`);
        }

        // Collect updates
        const updates: Partial<C4Element> = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (type !== undefined) updates.type = type as ElementType;

        // Perform update
        await db.updateElement(diagramId, elementId, updates);

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating element: ${diagramId}`);
        }
        
        const svg = await generateDiagramSVG(updatedDiagram);
        await db.cacheSVG(diagramId, svg);
        const svgOutput = await writeSvgToFile(diagramId, svg);

        // Get current workflow state
        const currentState = await db.getWorkflowState(diagramId);
        if (!currentState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        // Update workflow state - stay in refinement state
        const nextState = updateWorkflowState(currentState, 'diagramRefinement', {
          lastModified: {
            elementId,
            elementType: updates.type || element.type
          }
        });
        await db.updateWorkflowState(diagramId, nextState);

        const message = `Element "${element.name}" updated successfully. Would you like to make any other refinements?`

        return createToolResponse(message, {
          diagramId,
          elementId,
          svg,
          svgOutput,
          nextPrompt: "diagramRefinement",
          workflowState: nextState
        });
      } catch (error) {
        // Create error recovery state if possible
        try {
          const currentState = await db.getWorkflowState(diagramId);
          if (currentState) {
            const recoveryState = createErrorRecoveryState(
              currentState,
              `Error updating element: ${getErrorMessage(error)}`,
              DiagramWorkflowState.REFINEMENT
            );
            await db.updateWorkflowState(diagramId, recoveryState);
          }
        } catch (stateError) {
          // If we can't update state, just continue
        }
        
        return createErrorResponse(`Error updating element: ${getErrorMessage(error)}`);
      }
    }
  );
};

/**
 * Implementation of update-relationship tool for diagram refinement
 * Allows modifying existing relationships
 */
const registerUpdateRelationshipTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "update-relationship",
    "Update an existing relationship in the C4 diagram",
    {
      diagramId: z.string().describe("ID of the diagram"),
      relationshipId: z.string().describe("ID of the relationship to update"),
      sourceId: z.string().optional().describe("New source element ID"),
      targetId: z.string().optional().describe("New target element ID"),
      description: z.string().optional().describe("New description for the relationship"),
      technology: z.string().optional().describe("New technology used in the relationship")
    },
    async ({ diagramId, relationshipId, sourceId, targetId, description, technology }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram not found: ${diagramId}`);
        }

        // Find the relationship to update
        const relationship = diagram.relationships.find(r => r.id === relationshipId);
        if (!relationship) {
          throw new Error(`Relationship not found: ${relationshipId}`);
        }

        // Collect updates
        const updates: Partial<C4Relationship> = {};
        if (description !== undefined) updates.description = description;
        if (technology !== undefined) updates.technology = technology;
        
        // If updating source/target, validate they exist
        if (sourceId !== undefined) {
          const sourceExists = diagram.elements.some(e => e.id === sourceId);
          if (!sourceExists) {
            throw new Error(`Source element not found: ${sourceId}`);
          }
          updates.sourceId = sourceId;
        }
        
        if (targetId !== undefined) {
          const targetExists = diagram.elements.some(e => e.id === targetId);
          if (!targetExists) {
            throw new Error(`Target element not found: ${targetId}`);
          }
          updates.targetId = targetId;
        }

        // Perform update
        await db.updateRelationship(diagramId, relationshipId, updates);

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating relationship: ${diagramId}`);
        }
        
        const svg = await generateDiagramSVG(updatedDiagram);
        await db.cacheSVG(diagramId, svg);

        // Find updated relationship details for the response message
        const updatedRelationship = updatedDiagram.relationships.find(r => r.id === relationshipId);
        if (!updatedRelationship) {
          throw new Error(`Relationship not found after update: ${relationshipId}`);
        }
        
        const sourceElement = updatedDiagram.elements.find(e => e.id === updatedRelationship.sourceId);
        const targetElement = updatedDiagram.elements.find(e => e.id === updatedRelationship.targetId);
        
        if (!sourceElement || !targetElement) {
          throw new Error('Source or target element not found after updating relationship');
        }

        // Get current workflow state
        const currentState = await db.getWorkflowState(diagramId);
        if (!currentState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        // Update workflow state - stay in refinement state
        const nextState = updateWorkflowState(currentState, 'diagramRefinement', {
          lastModified: {
            relationshipId
          }
        });
        await db.updateWorkflowState(diagramId, nextState);

        const message = `Relationship from "${sourceElement.name}" to "${targetElement.name}" updated successfully. Would you like to make any other refinements?`

        return createToolResponse(message, {
          diagramId,
          relationshipId,
          svg,
          nextPrompt: "diagramRefinement",
          workflowState: nextState,
          // Include element info to help formulate next prompts
          elementTypes: {
            [sourceElement.id]: sourceElement.type,
            [targetElement.id]: targetElement.type
          }
        });
      } catch (error) {
        // Create error recovery state if possible
        try {
          const currentState = await db.getWorkflowState(diagramId);
          if (currentState) {
            const recoveryState = createErrorRecoveryState(
              currentState,
              `Error updating relationship: ${getErrorMessage(error)}`,
              DiagramWorkflowState.REFINEMENT
            );
            await db.updateWorkflowState(diagramId, recoveryState);
          }
        } catch (stateError) {
          // If we can't update state, just continue
        }
        
        return createErrorResponse(`Error updating relationship: ${getErrorMessage(error)}`);
      }
    }
  );
};

/**
 * Primary entry point tool for guided C4 diagram creation
 * This tool creates a new diagram and kicks off the guided workflow
 */
// TODO: Expand scope beyond just Context (C1) diagrams to C2-C4 as well
const registerCreateC4DiagramTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "createC4Diagram",
    `Create a new C4 Context diagram and starts the guided modeling process.
    Required Fields:
    - title: String (The name of your system/diagram)
    - description: String (optional, A brief explanation of what the diagram represents)

    Returns a unique diagram ID that you'll need for all subsequent operations.
    
    Example:
    {
      "title": "E-commerce Platform",
      "description": "Core system architecture for our online store"
    }
      
    Response will include a diagram ID like: "b7a405e2-4353-4c67-ba6d-143eaf35e538"`,
    {
      title: z.string().describe("Title for the new diagram"),
      description: z.string().optional().describe("Optional description of what the diagram represents")
    },
    async ({ title, description }, extra) => {
      try {
        // Create a new blank diagram
        const diagram = await db.createDiagram(title, description);
        
        // Generate initial empty diagram
        const svg = await generateEmptyDiagramSVG(diagram);
        await db.cacheSVG(diagram.id, svg);
        
        // Get initial workflow state (created during diagram creation)
        const initialState = await db.getWorkflowState(diagram.id);
        if (!initialState) {
          throw new Error(`Failed to initialize workflow state for diagram: ${diagram.id}`);
        }

        // Update workflow state to system identification
        const nextState = updateWorkflowState(initialState, 'systemIdentification');
        await db.updateWorkflowState(diagram.id, nextState);

        const message = `Created new diagram (ID: ${diagram.id}). Let's start by identifying the core system. What is it called, and what does it do?`
        
        return createToolResponse(message, {
          diagramId: diagram.id,
          svg: svg,
          nextPrompt: "systemIdentification",
          workflowState: nextState
        });
      } catch (error) {
        return createErrorResponse(`Error creating diagram: ${getErrorMessage(error)}`);
      }
    }
  );
};

/**
 * Implementation of add-system tool with nextPrompt workflow support
 * Creates a system element and updates the diagram
 */
const registerAddSystemTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-system",
    `Add or update a system in the C4 diagram.
    
    Required Fields:
    - diagramId: String (UUID from createC4Diagram)
    - name: String (Name of the system)
    - description: String (Description of what the system does)
    
    Example:
    {
      "diagramId": "b7a405e2-4353-4c67-ba6d-143eaf35e538",
      "name": "Payment Processing System",
      "description": "Handles all payment transactions and integrates with external payment providers"
    }`,
    {
      diagramId: z.string().describe("UUID of the diagram from createC4Diagram"),
      name: z.string().describe("Name of the system"),
      description: z.string().describe("Description of the system")
    },
    async ({ diagramId, name, description }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram not found. Please provide a valid diagram ID from the createC4Diagram response.`);
        }

        // Add the system element
        const system = await db.addElement(diagramId, {
          type: 'system',
          name,
          description
        });

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after updating relationship: ${diagramId}`);
        }

        const svg = await generateDiagramSVG(diagram);
        await db.cacheSVG(diagramId, svg);

        // Get current workflow state
        const currentState = await db.getWorkflowState(diagramId);
        if (!currentState) {
          throw new Error(`No workflow state found for diagram: ${diagramId}`);
        }

        // Determine next state based on current diagram state
        const personCount = updatedDiagram.elements.filter(e => e.type === 'person').length;
        const nextPromptName = personCount === 0 
          ? "userActorDiscovery"  // First person - stay in actor discovery
          : "externalSystemIdentification"; // Multiple people - move to external systems

        // Update workflow state to actor discovery
        const nextState = updateWorkflowState(currentState, nextPromptName, {
          lastModified: {
            elementId: system.id,
            elementType: 'system'
          }
        });
        await db.updateWorkflowState(diagramId, nextState);

        const message = nextPromptName === "userActorDiscovery" ? "Now, let's identify the users or actors who interact with this system." : "Now let's identify the external systems that interact with your core system."

        return createToolResponse(message, {
          diagramId,
          systemId: system.id,
          systemName: name,
          svg,
          nextPrompt: nextPromptName,
          workflowState: nextState
        });
      } catch (error) {
        return createErrorResponse(`Error adding system: ${getErrorMessage(error)}`);
      }
    }
  );
};

/**
 * Implementation of add-person tool with nextPrompt workflow support
 * Creates a person/actor element and updates the diagram
 */
const registerAddPersonTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-person",
    "Add a person/actor to the C4 diagram",
    {
      diagramId: z.string().describe("ID of the diagram"),
      name: z.string().describe("Name of the person/actor"),
      description: z.string().describe("Description of the person/actor"),
      systemId: z.string().optional().describe("Optional ID of the system this person interacts with")
    },
    async ({ diagramId, name, description, systemId }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram not found: ${diagramId}`);
        }

        // Add the person element
        const person = await db.addElement(diagramId, {
          type: 'person',
          name,
          description
        });

        // If systemId is provided, create a relationship
        if (systemId) {
          // Verify system exists
          const systemExists = diagram.elements.some(e => e.id === systemId);
          if (!systemExists) {
            throw new Error(`System not found: ${systemId}`);
          }

          // Create relationship
          await db.addRelationship(diagramId, {
            sourceId: person.id,
            targetId: systemId,
            description: "Uses"
          });
        }

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after adding person: ${diagramId}`);
        }
        const svg = await generateDiagramSVG(updatedDiagram);

        await db.cacheSVG(diagramId, svg);

        const message = updatedDiagram.elements.filter(e => e.type === 'person').length === 1
        ? "Great! Are there any other users or actors who interact with the system?"
        : "Now, let's identify any external systems that interact with your core system."

        return createToolResponse(message, {
          diagramId,
          personId: person.id,
          svg,
          // If this is the first person, suggest adding more actors
          // otherwise, suggest moving to external systems
          nextPrompt: updatedDiagram.elements.filter(e => e.type === 'person').length === 1 
            ? "userActorDiscovery" 
            : "externalSystemIdentification"
        });
      } catch (error) {
        return createErrorResponse(`Error adding person: ${getErrorMessage(error)}`);
      }
    }
  );
};

/**
 * Implementation of add-external-system tool with nextPrompt workflow support
 * Creates an external system element and updates the diagram
 */
const registerAddExternalSystemTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-external-system",
    "Add an external system to the C4 diagram",
    {
      diagramId: z.string().describe("ID of the diagram"),
      name: z.string().describe("Name of the external system"),
      description: z.string().describe("Description of the external system"),
      systemId: z.string().optional().describe("Optional ID of the core system this external system interacts with")
    },
    async ({ diagramId, name, description, systemId }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram not found: ${diagramId}`);
        }

        // Add the external system element
        const externalSystem = await db.addElement(diagramId, {
          type: 'external-system',
          name, 
          description
        });

        // If systemId is provided, create a relationship
        if (systemId) {
          // Verify system exists
          const systemExists = diagram.elements.some(e => e.id === systemId);
          if (!systemExists) {
            throw new Error(`System not found: ${systemId}`);
          }

          // Create relationship
          await db.addRelationship(diagramId, {
            sourceId: systemId,
            targetId: externalSystem.id,
            description: "Uses"
          });
        }

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after adding external system: ${diagramId}`);
        }
        const svg = await generateDiagramSVG(updatedDiagram);

        await db.cacheSVG(diagramId, svg);

        const message = updatedDiagram.elements.filter(e => e.type === 'external-system').length === 1
        ? "Great! Are there any other external systems that interact with your core system?"
        : "Now, let's define the relationships between these elements more precisely."

        return createToolResponse(message, {
          diagramId,
          externalSystemId: externalSystem.id,
          svg,
          // If this is the first external system, suggest adding more
          // otherwise, suggest moving to relationships
          nextPrompt: updatedDiagram.elements.filter(e => e.type === 'external-system').length === 1
            ? "externalSystemIdentification"
            : "relationshipDefinition"
        });
      } catch (error) {
        return createErrorResponse(`Error adding external system: ${getErrorMessage(error)}`);
      }
    }
  );
};

/**
 * Implementation of add-relationship tool with nextPrompt workflow support
 * Creates a relationship between elements and updates the diagram
 */
const registerAddRelationshipTool = (server: McpServer, db: DiagramDb): void => {
  server.tool(
    "add-relationship",
    "Add a relationship between elements in the C4 diagram",
    {
      diagramId: z.string().describe("ID of the diagram"),
      sourceId: z.string().describe("ID of the source element"),
      targetId: z.string().describe("ID of the target element"),
      description: z.string().describe("Description of the relationship"),
      technology: z.string().optional().describe("Optional technology used in the relationship")
    },
    async ({ diagramId, sourceId, targetId, description, technology }, extra) => {
      try {
        const diagram = await db.getDiagram(diagramId);
        if (!diagram) {
          throw new Error(`Diagram not found: ${diagramId}`);
        }

        // Validate elements exist
        const sourceExists = diagram.elements.some(e => e.id === sourceId);
        const targetExists = diagram.elements.some(e => e.id === targetId);
        if (!sourceExists || !targetExists) {
          throw new Error("Source or target element not found");
        }

        // Add relationship
        const relationship = await db.addRelationship(diagramId, {
          sourceId,
          targetId,
          description,
          technology
        });

        // Generate updated diagram
        const updatedDiagram = await db.getDiagram(diagramId);
        if (!updatedDiagram) {
          throw new Error(`Diagram not found after adding relationship: ${diagramId}`);
        }
        const svg = await generateDiagramSVG(updatedDiagram);

        await db.cacheSVG(diagramId, svg);

        // Find element names for the response message
        const sourceElement = updatedDiagram.elements.find(e => e.id === sourceId);
        const targetElement = updatedDiagram.elements.find(e => e.id === targetId);
        
        if (!sourceElement || !targetElement) {
          throw new Error('Source or target element not found after adding relationship');
        }

        const message = `Relationship added from ${sourceElement.name} to ${targetElement.name}. Are there any other relationships you'd like to define?`

        return createToolResponse(message, {
          diagramId,
          relationshipId: relationship.id,
          svg,
          nextPrompt: "relationshipDefinition",
          // Include element info to help formulate next prompts
          elementTypes: {
            [sourceId]: sourceElement.type,
            [targetId]: targetElement.type
          }
        });
      } catch (error) {
        return createErrorResponse(`Error adding relationship: ${getErrorMessage(error)}`);
      }
    }
  );
};
