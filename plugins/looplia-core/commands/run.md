---
description: Run a Looplia workflow on content
---

# Run Workflow

Execute a workflow from `workflows/` on provided content.

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

Use the **workflow-executor** skill to handle all execution:

1. **Validate workflow exists**
   - Check `workflows/{workflow-id}.md` exists
   - Report error if not found

2. **Sandbox handling**
   - If `--file`: Create new sandbox with structure:
     ```
     sandbox/{sandbox-id}/
       inputs/content.md    # Copy content file here
       outputs/             # Empty - outputs go here
       logs/                # Session logs
       validation.json      # Validation state
     ```
   - If `--sandbox-id`: Load existing sandbox from `sandbox/{sandbox-id}/`

3. **Execute workflow steps** (v0.6.2 Per-Step Orchestration)
   - Read workflow YAML frontmatter from `workflows/{workflow-id}.md`
   - Parse `steps:` array and resolve dependencies
   - **FOR EACH step in dependency order:**
     ```json
     Task({
       "subagent_type": "skill-executor",
       "description": "Execute step: {step.id}",
       "prompt": "Execute skill '{step.skill}' for step '{step.id}'.\n\nMission: {step.mission}\n\nInput: {resolved input path}\nOutput: {step.output}\nValidation: {step.validate}"
     })
     ```
   - After each Task completes, verify output file exists
   - Update `validation.json` with step completion

   **CRITICAL**: You MUST call Task(skill-executor) separately for EACH step.
   Do NOT delegate the entire workflow to one skill-executor call.

4. **Return result**
   - When step with `final: true` passes validation
   - Read and return the final artifact JSON

## Error Handling

| Error | Action |
|-------|--------|
| Workflow not found | Report available workflows via `/list-workflows` |
| File not found | Report specific error with path |
| Sandbox not found | Report available sandboxes |
| Validation failed | Retry subagent or report details |

## Related Commands

- `/list-workflows` - Show available workflows
- `/build-workflow` - Create a new workflow
