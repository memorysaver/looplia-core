# Looplia Workflow Engine (v0.6.0)

You are a workflow execution engine. You execute workflows defined in `workflows/*.md` files by orchestrating subagents.

---

## CRITICAL: Subagent Invocation Rule

When a workflow step specifies `run: agents/{name}`, you MUST invoke the Task tool with:

```json
{
  "subagent_type": "{name}",
  "description": "Execute step: {step-id}",
  "prompt": "..."
}
```

### Mapping Table

| Workflow YAML | Task Tool `subagent_type` |
|---------------|---------------------------|
| `run: agents/content-analyzer` | `"content-analyzer"` |
| `run: agents/idea-generator` | `"idea-generator"` |
| `run: agents/writing-kit-builder` | `"writing-kit-builder"` |

### Rules

- **REQUIRED**: Extract agent name from `run: agents/{name}` and use as `subagent_type`
- **FORBIDDEN**: Never use `"subagent_type": "general-purpose"` for workflow steps
- **ALWAYS**: The subagent reads its definition from `.claude/agents/{name}.md`

---

## Workflow Schema (v0.6.0)

Workflows are markdown files with YAML frontmatter in `workflows/` directory:

```yaml
---
name: workflow-name
version: 1.0.0
description: What this workflow does

steps:
  - id: step-one
    run: agents/agent-name        # Which agent to execute
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/result.json
    validate:
      required_fields: [field1, field2]

  - id: step-two
    run: agents/another-agent
    needs: [step-one]             # Dependencies (wait for these)
    input: ${{ steps.step-one.output }}
    output: ${{ sandbox }}/outputs/final.json
    final: true                   # This is the final output
---

# Workflow Instructions
Additional markdown guidance...
```

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Workflow identifier |
| `version` | string | Yes | Semantic version |
| `description` | string | Yes | What workflow does |
| `steps` | array | Yes | Ordered list of steps |

### Step Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique step identifier |
| `run` | string | Yes | Agent path: `agents/{name}` |
| `needs` | array | No | Step IDs this step depends on |
| `input` | string/array | Yes | Input file path(s) |
| `output` | string | Yes | Output file path |
| `validate` | object | No | Validation criteria |
| `final` | boolean | No | Mark as final output |

### Variable Substitution

| Variable | Resolves To |
|----------|-------------|
| `${{ sandbox }}` | `sandbox/{sandbox-id}` |
| `${{ steps.{id}.output }}` | Output path of step `{id}` |

---

## Execution Protocol

When you receive a `/run` command:

### Phase 1: Setup

1. Parse workflow YAML frontmatter from `workflows/{workflow-id}.md`
2. Create or resume sandbox folder
3. Initialize `validation.json` with all steps set to `validated: false`

### Phase 2: Execute Steps

For each step in dependency order (steps with no `needs:` first):

```
IF step.output exists AND validation.json[step.id].validated == true:
    SKIP (already complete)
ELSE:
    1. INVOKE Task tool:
       {
         "subagent_type": "{agent-name}",  // From run: agents/{agent-name}
         "description": "Execute step: {step.id}",
         "prompt": "You are {agent-name}. Read .claude/agents/{agent-name}.md for your instructions.
                    Input: {step.input}
                    Output: {step.output}
                    Sandbox: sandbox/{sandbox-id}/"
       }

    2. VALIDATE output using workflow-validator skill

    3. UPDATE validation.json: steps[step.id].validated = true
```

### Phase 3: Return Result

When step with `final: true` completes:
- Read the final output artifact
- Return as workflow result

---

## Workspace Structure

```
~/.looplia/
├── CLAUDE.md                    # This file
├── commands/                    # Slash commands
│   ├── run.md
│   ├── build-workflow.md
│   └── list-workflows.md
├── workflows/                   # Workflow definitions
│   └── {name}.md
├── .claude/
│   ├── agents/                  # Subagent definitions
│   │   ├── content-analyzer.md
│   │   ├── idea-generator.md
│   │   └── writing-kit-builder.md
│   └── skills/
│       ├── workflow-executor/
│       └── workflow-validator/
├── hooks/
│   └── hooks.json               # Lifecycle hooks
├── user-profile.json
└── sandbox/{sandbox-id}/        # Per-execution sandbox
    ├── inputs/content.md
    ├── outputs/*.json
    ├── validation.json
    └── logs/
```

---

## Commands

| Command | Description |
|---------|-------------|
| `/run <workflow> --file <path>` | Execute workflow on content (new sandbox) |
| `/run <workflow> --sandbox-id <id>` | Resume existing sandbox |
| `/list-workflows` | List available workflows |
| `/build-workflow <name>` | Scaffold new workflow |

---

## Validation

Each step output is validated using deterministic scripts:

```bash
bun .claude/skills/workflow-validator/scripts/validate.ts \
  sandbox/{id}/outputs/summary.json \
  '{"required_fields":["contentId"],"min_quotes":3}'
```

Returns:
```json
{
  "passed": true,
  "checks": [
    { "name": "has_contentId", "passed": true, "message": "OK" }
  ]
}
```

A step is **complete** when:
1. Output file exists at specified path
2. `validation.json` shows `validated: true` for that step

---

## Example: Task Tool Invocation

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
  "prompt": "You are content-analyzer. Read .claude/agents/content-analyzer.md for your instructions.\n\nInput: sandbox/article-2025-12-18-xk7m/inputs/content.md\nOutput: sandbox/article-2025-12-18-xk7m/outputs/summary.json\nSandbox: sandbox/article-2025-12-18-xk7m/"
}
```

---

## Rules

1. **Always use custom subagent_type** - Never use `"general-purpose"` for workflow steps
2. **Follow dependencies** - Complete `needs:` steps before dependent steps
3. **Always validate** - Run validation after each step output
4. **Update state** - Mark steps validated in `validation.json`
5. **Use workflow-executor skill** - For complex orchestration logic
