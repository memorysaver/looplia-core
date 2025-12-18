# Looplia Workflow Interpreter (v0.5.2)

You execute workflows defined in `workflows/*.md` files using the workflow-executor skill.

## Quick Start

When you receive a `/run` command:
1. Read `commands/run.md` for command syntax
2. Use the **workflow-executor** skill to handle all execution
3. Return the final artifact when complete

## Available Commands

| Command | Description |
|---------|-------------|
| `/run <workflow-id> --file <path>` | Execute a workflow (creates new sandbox) |
| `/run <workflow-id> --file <path> --sandbox-id <id>` | Execute with explicit sandbox ID |
| `/run <workflow-id> --sandbox <id>` | Resume an existing sandbox |
| `/build-workflow <name>` | Scaffold a new workflow definition |
| `/list-workflows` | List available workflows |

## Workflow-as-Markdown Format

Workflows are markdown files with YAML frontmatter:

```yaml
---
name: workflow-name
description: What this workflow does

outputs:
  step-one:
    artifact: output.json
    agent: subagent-name
    validate:
      required_fields: [field1, field2]

  step-two:
    artifact: final.json
    agent: another-agent
    requires: [step-one]
    final: true
---

# Custom Instructions
Additional guidance for this workflow...
```

## Workspace Structure (v0.5.2)

```
~/.looplia/
├── CLAUDE.md                     # This file (interpreter instructions)
├── commands/                     # Slash command definitions
│   ├── run.md
│   ├── build-workflow.md
│   └── list-workflows.md
├── workflows/                    # Workflow definitions (Looplia extension)
│   └── {name}.md
├── .claude/
│   ├── agents/*.md               # Subagent definitions
│   └── skills/
│       ├── workflow-executor/    # Core execution skill
│       └── workflow-validator/   # Output validation skill
├── user-profile.json             # User preferences
└── sandbox/{sandbox-id}/         # Sandbox folder (v0.5.2)
    ├── inputs/
    │   └── content.md            # Input content
    ├── outputs/
    │   ├── summary.json          # Workflow outputs
    │   ├── ideas.json
    │   └── writing-kit.json
    ├── validation.json           # Validation state
    └── logs/
        └── {session-id}.log      # Session logs
```

## Core Skills

### workflow-executor

The primary skill for running workflows. Handles:
- Sandbox creation (new or resume) - v0.5.2
- Workflow parsing (YAML frontmatter + body)
- Dependency resolution (topological order)
- Subagent orchestration (via Task tool)
- Validation state tracking (validation.json)

Use this skill when handling `/run` commands.

### workflow-validator

Validates output artifacts using deterministic scripts:

```bash
bun .claude/skills/workflow-validator/scripts/validate.ts \
  sandbox/{sandbox-id}/outputs/summary.json \
  '{"required_fields":["contentId"],"min_quotes":3}'
```

Returns validation result (no LLM tokens consumed):
```json
{
  "passed": true,
  "checks": [
    { "name": "has_contentId", "passed": true, "message": "OK" }
  ]
}
```

## Validation-Driven Completion

A step is **complete** when:
1. Artifact file exists at specified path in `outputs/`
2. `validation.json` shows `validated: true` for that output

```json
{
  "workflow": "writing-kit",
  "sandboxId": "text-2025-12-18-ai-healthcare",
  "outputs": {
    "summary": {
      "artifact": "outputs/summary.json",
      "validated": true    // ← Complete!
    },
    "ideas": {
      "artifact": "outputs/ideas.json",
      "validated": false   // ← Still pending
    }
  }
}
```

## Smart Continuation

When resuming a sandbox:
1. Read validation.json
2. Skip outputs with `validated: true`
3. Continue from first pending output

This enables:
- Interrupted work to be resumed
- Cost savings by not repeating validated steps
- Clear progress tracking

## Rules

- **Use workflow-executor skill** - Don't manually implement workflow logic
- **Always validate** - Never skip validation after artifact creation
- **Update state** - Mark outputs validated in validation.json when passed
- **Follow dependencies** - Complete required outputs before dependent ones
