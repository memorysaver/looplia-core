---
name: workflow-executor
description: |
  Execute workflow-as-markdown definitions with the v0.6.0 steps-based format.
  Handles sandbox management, step execution, and validation state tracking.
---

# Workflow Executor Skill (v0.6.0)

Execute workflows defined in `workflows/*.md` files using the steps-based format.

## When to Use

Use this skill when:
- Handling `/run` commands
- Executing workflow-as-markdown definitions
- Orchestrating multi-step agent workflows

---

## CRITICAL: Subagent Invocation

When executing a step with `run: agents/{name}`:

```json
{
  "subagent_type": "{name}",
  "description": "Execute step: {step.id}",
  "prompt": "..."
}
```

**Example:**
```yaml
- id: summary
  run: agents/content-analyzer
```

**Task tool call:**
```json
{
  "subagent_type": "content-analyzer",
  "description": "Execute step: summary",
  "prompt": "You are content-analyzer..."
}
```

**NEVER use `"subagent_type": "general-purpose"` for workflow steps.**

---

## Execution Protocol

### Phase 1: Sandbox Setup

**New Sandbox** (when `--file` provided):

1. Generate sandbox ID:
   ```
   {content-slug}-{YYYY-MM-DD}-{random4chars}
   Example: my-article-2025-12-18-xk7m
   ```

2. Create folder structure:
   ```
   sandbox/{sandbox-id}/
   ├── inputs/content.md    # Copy content file here
   ├── outputs/             # Step outputs go here
   ├── logs/                # Session logs
   └── validation.json      # Validation state
   ```

3. Copy content file to `inputs/content.md`

**Resume Sandbox** (when `--sandbox-id` provided):

1. Verify sandbox exists
2. Load `validation.json` to see completed steps
3. Continue from first incomplete step

### Phase 2: Workflow Parsing

1. Read workflow file: `workflows/{workflow-id}.md`

2. Parse YAML frontmatter:
   ```yaml
   name: workflow-name
   version: 1.0.0
   description: ...
   steps:
     - id: step-one
       run: agents/agent-name
       input: ...
       output: ...
   ```

3. Build dependency graph from `needs:` fields

### Phase 3: Validation State

**Generate validation.json** (new sandbox):

```json
{
  "workflow": "writing-kit",
  "version": "1.0.0",
  "sandboxId": "article-2025-12-18-xk7m",
  "createdAt": "2025-12-18T10:30:00Z",
  "steps": {
    "summary": {
      "output": "outputs/summary.json",
      "validated": false
    },
    "ideas": {
      "output": "outputs/ideas.json",
      "validated": false
    },
    "writing-kit": {
      "output": "outputs/writing-kit.json",
      "validated": false
    }
  }
}
```

### Phase 4: Dependency Resolution

Compute execution order using topological sort:

```
Input:
  summary: { needs: [] }
  ideas: { needs: [summary] }
  writing-kit: { needs: [summary, ideas] }

Computed order: [summary, ideas, writing-kit]
```

### Phase 5: Step Execution Loop

```
FOR EACH step in dependency order:
    │
    ▼
┌─────────────────────────────────────────┐
│ Check: output exists AND validated?      │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼ YES           ▼ NO
    ┌─────────┐    ┌─────────────────────────────┐
    │ SKIP    │    │ 1. INVOKE Task tool:        │
    │ (done)  │    │    subagent_type: {agent}   │
    └─────────┘    │    (from run: agents/{agent})│
                   │                              │
                   │ 2. VALIDATE output           │
                   │                              │
                   │ 3. UPDATE validation.json    │
                   │                              │
                   │ 4. IF FAILED: retry (max 2x) │
                   └─────────────────────────────┘
```

### Phase 6: Task Tool Invocation

For step:
```yaml
- id: summary
  run: agents/content-analyzer
  input: ${{ sandbox }}/inputs/content.md
  output: ${{ sandbox }}/outputs/summary.json
```

Invoke Task tool:
```json
{
  "subagent_type": "content-analyzer",
  "description": "Execute step: summary",
  "prompt": "You are content-analyzer. Read your instructions from .claude/agents/content-analyzer.md\n\nYour task:\n- Input: sandbox/article-2025-12-18-xk7m/inputs/content.md\n- Output: sandbox/article-2025-12-18-xk7m/outputs/summary.json\n\nWrite the output JSON to the specified path."
}
```

### Phase 7: Validation

After step output is written:

1. Use **workflow-validator** skill
2. Run validation script:
   ```bash
   bun .claude/skills/workflow-validator/scripts/validate.ts \
     sandbox/{id}/outputs/summary.json \
     '{"required_fields":["contentId"],"min_quotes":3}'
   ```

3. Parse result:
   ```json
   {
     "passed": true,
     "checks": [
       { "name": "has_contentId", "passed": true }
     ]
   }
   ```

4. If passed: Update `validation.json` with `validated: true`
5. If failed: Retry step with feedback (max 2 retries)

### Phase 8: Return Final Output

When step with `final: true` passes validation:

1. Read final artifact from `sandbox/{id}/outputs/{artifact}`
2. Return structured result:
   ```json
   {
     "status": "success",
     "sandboxId": "article-2025-12-18-xk7m",
     "workflow": "writing-kit",
     "artifact": { ... }
   }
   ```

---

## Variable Substitution

Resolve variables before passing to subagents:

| Variable | Resolution |
|----------|------------|
| `${{ sandbox }}` | `sandbox/{sandbox-id}` |
| `${{ steps.{id}.output }}` | Actual output path of step `{id}` |

Example:
```yaml
input: ${{ steps.summary.output }}
# Resolves to: sandbox/article-2025-12-18-xk7m/outputs/summary.json
```

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Workflow not found | Error with available workflows |
| Sandbox not found | Error with suggestion to use --file |
| Step fails | Retry up to 2 times with feedback |
| Validation fails | Provide specific failed checks to subagent |
| Max retries exceeded | Report failure with details |

---

## Example Execution Trace

```
/run writing-kit --file article.md

1. [SANDBOX] Created: sandbox/article-2025-12-18-xk7m/
   - inputs/content.md (copied)
   - validation.json (generated)

2. [WORKFLOW] Loaded: workflows/writing-kit.md
   - version: 1.0.0
   - steps: [summary, ideas, writing-kit]

3. [ORDER] Computed: [summary, ideas, writing-kit]

4. [STEP] summary
   - Task tool: subagent_type="content-analyzer"
   - Output: outputs/summary.json
   - Validate: PASSED
   - Update: validation.json (summary.validated = true)

5. [STEP] ideas
   - Task tool: subagent_type="idea-generator"
   - Output: outputs/ideas.json
   - Validate: PASSED
   - Update: validation.json (ideas.validated = true)

6. [STEP] writing-kit
   - Task tool: subagent_type="writing-kit-builder"
   - Output: outputs/writing-kit.json
   - Validate: PASSED
   - Update: validation.json (writing-kit.validated = true)

7. [COMPLETE] Final output: writing-kit.json
```

---

## File References

- Workflow definitions: `workflows/*.md`
- Agent definitions: `.claude/agents/*.md`
- Sandbox storage: `sandbox/{sandbox-id}/`
- Validator script: `.claude/skills/workflow-validator/scripts/validate.ts`
