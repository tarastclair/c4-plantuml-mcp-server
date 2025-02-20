import { z } from "zod";

// MCP Prompt raw schemas - These match the PromptArgsRawShape constraint
export const SystemIdentificationSchemaShape = {
    name: z.string().describe("Name of the system"),
    description: z.string().describe("Description of the system")
};

export const UserActorDiscoverySchemaShape = {
    name: z.string().describe("Name of the user/actor"),
    description: z.string().describe("Description of the user/actor")
};

export const ExternalSystemIdentificationSchemaShape = {
    name: z.string().describe("Name of the external system"),
    description: z.string().describe("Description of the external system")
};

export const RelationshipDefinitionSchemaShape = {
    from: z.string().describe("Source element ID or name"),
    to: z.string().describe("Target element ID or name"),
    description: z.string().describe("Description of the relationship"),
    technology: z.string().describe("Technology used in the relationship").optional()
};