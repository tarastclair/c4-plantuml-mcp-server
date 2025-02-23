# C4 Context Diagram MCP Server - Test Conversation Script

## Purpose
This script provides a structured test of the C4 Context Diagram MCP server's core functionality. Follow this script exactly as written to verify proper installation and operation.

## Expected Setup State
Before starting the conversation:
1. Server is built (`npm run build` completed successfully)
2. Claude Desktop config is updated with correct path
3. Claude Desktop has been restarted
4. The hammer icon is visible in Claude Desktop

## Test Conversation Script

### Step 1: Initial Contact

**You**: "I need to create a C4 Context diagram for a video streaming service called StreamFlix."

**Expected Claude Response**: 
- Should acknowledge the request
- Should mention C4 Context diagrams
- Should ask for details about the core system or start creating it

### Step 2: Core System Definition

**You**: "The core system handles video streaming, user management, and content cataloging."

**Expected Claude Response**:
- Should use the `add-system` tool
- Should show a diagram with just the StreamFlix system
- Should ask about users/actors

### Step 3: Adding Users

**You**: "We have regular streaming customers and content publishers who upload videos."

**Expected Claude Response**:
- Should use `add-person` tool (twice)
- Should show updated diagram with two persons
- Should show relationships to core system
- Should ask about external systems

### Step 4: External Systems

**You**: "We use a third-party payment processor called PayStream and a CDN for content delivery."

**Expected Claude Response**:
- Should use `add-external-system` tool (twice)
- Should add relationships automatically or ask about them
- Should show complete diagram
- Should ask for verification or refinements

### Step 5: Refinement

**You**: "Can you make the relationships more specific? The payment system uses REST APIs and the CDN uses HTTPS for content transfer."

**Expected Claude Response**:
- Should use `update-relationships` tool
- Should show updated diagram with specific relationship details
- Should ask if any other changes are needed

## Success Criteria
1. The hammer icon remains visible throughout the conversation
2. Each tool execution produces a diagram
3. The final diagram should have:
   - 1 core system (StreamFlix)
   - 2 persons (Customer, Publisher)
   - 2 external systems (PayStream, CDN)
   - At least 4 relationships with specific protocols
4. All diagrams should be properly rendered as SVGs
5. The conversation flow should feel natural and guided

## Error Handling Verification
If any step fails:
1. Note which step failed
2. Record any error messages from Claude
3. Check Claude Desktop logs
4. Record the exact state of the diagram before the error

Report any issues back to the development chat for investigation.

## Important Notes
- Only run this test script in a fresh conversation with Claude
- Do not deviate from the script during initial testing
- The exact wording of Claude's responses may vary, focus on the functional aspects
- If successful, you can then try free-form testing
