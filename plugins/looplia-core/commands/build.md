---
description: Build a looplia workflow from natural language requirements
---

# Build Looplia Workflow

Create a complete looplia workflow definition from a natural language description using AI-assisted workflow generation.

## Usage

```
/build [--name <name>] [description]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `description` | (Optional) Natural language description of what the workflow should do |
| `--name <name>` | (Optional) Explicit workflow filename. If provided, use this exact name instead of deriving from description |

## Execution

### 1. Gather Requirements

If no description provided:
- Ask user: "What should this workflow do?"
- Clarify input types (video, article, text, etc.)
- Clarify expected outputs (JSON, markdown, summary, etc.)

### 2. Use plugin-registry-scanner skill

Discover available skills from installed plugins:

```
Skill("plugin-registry-scanner")
```

This returns a registry of all available skills with their capabilities.

### 3. Use skill-capability-matcher skill

Match requirements to available skills:

```
Skill("skill-capability-matcher")
```

Provide:
- User's description
- Registry from step 2

This returns:
- Recommended skill sequence
- Step IDs and missions
- Data flow dependencies

### 4. Use workflow-schema-composer skill

Generate the complete workflow:

```
Skill("workflow-schema-composer")
```

Provide:
- Original requirements
- Skill sequence from step 3
- **Explicit name (if `--name` was provided)** - use this exact name, do not derive from description

This returns:
- Complete workflow YAML/Markdown with `skill:` + `mission:` syntax
- Filename (user-specified or auto-derived)

### 5. Save Workflow

Write the generated workflow to:
```
~/.looplia/workflows/{name}.md
```

### 6. Report Success

Show:
- Path to created workflow file
- Run command example: `looplia run {name} --file <content.md>`
- Number of steps created

## Examples

### Interactive Mode

```
User: /build
Claude: What should this workflow do?
User: I want to analyze YouTube videos and create blog outlines
Claude: [Uses 3 skills to generate workflow]
        Created: ~/.looplia/workflows/video-to-blog.md (3 steps)
        Run with: looplia run video-to-blog --file <transcript.md>
```

### Direct Mode

```
/build analyze videos and create blog outlines with key quotes
```

Output:
```
Created workflow: ~/.looplia/workflows/video-to-blog.md

Steps:
1. analyze-content (media-reviewer)
2. generate-ideas (idea-synthesis)
3. build-outline (writing-kit-assembler)

Run with:
  looplia run video-to-blog --file <transcript.md>
```

### With Explicit Name

```
/build --name article-summary summarize articles and extract key points
```

Output:
```
Created workflow: ~/.looplia/workflows/article-summary.md

Steps:
1. analyze-article (media-reviewer)
2. structure-summary (content-documenter)

Run with:
  looplia run article-summary --file <article.md>
```

## Generated Workflow Format

All generated workflows use v0.6.1 `skill:` + `mission:` syntax:

```yaml
---
name: video-to-blog
version: 1.0.0
description: Analyze videos and create blog outlines

steps:
  - id: analyze-content
    skill: media-reviewer
    mission: |
      Deep analysis of video transcript. Extract key themes,
      important quotes, and narrative structure.
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/analysis.json
    model: haiku
    validate:
      required_fields: [contentId, headline, keyThemes]

  - id: generate-ideas
    skill: idea-synthesis
    mission: |
      Generate hooks, angles, and questions from the analysis.
      Read user profile for personalization.
    needs: [analyze-content]
    input: ${{ steps.analyze-content.output }}
    output: ${{ sandbox }}/outputs/ideas.json
    validate:
      required_fields: [contentId, hooks, angles]

  - id: build-outline
    skill: writing-kit-assembler
    mission: |
      Create structured blog outline with sections and key points.
    needs: [analyze-content, generate-ideas]
    input:
      - ${{ steps.analyze-content.output }}
      - ${{ steps.generate-ideas.output }}
    output: ${{ sandbox }}/outputs/outline.json
    final: true
    validate:
      required_fields: [contentId, suggestedOutline]
---
```

## Error Handling

| Scenario | Response |
|----------|----------|
| No plugins installed | Error: "No skills found. Install looplia-writer plugin." |
| No matching skills | Warning: Show capability gaps, offer partial workflow |
| Invalid workflow generated | Retry generation with schema reminder |

## Notes

- Generated workflows are saved to `~/.looplia/workflows/`
- All workflows use v0.6.1 `skill:` + `mission:` format
- The deprecated `run: agents/X` syntax is never generated
