# Hook-Based Workflow Validator (v0.6.2)

Use Claude Code hooks to enforce workflow validation at key events - auto-validate artifacts, guard completion, and preserve context across compaction.

## Overview

| Hook Event | Purpose |
|------------|---------|
| **PostToolUse:Write** | Auto-validate artifacts when written to `outputs/` |
| **Stop** | Guard workflow completion - block until all outputs validated |
| **SessionStart:compact** | Re-inject sandbox state after context compaction |
| **SubagentStop** | Verify subagent completed its artifact |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW EXECUTION                            │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Write artifact  │────▶│ PostToolUse:Write│────▶│ Auto-validate   │
│ outputs/x.json  │     │ Hook triggered   │     │ Update state    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Agent stops     │────▶│ Stop Hook       │────▶│ Check all       │
│                 │     │ triggered       │     │ validated=true  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │ ◄──────── Block if incomplete ────────────────┘
        ▼
┌─────────────────┐
│ Workflow Done   │
└─────────────────┘
```

## Validation Architecture: Schema vs Criteria

### Design Decision

Looplia separates **output schemas** from **validation criteria** to enable skill reusability:

| Responsibility | Owner | Location | Purpose |
|----------------|-------|----------|---------|
| **Output Schema** | Skill | `SKILL.md` | Defines output structure for LLM guidance |
| **Validation Criteria** | Workflow | YAML frontmatter `validate:` block | Defines acceptance tests for this workflow |

### Why This Separation?

**Same skill, different thresholds.** A `media-reviewer` skill produces a ContentSummary. But:
- A "quick-scan" workflow might accept `min_quotes: 1`
- A "deep-analysis" workflow might require `min_quotes: 5`

The skill doesn't decide strictness - the workflow does.

### Criteria Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  writing-kit.md (Workflow Definition)                           │
│  ─────────────────────────────────────────────────────────────  │
│  steps:                                                          │
│    - id: summary                                                 │
│      skill: media-reviewer                                       │
│      validate:                      ◄─── Criteria defined here   │
│        required_fields: [contentId, headline, tldr]              │
│        min_quotes: 3                                             │
│        min_key_points: 5                                         │
└─────────────────────────────────────────────────────────────────┘
        │
        │ workflow-executor (Phase 3)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  validation.json (Generated in sandbox)                          │
│  ─────────────────────────────────────────────────────────────  │
│  {                                                               │
│    "workflow": "writing-kit",                                    │
│    "steps": {                                                    │
│      "summary": {                                                │
│        "validated": false,                                       │
│        "validate": {                ◄─── Criteria copied here    │
│          "required_fields": [...],                               │
│          "min_quotes": 3                                         │
│        }                                                         │
│      }                                                           │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
        │
        │ PostToolUse:Write hook
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  post-write-validate.sh                                          │
│  ─────────────────────────────────────────────────────────────  │
│  CRITERIA=$(jq '.steps[$art].validate' validation.json)          │
│  bun validate.ts "$FILE_PATH" "$CRITERIA"                        │
└─────────────────────────────────────────────────────────────────┘
        │
        │ Deterministic validation (no LLM)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  validate.ts                                                     │
│  ─────────────────────────────────────────────────────────────  │
│  Supported criteria:                                             │
│    - required_fields: string[]                                   │
│    - min_quotes: number                                          │
│    - min_key_points: number                                      │
│    - min_outline_sections: number                                │
│    - has_hooks: boolean                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Skill vs workflow-validator Skill

The `workflow-validator` skill in looplia-core is for **manual debugging**, not normal validation:
- Normal validation: Hooks run `validate.ts` deterministically (no token cost)
- Debugging: Agent invokes workflow-validator skill to inspect validation state

### Adding Stricter Validation

To make validation more strict, modify the workflow's YAML frontmatter:

```yaml
# Before: lenient
steps:
  - id: summary
    skill: media-reviewer
    validate:
      min_quotes: 1

# After: strict
steps:
  - id: summary
    skill: media-reviewer
    validate:
      min_quotes: 5
      min_key_points: 10
      required_fields: [contentId, headline, tldr, coreIdeas, keyQuotes]
