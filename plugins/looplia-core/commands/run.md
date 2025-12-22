---
description: Execute a looplia workflow on content. Run looplia pipeline, start workflow automation.
---

# Execute Looplia Workflow

Run a looplia workflow from `workflows/` on provided content.

## Usage

```
/run <workflow-id> --file <path>
/run <workflow-id> --sandbox-id <id>
```

## Arguments

| Argument | Description |
|----------|-------------|
| `workflow-id` | Name of workflow (e.g., "writing-kit") |
| `--file <path>` | Path to content file (creates new sandbox) |
| `--sandbox-id <id>` | Resume existing sandbox |

## Examples

```
/run writing-kit --file ~/articles/draft.md
/run writing-kit --sandbox-id draft-2025-12-18-abc123
```

## Execution

**Use the `Skill("workflow-executor")` to handle all execution.**

The workflow-executor skill:
1. Parses workflow YAML from `workflows/{workflow-id}.md`
2. Creates/resumes sandbox
3. Executes each step via `Task(skill-executor)`
4. Manages validation state
5. Returns final artifact

See `plugins/looplia-core/skills/workflow-executor/SKILL.md` for implementation details.

## Error Handling

| Error | Action |
|-------|--------|
| Workflow not found | Report available workflows via `/list-workflows` |
| File not found | Report specific error with path |
| Sandbox not found | Report available sandboxes |
