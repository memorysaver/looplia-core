# Proposal: Remove StructuredOutput Enforcement

## Summary

Remove SDK's `outputFormat: { type: "json_schema" }` enforcement from workflow execution and rely on the existing hook-based validation system for workflow completion. Additionally, fix the validation.json population issue that prevented stop-guard.sh from working correctly.

## Problem Statement

When using non-Anthropic models (e.g., GLM-4.7-flash via Ollama), the SDK's StructuredOutput enforcement creates an infinite loop:

1. Model produces thinking + text output (no tool_use block)
2. SDK's built-in Stop hook injects synthetic message: "You MUST call the StructuredOutput tool"
3. Model responds with text "I'll call StructuredOutput" instead of actual tool_use block
4. Loop continues indefinitely

### Root Cause #1: SDK StructuredOutput Enforcement

- Anthropic models are trained to recognize synthetic stop hook messages and respond with tool_use blocks
- Non-Anthropic models treat synthetic messages as conversational prompts and respond with text
- The SDK's `outputFormat: json_schema` setting enables this enforcement behavior

### Root Cause #2: Empty validation.json Steps

After removing StructuredOutput, a second issue was discovered:
- `createInitialValidationJson()` creates validation.json with `steps: {}`
- `generateValidationManifest()` exists in `@looplia-core/core` but was **never called**
- stop-guard.sh checks validation.json for incomplete steps, but finds nothing to check
- Result: Agent can stop early without completing the workflow

### Root Cause #3: Non-Actionable Stop Hook Reasons

The ralph-loop plugin demonstrates how Stop hooks work in the Claude Agent SDK:
- The `reason` field in a Stop hook response is the **continuation prompt** fed back to the agent
- stop-guard.sh returned explanation-only reasons ("Missing output files for steps: X")
- These explanations don't tell the agent what to do next

### Evidence

Direct API tests with the same model (GLM-4.7-flash) work correctly:
- Simple tool calls: PASS
- Large context input: PASS
- Large JSON output: PASS

The issue only occurs within looplia's SDK-based execution due to synthetic message handling.

## Proposed Solution

Remove StructuredOutput enforcement, fix validation.json population, and improve stop-guard.sh:

1. **Remove `outputFormat`** from query-executor.ts - eliminates synthetic stop messages
2. **Populate validation.json steps** - call `generateValidationManifest()` after sandbox creation
3. **Improve stop-guard.sh reason fields** - return actionable continuation prompts (following ralph-loop pattern)
4. **Keep hook-based validation** - `post-write-validate.sh` validates outputs against workflow YAML rules
5. **Read final artifact from sandbox** - after workflow completes, extract result from validated output files

### Why This Works

The validation system needs proper initialization to be LLM-independent:
- `createInitialValidationJson()` creates validation.json structure
- `generateValidationManifest()` populates steps from workflow definition
- `post-write-validate.sh` validates every Write to `sandbox/*/outputs/*.json`
- `validate.ts` performs deterministic checks against workflow YAML rules
- `stop-guard.sh` blocks until all steps have `validated: true`
- The `reason` field tells the agent exactly what to do to continue

StructuredOutput is redundant - the hooks already ensure valid outputs when properly initialized.

## Affected Components

| Component | Change |
|-----------|--------|
| `query-executor.ts` | Remove `outputFormat`, add sandbox result reading |
| `interactive-query-executor.ts` | Same changes if applicable |
| `apps/cli/src/commands/run.ts` | Call `generateValidationManifest()` to populate validation.json steps |
| `stop-guard.sh` | Update `reason` fields to be actionable continuation prompts |
| Hook system | No changes to post-write-validate.sh - already handles validation |

## Benefits

- Works with any model (no tool_use format dependency for completion)
- No infinite loops from synthetic messages
- Hook-based validation remains intact for workflow protection
- Deterministic validation independent of LLM behavior

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Workflow may stop without completing | stop-guard.sh blocks until all steps validated; validation.json now has populated steps |
| Invalid output files | post-write-validate.sh validates on every write |
| Agent doesn't understand stop-guard reason | Reason field now contains actionable continuation prompt |
| Breaking change for existing workflows | No - workflows already write to sandbox, hooks already validate |

## Key Insight: ralph-loop Pattern

The official `ralph-loop` plugin demonstrates how Stop hooks work in the SDK:

```bash
# From ralph-loop's stop hook:
jq -n \
  --arg prompt "$PROMPT_TEXT" \
  '{
    "decision": "block",
    "reason": $prompt  # ← This is the continuation prompt fed back to agent!
  }'
```

The SDK creates a synthetic message from the `reason` content and continues the conversation. This is the intended mechanism for workflow continuation with non-Anthropic models.