```

The skill itself (`media-reviewer`) remains unchanged - only the workflow's expectations change.

---

## Hook Implementations

### 1. PostToolUse:Write - Auto-Validate Artifacts

**Trigger**: When Write tool completes
**Action**: If file is in `sandbox/{id}/outputs/`, run validation and update `validation.json`

**Location**: `plugins/looplia-core/scripts/hooks/post-write-validate.sh`

**Behavior**:
- Reads JSON input from stdin (Claude Code hook format)
- Extracts `tool_input.file_path` from the input
- Skips files not in `sandbox/{id}/outputs/` directories
- Looks for `validation.json` in the sandbox directory
- Runs validation against criteria defined in `validation.json`
- Updates `validated: true` on success
- Returns error feedback to Claude on failure (exit code 2)

**Exit Codes**:
- `0`: Success (validated or skipped)
- `2`: Validation failed (feedback to Claude)

### 2. Stop - Workflow Completion Guard

**Trigger**: When main agent attempts to stop
**Action**: Block if any output has `validated: false`

**Location**: `plugins/looplia-core/scripts/hooks/stop-guard.sh`

**Behavior**:
- Finds active sandbox in `~/.looplia/sandbox/`
- Reads `validation.json` to check all outputs
- If any output has `validated: false`, outputs JSON to block:
  ```json
  {"decision": "block", "reason": "Workflow incomplete. Pending outputs: summary, ideas"}
  ```
- If all validated, exits normally to allow stop

**Safety**: Includes `stop_hook_active` check to prevent infinite loops.

### 3. SessionStart:compact - Inject Sandbox State

**Trigger**: When context is compacted
**Action**: Re-inject current sandbox progress into new context

**Location**: `plugins/looplia-core/scripts/hooks/compact-inject-state.sh`

**Behavior**:
- Finds active sandbox
- Outputs progress summary:
  ```
  === Active Sandbox: my-sandbox-id ===
  Workflow: writing-kit

  Progress:
    - summary: ✓ validated
    - ideas: ⏳ pending

  Next: Complete pending outputs in dependency order.
  ```

### 4. SubagentStop - Verify Subagent Completion

**Trigger**: When a subagent (Task tool) stops
**Action**: LLM verifies artifact was created

**Type**: Prompt-based hook (uses LLM instead of script)

**Prompt**:
```
Verify this subagent completed its task. Check:
1) Did it write an artifact to the sandbox outputs directory?
2) Is the artifact valid JSON?
Context: $ARGUMENTS.
Respond with {"decision": "approve"} if complete, or {"decision": "block", "reason": "..."} if not.
```

## Configuration

All hooks are configured in `plugins/looplia-core/hooks/hooks.json`:

```json
{
  "$schema": "https://code.claude.com/schemas/hooks.json",
  "hooks": [
    {
      "event": "PostToolUse",
      "matcher": "Write",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/post-write-validate.sh",
      "description": "Auto-validate artifacts written to sandbox outputs"
    },
    {
      "event": "Stop",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/stop-guard.sh",
      "description": "Guard workflow completion - block until all validated"
    },
    {
      "event": "SessionStart",
      "matcher": "compact",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/compact-inject-state.sh",
      "description": "Re-inject sandbox state after context compact"
    }
  ]
}
```

## Validation JSON Schema

Each sandbox has a `validation.json` file generated by workflow-executor from workflow frontmatter:

```json
{
  "workflow": "writing-kit",
  "steps": {
    "summary": {
      "validated": false,
      "artifact": "outputs/summary.json",
      "validate": {
        "required_fields": ["contentId", "headline", "tldr", "coreIdeas"],
        "min_quotes": 3,
        "min_key_points": 5
      }
    },
    "ideas": {
      "validated": false,
      "artifact": "outputs/ideas.json",
      "validate": {
        "required_fields": ["hooks", "angles", "questions"],
        "has_hooks": true
      }
    }
  }
}
```

## Testing

### Manual Testing

1. **PostToolUse:Write**:
   ```bash
   echo '{"tool_input": {"file_path": "/path/to/sandbox/my-id/outputs/summary.json"}}' | \
     ./plugins/looplia-core/scripts/hooks/post-write-validate.sh
   ```

2. **Stop Guard**:
   ```bash
   echo '{}' | ./plugins/looplia-core/scripts/hooks/stop-guard.sh
   ```

3. **Compact Inject**:
   ```bash
   ./plugins/looplia-core/scripts/hooks/compact-inject-state.sh
   ```

### E2E Testing

Run a full workflow and verify:
1. Artifacts trigger validation
2. Agent cannot stop with pending outputs
3. After compaction, context includes sandbox state

## Dependencies

- `jq` - JSON processing
- `bun` - For TypeScript validation scripts (optional)

## Related Documentation

- [Claude Code Hooks](./HOOKS.md) - Claude Code hooks system overview
- [Context Injection](./CONTEXT-INJECTION.md) - How context flows into workflows
- [DESIGN-0.6.2](./DESIGN-0.6.2.md) - Schema-in-Skill architecture design
