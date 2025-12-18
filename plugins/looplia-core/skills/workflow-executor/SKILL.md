---
name: workflow-executor
description: |
  Execute workflow-as-markdown definitions. Handles session creation,
  dependency resolution, subagent orchestration, and validation state tracking.
  This is the core skill that contains ALL workflow execution logic.
---

# Workflow Executor Skill

Execute workflows defined in `workflows/*.md` files with validation-driven completion.

## When to Use

Use this skill when:
- Handling `/run` commands
- Executing workflow-as-markdown definitions
- Orchestrating multi-step agent workflows

## Full Execution Protocol

### Phase 1: Sandbox Management

**New Sandbox** (when `--file` provided):

1. Generate sandbox ID using id-generator pattern:
   ```
   {content-slug}-{YYYY-MM-DD}-{random4chars}
   Example: my-article-2025-12-18-xk7m
   ```

2. Create sandbox folder structure:
   ```
   sandbox/{sandbox-id}/
   ├── inputs/content.md    # Copy content file here
   ├── outputs/             # Outputs written here
   ├── logs/                # Session logs
   └── validation.json      # Generated validation state
   ```

3. Copy content file to inputs:
   ```
   sandbox/{sandbox-id}/inputs/content.md
   ```

**Resume Sandbox** (when `--sandbox-id` provided):

1. Verify sandbox exists: `sandbox/{sandbox-id}/`
2. Load existing validation state from `sandbox/{sandbox-id}/validation.json`
3. Continue from last incomplete output

### Phase 2: Workflow Loading

1. Read workflow file:
   ```
   workflows/{workflow-id}.md
   ```

2. Parse YAML frontmatter:
   - `name` - Workflow identifier
   - `description` - What workflow does
   - `outputs` - Map of output definitions

3. Parse output definitions:
   ```yaml
   outputs:
     summary:
       artifact: summary.json      # Output file name
       agent: content-analyzer     # Subagent to invoke
       validate:                   # Validation criteria
         required_fields: [contentId, headline]
         min_quotes: 3
     ideas:
       artifact: ideas.json
       agent: idea-generator
       requires: [summary]         # Dependencies
     writing-kit:
       artifact: writing-kit.json
       agent: writing-kit-builder
       requires: [summary, ideas]
       final: true                 # This is the final output
   ```

4. Extract markdown body as custom instructions

### Phase 3: Validation State

**Generate validation.json** (new sandbox):

Write to `sandbox/{sandbox-id}/validation.json`:

```json
{
  "workflow": "writing-kit",
  "sandboxId": "article-2025-12-18-xk7m",
  "createdAt": "2025-12-18T10:30:00Z",
  "outputs": {
    "summary": {
      "artifact": "outputs/summary.json",
      "criteria": {
        "required_fields": ["contentId", "headline"],
        "min_quotes": 3
      },
      "validated": false
    },
    "ideas": {
      "artifact": "outputs/ideas.json",
      "criteria": {
        "required_fields": ["contentId", "ideas"]
      },
      "validated": false
    },
    "writing-kit": {
      "artifact": "outputs/writing-kit.json",
      "criteria": {
        "required_fields": ["contentId", "writingKit"]
      },
      "validated": false
    }
  }
}
```

**Read validation.json** (resume sandbox):

Load existing state from `sandbox/{sandbox-id}/validation.json` to determine what work remains.

### Phase 4: Dependency Resolution

Build topological order from `requires` fields:

```
Input:
  summary: { requires: [] }
  ideas: { requires: [summary] }
  writing-kit: { requires: [summary, ideas], final: true }

Computed order: [summary, ideas, writing-kit]
```

Algorithm:
1. Start with outputs that have no dependencies
2. Add outputs whose dependencies are already in the list
3. Repeat until all outputs are ordered

### Phase 5: Output Execution Loop

For each output in dependency order:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ OUTPUT EXECUTION LOOP                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

For output in [summary, ideas, writing-kit]:
    │
    ▼
┌─────────────────────────────────────────┐
│ Check: artifact exists AND validated?    │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼ YES           ▼ NO
    ┌─────────┐    ┌─────────────────────────────┐
    │ SKIP    │    │ 1. Invoke subagent          │
    │ (done)  │    │    via Task tool            │
    └─────────┘    │                             │
                   │ 2. Wait for artifact        │
                   │                             │
                   │ 3. Validate with            │
                   │    workflow-validator skill │
                   │                             │
                   │ 4. If PASSED:               │
                   │    - Update validation.json │
                   │    - Continue to next       │
                   │                             │
                   │ 5. If FAILED:               │
                   │    - Parse failed checks    │
                   │    - Retry subagent with    │
                   │      specific feedback      │
                   │    - Max 2 retries          │
                   └─────────────────────────────┘
