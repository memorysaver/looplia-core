# Design: Build Validation Hooks

## Architecture Overview

```
Build Command Flow (v0.7.5)
┌─────────────────────────────────────────────────────────────────────┐
│ 1. CLI creates sandbox + build-type validation.json                 │
│    └─> { type: "build", workflowValidated: false }                  │
│                                                                     │
│ 2. SDK executes with buildHooks                                     │
│    └─> workflow-schema-composer generates workflow file             │
│                                                                     │
│ 3. PostToolUse hook fires on Write to workflows/*.md                │
│    └─> parseWorkflow() validates YAML + structure                   │
│    └─> Updates validation.json: { workflowValidated: true }         │
│    └─> OR blocks with actionable error message                      │
│                                                                     │
│ 4. Stop guard checks validation.json                                │
│    └─> Blocks if workflowValidated: false                           │
│    └─> Allows completion if validated                               │
│                                                                     │
│ 5. extractSandboxResult() reads build-type validation.json          │
│    └─> Returns success with workflowPath                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Config Separation

### Current State (v0.7.4)

```typescript
type ClaudeAgentConfig = {
  // ...
  runHooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
};
```

### Proposed State (v0.7.5)

```typescript
type ClaudeAgentConfig = {
  // ...
  runHooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  buildHooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
};
```

Both are passed to SDK's `query()` options.hooks, but semantically separate.

## Build vs Run Validation Comparison

| Aspect | Run Command | Build Command |
|--------|-------------|---------------|
| **Purpose** | Execute multi-step workflow | Generate workflow definition |
| **validation.json type** | `{ type: "run", steps: {...} }` | `{ type: "build", workflowValidated: bool }` |
| **PostToolUse trigger** | Write to `sandbox/*/outputs/*.json` | Write to `workflows/*.md` |
| **Validation target** | Step output JSON (required_fields, etc.) | Workflow YAML structure |
| **Stop guard check** | All steps validated | workflowValidated: true |
| **extractSandboxResult** | Returns final step artifact | Returns workflowPath |

## Hook Implementation

### createBuildValidateHook()

```typescript
export function createBuildValidateHook(): HookCallback {
  return async (input: Record<string, unknown>): Promise<HookJSONOutput> => {
    const { tool_input } = input as WriteToolInput;
    const filePath = tool_input?.file_path;
    const content = tool_input?.content;

    // 1. Check if workflow file
    if (!isWorkflowFile(filePath)) return {};

    // 2. Validate using existing parser
    try {
      const parsed = parseWorkflow(content);

      // 3. Update validation.json
      await updateBuildValidation({
        workflowValidated: true,
        workflowPath: filePath,
        workflowName: parsed.definition.name,
      });

      console.error(`✓ Workflow validated: ${parsed.definition.name}`);
      return {};
    } catch (error) {
      // 4. Block with actionable error
      return {
        decision: "block",
        reason: `Workflow validation failed: ${error.message}\n\nPlease fix the workflow file and try writing it again.`,
      };
    }
  };
}
```

### createBuildStopGuardHook()

```typescript
export function createBuildStopGuardHook(): HookCallback {
  return async (_input: Record<string, unknown>): Promise<HookJSONOutput> => {
    const validation = await readBuildValidation();

    if (!validation) {
      return {
        decision: "block",
        reason: "Build incomplete. No validation state found.",
      };
    }

    if (!validation.workflowValidated) {
      return {
        decision: "block",
        reason: "Build incomplete. The workflow file has not been validated yet. Please write the workflow to ~/.looplia/workflows/ and ensure it has valid YAML frontmatter.",
      };
    }

    return {}; // Allow stop
  };
}
```

## Build validation.json Schema

```typescript
type BuildValidation = {
  type: "build";
  workflow: string;        // Target workflow name
  version: string;         // Schema version
  sandboxId: string;       // Sandbox ID
  createdAt: string;       // ISO timestamp
  status: "building" | "validated" | "failed";
  workflowValidated: boolean;
  workflowPath: string | null;
  error?: string;          // Validation error if failed
};
```

## File Path Detection

```typescript
function isWorkflowFile(filePath: string | undefined): boolean {
  if (!filePath) return false;
  return filePath.includes("/workflows/") && filePath.endsWith(".md");
}
```

## extractSandboxResult Enhancement

```typescript
// In sandbox-result.ts
if (manifest.type === "build") {
  if (!manifest.workflowValidated) {
    return {
      success: false,
      error: { type: "validation_error", message: "Workflow not validated" },
    };
  }

  return {
    success: true,
    data: {
      status: "success",
      workflowName: manifest.workflow,
      workflowPath: manifest.workflowPath,
    } as T,
  };
}
```

## Error Messages (Actionable)

Following the ralph-loop pattern, all block reasons are continuation prompts:

| Scenario | Reason (Continuation Prompt) |
|----------|------------------------------|
| Missing name field | "Workflow validation failed: Missing required field 'name'. Please add a name field to the YAML frontmatter." |
| No steps | "Workflow validation failed: Workflow must have at least one step. Please add steps to the workflow definition." |
| Invalid step | "Workflow validation failed: Step 'analyze-content' missing 'mission' field. Please add a mission describing what the skill should do." |
| Circular dependency | "Workflow validation failed: Circular dependency detected between steps. Please review the 'needs' fields and remove the cycle." |

## Test Strategy

1. **Unit tests**: `packages/provider/test/claude-agent-sdk/hooks/build-hooks.test.ts`
   - Test `isWorkflowFile()` detection
   - Test `createBuildValidateHook()` with valid/invalid workflows
   - Test `createBuildStopGuardHook()` with various validation states

2. **Integration tests**: `apps/cli/test/integration/build.test.ts`
   - Test full build flow with mock executor
   - Test validation error handling
   - Test extractSandboxResult with build-type manifest

3. **E2E tests**: Update `looplia-e2e` skill
   - Test build command with real workflow generation
