---
description: List available Looplia workflows
---

# List Workflows

Show all available workflows in the `workflows/` directory.

## Usage

```
/list-workflows
```

## Execution

1. **Scan workflows directory**
   - Read all `*.md` files in `workflows/`
   - Parse YAML frontmatter from each

2. **Extract metadata**
   - name
   - description
   - outputs (list of step names)
   - final output name

3. **Display results**
   - Table format with workflow info
   - Show example usage

## Example Output

```
Available Workflows
===================

| Workflow     | Description                  | Steps                          |
|--------------|------------------------------|--------------------------------|
| writing-kit  | Generate content writing kit | summary → ideas → writing-kit  |

Usage:
  /run writing-kit --file <path>
```

## No Workflows Found

If no workflows exist:
1. Report that no workflows are available
2. Suggest using `/build-workflow` to create one
3. Provide example: `/build-workflow my-workflow`

## Related Commands

- `/run <workflow-id> --file <path>` - Execute a workflow
- `/build-workflow <name>` - Create a new workflow