```

### Phase 6: Subagent Invocation

Use the Task tool to invoke subagents:

```json
{
  "name": "Task",
  "input": {
    "subagent_type": "content-analyzer",
    "description": "Generate summary artifact",
    "prompt": "Analyze content at sandbox/{sandbox-id}/inputs/content.md and generate outputs/summary.json"
  }
}
```

Subagent protocol:
1. Subagent reads its agent definition from `.claude/agents/{name}.md`
2. Auto-loads skills from `skills:` frontmatter field
3. Reads input content from `sandbox/{sandbox-id}/inputs/content.md`
4. Reads any required artifacts from `sandbox/{sandbox-id}/outputs/`
5. Writes output to `sandbox/{sandbox-id}/outputs/{artifact}`

### Phase 7: Validation

After subagent writes artifact to `sandbox/{sandbox-id}/outputs/`:

1. Use **workflow-validator** skill
2. Run validation script:
   ```bash
   bun .claude/skills/workflow-validator/scripts/validate.ts \
     sandbox/{sandbox-id}/outputs/summary.json \
     '{"required_fields":["contentId"],"min_quotes":3}'
   ```
3. Parse result:
   ```json
   {
     "passed": true,
     "checks": [
       { "name": "has_contentId", "passed": true },
       { "name": "min_quotes", "passed": true, "message": "Found 5 (min: 3)" }
     ]
   }
   ```
4. If passed: Update `sandbox/{sandbox-id}/validation.json`
5. If failed: Retry with specific feedback

### Phase 8: Return Final

When output with `final: true` passes validation:

1. Read final artifact:
   ```
   sandbox/{sandbox-id}/outputs/writing-kit.json
   ```

2. Return as structured result:
   ```json
   {
     "status": "success",
     "sandboxId": "article-2025-12-18-xk7m",
     "workflow": "writing-kit",
     "artifact": { ... content of writing-kit.json ... }
   }
   ```

## Smart Continuation Logic

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SMART CONTINUATION DECISION                               │
└─────────────────────────────────────────────────────────────────────────────┘

Validation State                     │  Action
─────────────────────────────────────┼─────────────────────────────────────────
All outputs validated: false         │  Fresh start: Run all subagents
─────────────────────────────────────┼─────────────────────────────────────────
summary.validated: true              │  Skip content-analyzer
+ summary.json exists                │  Run: idea-generator, writing-kit-builder
─────────────────────────────────────┼─────────────────────────────────────────
summary + ideas validated: true      │  Skip content-analyzer, idea-generator
+ artifacts exist                    │  Run: writing-kit-builder only
─────────────────────────────────────┼─────────────────────────────────────────
All outputs validated: true          │  Already complete
+ all artifacts exist                │  Just return writing-kit.json
```

## Error Handling

| Scenario | Action |
|----------|--------|
| Workflow not found | Error with available workflows |
| Sandbox not found | Error with suggestion to use --file |
| Subagent fails | Retry up to 2 times with feedback |
| Validation fails | Provide specific failed checks to subagent |
| Max retries exceeded | Report failure with details |

## Example Execution Trace

```
/run writing-kit --file article.md

1. [SANDBOX] Created: sandbox/article-2025-12-18-xk7m/
   - inputs/content.md (copied)
   - outputs/ (empty)
   - logs/
   - validation.json (generated)

2. [WORKFLOW] Loaded: workflows/writing-kit.md
3. [ORDER] Computed: [summary, ideas, writing-kit]

4. [EXECUTE] summary
   - Invoke: content-analyzer
   - Input: sandbox/.../inputs/content.md
   - Output: sandbox/.../outputs/summary.json (written)
   - Validate: PASSED
   - Update: validation.json (summary.validated = true)

5. [EXECUTE] ideas
   - Invoke: idea-generator
   - Input: sandbox/.../outputs/summary.json
   - Output: sandbox/.../outputs/ideas.json (written)
   - Validate: PASSED
   - Update: validation.json (ideas.validated = true)

6. [EXECUTE] writing-kit
   - Invoke: writing-kit-builder
   - Input: sandbox/.../outputs/summary.json, ideas.json
   - Output: sandbox/.../outputs/writing-kit.json (written)
   - Validate: PASSED
   - Update: validation.json (writing-kit.validated = true)

7. [COMPLETE] Final output: outputs/writing-kit.json
   - Return structured result
```

## File References

- Workflow definitions: `workflows/*.md`
- Agent definitions: `.claude/agents/*.md`
- Sandbox storage: `sandbox/{sandbox-id}/`
  - Input content: `sandbox/{sandbox-id}/inputs/content.md`
  - Output artifacts: `sandbox/{sandbox-id}/outputs/`
  - Session logs: `sandbox/{sandbox-id}/logs/`
  - Validation state: `sandbox/{sandbox-id}/validation.json`
- Validator script: `.claude/skills/workflow-validator/scripts/validate.ts`
