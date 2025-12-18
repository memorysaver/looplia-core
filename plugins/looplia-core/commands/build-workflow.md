---
description: Scaffold a new workflow definition
---

# Build Workflow

Create a new workflow-as-markdown file with the proper structure.

## Usage

```
/build-workflow <name>
```

## Arguments

| Argument | Description |
|----------|-------------|
| `name` | Name for the new workflow (e.g., "research-kit") |

## Example

```
/build-workflow research-kit
```

## Execution

1. **Validate name**
   - Check name is valid (lowercase, hyphens allowed)
   - Check `workflows/{name}.md` doesn't already exist

2. **Gather requirements**
   - Ask user about workflow purpose
   - Ask about expected outputs
   - Ask about required agents

3. **Generate workflow file**
   - Create `workflows/{name}.md`
   - Include YAML frontmatter with:
     - name, description
     - outputs with artifacts, agents, dependencies
     - validation criteria placeholders
   - Include markdown body with instructions

4. **Generate agent stubs** (optional)
   - Create `.claude/agents/{agent-name}.md` for each agent
   - Include skills frontmatter
   - Include task instructions

## Template Structure

```yaml
---
name: {name}
description: {user-provided description}

outputs:
  first-step:
    artifact: step1.json
    agent: step1-agent
    validate:
      required_fields: [field1]

  final-step:
    artifact: final.json
    agent: final-agent
    requires: [first-step]
    final: true
    validate:
      required_fields: [result]
---

# {Name} Workflow

{Custom instructions for this workflow}

## Context

{What this workflow is for}

## Expected Outputs

{Description of each output}
```

## Output

Report success with:
- Path to created workflow file
- Paths to any created agent files
- Suggested next steps (customize, test with `/run`)
