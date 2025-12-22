---
description: Build a looplia workflow from natural language. Create looplia pipeline, generate workflow automation.
---

# Build Looplia Workflow

Create a looplia workflow definition from natural language using the skills-first architecture.

## Usage

```
/build [--name <name>] [description]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `description` | (Optional) Natural language description of what the workflow should do |
| `--name <name>` | (Optional) Explicit workflow filename. If provided, use this exact name |

## Execution

**Use three skills in sequence:**

1. `Skill("plugin-registry-scanner")` → Discover available skills from plugins
2. `Skill("skill-capability-matcher")` → Match requirements to skills
3. `Skill("workflow-schema-composer")` → Generate workflow file

Each skill's SKILL.md contains implementation details. See `plugins/looplia-core/skills/` for full documentation.

### Workflow

1. Gather requirements (if no description provided, ask user)
2. Call `Skill("plugin-registry-scanner")`
3. Call `Skill("skill-capability-matcher")` with registry + requirements
4. Call `Skill("workflow-schema-composer")` with matched skills + `--name` flag if provided
5. Save generated workflow to `~/.looplia/workflows/{name}.md`
6. Report success with run command example

## Examples

### Interactive Mode

```
User: /build
Claude: What should this workflow do?
User: Analyze YouTube videos and create blog outlines
Claude: Created: ~/.looplia/workflows/video-to-blog.md (3 steps)
        Run with: looplia run video-to-blog --file <transcript.md>
```

### Direct Mode

```
/build analyze videos and create blog outlines with key quotes
```

### With Explicit Name

```
/build --name article-summary summarize articles and extract key points
```

## Error Handling

| Scenario | Response |
|----------|----------|
| No plugins installed | Error: "No skills found. Install looplia-writer plugin." |
| No matching skills | Warning: Show capability gaps, offer partial workflow |
| Invalid workflow generated | Retry generation with schema reminder |
