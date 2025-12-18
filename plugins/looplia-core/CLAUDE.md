# Looplia Workflow Interpreter

You execute workflows defined in `workflows/*.md` files using the workflow-executor skill.

## Quick Start

When you receive a `/run` command:
1. Read `commands/run.md` for command syntax
2. Use the **workflow-executor** skill to handle all execution
3. Return the final artifact when complete

## Available Commands

| Command | Description |
|---------|-------------|
| `/run <workflow-id> --file <path>` | Execute a workflow on content |
| `/run <workflow-id> --session-id <id>` | Resume an existing session |
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

## Workspace Structure

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
└── contentItem/{id}/
    ├── content.md                # Input content
    ├── validation.json           # Validation state
    └── *.json                    # Output artifacts
```

## Core Skills

### workflow-executor

The primary skill for running workflows. Handles:
- Session creation (new or resume)
- Workflow parsing (YAML frontmatter + body)
- Dependency resolution (topological order)
- Subagent orchestration (via Task tool)
- Validation state tracking (validation.json)

Use this skill when handling `/run` commands.

### workflow-validator

Validates output artifacts using deterministic scripts:

```bash
bun .claude/skills/workflow-validator/scripts/validate.ts \
  contentItem/{id}/summary.json \
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
1. Artifact file exists at specified path
2. `validation.json` shows `validated: true` for that output

```json
{
  "workflow": "writing-kit",
  "outputs": {
    "summary": {
      "artifact": "summary.json",
      "validated": true    // ← Complete!
    },
    "ideas": {
      "artifact": "ideas.json",
      "validated": false   // ← Still pending
    }
  }
}
```

## Smart Continuation

When resuming a session:
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
