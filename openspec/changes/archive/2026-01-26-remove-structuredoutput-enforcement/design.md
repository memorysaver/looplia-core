# Design: Sandbox-Based Workflow Completion

## Context

The current workflow execution relies on two mechanisms for completion:

1. **SDK StructuredOutput** - Enforces model calls `StructuredOutput` tool before stopping
2. **Hook-based validation** - Validates output files against workflow YAML rules

These mechanisms are redundant and the first causes issues with non-Anthropic models.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Execution                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Agent executes workflow steps                            │
│     └─► Each step writes to sandbox/outputs/*.json           │
│                                                              │
│  2. PostToolUse:Write hook validates output                  │
│     └─► validate.ts checks against workflow YAML rules       │
│     └─► Updates validation.json (validated: true/false)      │
│                                                              │
│  3. Agent attempts to stop                                   │
│     ├─► stop-guard.sh checks validation.json                 │
│     │   └─► Blocks if any step not validated                 │
│     └─► SDK checks outputFormat                              │
│         └─► Injects "call StructuredOutput" if not called    │  ← PROBLEM
│                                                              │
│  4. Agent calls StructuredOutput (Anthropic models only)     │
│     └─► Returns final result                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Problem: SDK Stop Hook Loop

When `outputFormat: { type: "json_schema" }` is set:

```
Model stops without tool_use
       │
       ▼
SDK injects: "You MUST call StructuredOutput"
       │
       ▼
┌──────────────────────────────────────┐
│  Anthropic Model:                     │
│  Produces tool_use block ✓            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Non-Anthropic Model (GLM, etc):      │
│  Produces text: "I'll call it" ✗      │
│       │                               │
│       ▼                               │
│  SDK injects same message again       │
│       │                               │
│       ▼                               │
│  Infinite loop                        │
└──────────────────────────────────────┘
```

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Execution                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Agent executes workflow steps                            │
│     └─► Each step writes to sandbox/outputs/*.json           │
│                                                              │
│  2. PostToolUse:Write hook validates output                  │
│     └─► validate.ts checks against workflow YAML rules       │
│     └─► Updates validation.json (validated: true/false)      │
│                                                              │
│  3. Agent attempts to stop                                   │
│     └─► stop-guard.sh checks validation.json                 │
│         └─► Blocks if any step not validated                 │
│         └─► Allows stop when ALL validated                   │
│                                                              │
│  4. Looplia reads final artifact from sandbox                │  ← NEW
│     └─► Find sandbox via session/timestamp                   │
│     └─► Read validation.json to locate final output          │
│     └─► Parse and return final artifact JSON                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### D1: Remove outputFormat entirely

**Decision:** Remove `outputFormat: { type: "json_schema", schema: jsonSchema }` from query options.

**Rationale:**
- Eliminates SDK's StructuredOutput enforcement
- No synthetic stop messages injected
- Works with any model that can call tools

**Trade-off:** Lose SDK-level schema validation of final output. Mitigated by hook-based validation.

### D2: Sandbox result extraction

**Decision:** After SDK query completes, read final artifact from sandbox output files.

**Implementation:**
```typescript
// After for await (const message of result) completes:
const sandboxDir = findActiveSandbox();
const validation = await readJson(`${sandboxDir}/validation.json`);
const finalStep = findFinalStep(validation.steps);
const artifact = await readJson(`${sandboxDir}/${finalStep.output}`);
return { success: true, data: artifact };
```

**Rationale:**
- Data already exists in validated form
- No additional LLM call needed
- Deterministic extraction

### D3: Fix validation.json Step Population

**Decision:** Call `generateValidationManifest()` in `run.ts` after sandbox creation to populate steps.

**Problem Discovered:**
- `createInitialValidationJson()` creates validation.json with `steps: {}`
- `generateValidationManifest()` exists but was never called
- stop-guard.sh checks for incomplete steps but finds nothing to check
- Result: Agent can stop early without completing workflow

**Implementation:**
```typescript
// In apps/cli/src/commands/run.ts, after resolveSandboxId():
if (workflowInfo?.parsed?.definition) {
  const manifest = generateValidationManifest(workflowInfo.parsed.definition);
  const validationPath = join(workspace, "sandbox", sandboxId, "validation.json");
  if (existsSync(validationPath)) {
    const existing = JSON.parse(readFileSync(validationPath, "utf-8"));
    existing.steps = manifest.steps;
    writeFileSync(validationPath, JSON.stringify(existing, null, 2), "utf-8");
  }
}
```

**Rationale:**
- Workflow definition contains step information
- Steps must be populated before execution starts
- stop-guard.sh can then properly validate completion

### D4: Improve stop-guard.sh Reason Fields

**Decision:** Update `reason` field to be actionable continuation prompt following ralph-loop pattern.

**Key Insight:**
The `reason` field in a Stop hook response is NOT just an explanation—it's the **continuation prompt** that gets fed back to the agent. The SDK creates a synthetic message from this content.

**Before (explanation-only):**
```bash
echo "{\"decision\": \"block\", \"reason\": \"Missing output files for steps: $MISSING\"}"
```

**After (continuation prompt):**
```bash
REASON="Your workflow is not complete. You still need to create output files for these steps:$MISSING. Please continue working on the workflow by using the Write tool to create the required JSON files."
echo "{\"decision\": \"block\", \"reason\": \"$REASON\"}"
```

**Rationale:**
- Non-Anthropic models need explicit instructions
- The reason becomes the next user message in the conversation
- Actionable prompts guide the agent to completion

### D5: Keep post-write-validate.sh and validate.ts unchanged

**Decision:** No changes to `post-write-validate.sh` or `validate.ts`.

**Rationale:**
- Already provides robust output validation
- Independent of LLM behavior
- Works with any model

## Sandbox Discovery

The executor needs to find the active sandbox to read results. Options:

### Option A: Pass sandbox ID through context (Recommended)

The workflow-executor skill creates the sandbox and knows its ID. Pass it through the prompt or a context variable.

```typescript
// In workflow-executor skill prompt
"Sandbox ID: {sandboxId}"

// In query-executor.ts
const sandboxId = extractSandboxIdFromConversation(messages);
const sandboxDir = `${LOOPLIA_HOME}/sandbox/${sandboxId}`;
```

### Option B: Find most recent sandbox

If sandbox ID not available, find by timestamp:

```typescript
const sandboxDir = findMostRecentSandbox(`${LOOPLIA_HOME}/sandbox`);
```

**Risk:** Could pick wrong sandbox if multiple running. Use Option A when possible.

## Validation Flow Preserved

```
Step writes output.json
         │
         ▼
┌─────────────────────────────────────┐
│  PostToolUse:Write hook             │
│  1. Read validation.json            │
│  2. Get criteria for this step      │
│  3. Run validate.ts                 │
│  4. If pass: set validated=true     │
│  5. If fail: exit 2 (block write)   │
└─────────────────────────────────────┘
         │
         ▼
Agent attempts to stop
         │
         ▼
┌─────────────────────────────────────┐
│  Stop hook: stop-guard.sh           │
│  1. Read validation.json            │
│  2. Check all steps validated       │
│  3. If any pending: block stop      │
│     └─► Return continuation prompt  │  ← KEY: reason becomes next message
│  4. If all done: allow stop         │
└─────────────────────────────────────┘
         │
         ▼
SDK query ends naturally
         │
         ▼
┌─────────────────────────────────────┐
│  Looplia extracts result            │
│  1. Read validation.json            │
│  2. Find final step output path     │
│  3. Read and parse JSON             │
│  4. Return as workflow result       │
└─────────────────────────────────────┘
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Sandbox not found | Return error with "sandbox not found" |
| validation.json missing | Return error with "validation state missing" |
| Final output file missing | Return error with "final artifact not written" |
| Final output invalid JSON | Return error with parse details |
| Not all steps validated | Should not happen (stop-guard.sh blocks), but error if detected |

## Backward Compatibility

This change is **backward compatible**:

- Workflows already write to sandbox - no change needed
- Hooks already validate outputs - no change needed
- Final result structure unchanged - contains same artifact data
- No workflow YAML changes required
