---
description: Run a Looplia workflow on content
---

# Run Workflow

Execute a workflow from `workflows/` on provided content.

## Usage

```
/run <workflow-id> --file <path>
/run <workflow-id> --session-id <id>
```

## Arguments

| Argument | Description |
|----------|-------------|
| `workflow-id` | Name of workflow (e.g., "writing-kit") |
| `--file <path>` | Path to content file (creates new session) |
| `--session-id <id>` | Resume existing session |

## Examples

```
/run writing-kit --file ~/articles/draft.md
/run writing-kit --session-id draft-2025-12-18-abc123
```

## Execution

Use the **workflow-executor** skill to handle all execution:

1. **Validate workflow exists**
   - Check `workflows/{workflow-id}.md` exists
   - Report error if not found

2. **Session handling**
   - If `--file`: Create new session folder in `contentItem/`, copy content
   - If `--session-id`: Load existing session from `contentItem/{session-id}/`

3. **Execute workflow**
   - Invoke workflow-executor skill
   - Pass session ID and workflow ID
   - Skill handles all orchestration

4. **Return result**
   - When final output passes validation
   - Return the final artifact JSON

## Error Handling

| Error | Action |
|-------|--------|
| Workflow not found | Report available workflows via `/list-workflows` |
| File not found | Report specific error with path |
| Session not found | Report available sessions |
| Validation failed | Retry subagent or report details |

## Related Commands

- `/list-workflows` - Show available workflows
- `/build-workflow` - Create a new workflow
