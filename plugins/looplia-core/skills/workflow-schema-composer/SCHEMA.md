# Workflow Schema v0.6.1

Complete reference for the looplia workflow-as-markdown schema.

## Frontmatter Structure

```yaml
---
name: workflow-name
version: 1.0.0
description: What this workflow does

steps:
  - id: step-id
    skill: skill-name
    mission: |
      Natural language task description
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/result.json
    needs: [dependency-step-id]
    model: haiku
    validate:
      required_fields: [field1, field2]
    final: true
---
```

## Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Workflow identifier (kebab-case) |
| `version` | string | **Yes** | Semantic version (e.g., "1.0.0") |
| `description` | string | **Yes** | What the workflow does |
| `steps` | array | **Yes** | Ordered list of workflow steps |

## Step Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique step identifier (kebab-case) |
| `skill` | string | **Yes** | Skill to execute |
| `mission` | string | **Yes** | Natural language task description |
| `input` | string/array | **Yes** | Input file path(s) |
| `output` | string | **Yes** | Output file path |
| `needs` | string[] | No | Step IDs this step depends on |
| `model` | string | No | Model override (haiku/sonnet/opus) |
| `validate` | object | No | Validation criteria |
| `final` | boolean | No | Mark as final workflow output |

## Variable Substitution

| Variable | Description | Example |
|----------|-------------|---------|
| `${{ sandbox }}` | Current sandbox directory | `sandbox/video-2025-01-15-abc123` |
| `${{ steps.{id}.output }}` | Output path of step `{id}` | `sandbox/.../outputs/analysis.json` |

## Validation Criteria

```yaml
validate:
  required_fields: [contentId, headline]
  min_quotes: 3
  min_key_points: 5
  has_hooks: true
  min_outline_sections: 4
```

| Criterion | Type | Description |
|-----------|------|-------------|
| `required_fields` | string[] | JSON fields that must exist |
| `min_quotes` | number | Minimum quotes in importantQuotes |
| `min_key_points` | number | Minimum items in keyThemes |
| `has_hooks` | boolean | hooks array must not be empty |
| `min_outline_sections` | number | Minimum sections in outline |

## Model Options

| Model | Use Case |
|-------|----------|
| `haiku` | Fast, simple tasks (analysis, extraction) |
| `sonnet` | Balanced (default, most workflows) |
| `opus` | Complex reasoning (rarely needed) |

## Naming Conventions

### Workflow Names
- Use kebab-case: `video-to-blog`, `content-analyzer`
- Be descriptive but concise
- Avoid generic names like `workflow-1`

### Step IDs
- Use kebab-case: `analyze-content`, `generate-ideas`
- Start with action verb when possible
- Keep under 25 characters

### Skills
- Match exact skill name from plugin
- Case-sensitive: `media-reviewer`, not `Media-Reviewer`

## Dependency Rules

1. **No forward references** - A step can only depend on steps defined before it
2. **No circular dependencies** - A → B → A is invalid
3. **No self-references** - A step cannot depend on itself
4. **All references valid** - Every ID in `needs:` must exist

## Example: Complete Workflow

```yaml
---
name: writing-kit
version: 2.0.0
description: Transform content into structured writing kit

steps:
  - id: analyze-content
    skill: media-reviewer
    mission: |
      Analyze content deeply. Detect source type (video/audio/text).
      Extract key themes, important quotes, narrative structure.
      Output comprehensive analysis as structured JSON.
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/analysis.json
    model: haiku
    validate:
      required_fields: [contentId, headline, keyThemes, importantQuotes]

  - id: generate-ideas
    skill: idea-synthesis
    mission: |
      Read user profile for personalization context.
      Generate hooks, angles, and questions based on content analysis.
      Focus on user's interests and writing style preferences.
    needs: [analyze-content]
    input: ${{ steps.analyze-content.output }}
    output: ${{ sandbox }}/outputs/ideas.json
    validate:
      required_fields: [contentId, hooks, angles, questions]

  - id: build-writing-kit
    skill: writing-kit-assembler
    mission: |
      Combine analysis and ideas into comprehensive writing kit.
      Create structured outline with introduction, body sections, conclusion.
      Include all metadata and source references.
    needs: [analyze-content, generate-ideas]
    input:
      - ${{ steps.analyze-content.output }}
      - ${{ steps.generate-ideas.output }}
    output: ${{ sandbox }}/outputs/writing-kit.json
    final: true
    validate:
      required_fields: [contentId, summary, ideas, suggestedOutline]
---

# Writing Kit Workflow

Transform raw content into a comprehensive writing kit.

## Usage

```bash
looplia run writing-kit --file <content.md>
```

## Steps

1. **analyze-content**: Deep analysis using media-reviewer skill
2. **generate-ideas**: Idea synthesis with user personalization
3. **build-writing-kit**: Assemble final writing kit
```

## Anti-Patterns (v0.6.1)

### FORBIDDEN: run: syntax

```yaml
# WRONG - Do not use
- id: summary
  run: agents/content-analyzer

# CORRECT - Use skill: syntax
- id: summary
  skill: media-reviewer
  mission: |
    Analyze and summarize the content...
```

### FORBIDDEN: Missing mission

```yaml
# WRONG - Missing mission
- id: analyze
  skill: media-reviewer
  input: ${{ sandbox }}/inputs/content.md
  output: ${{ sandbox }}/outputs/analysis.json

# CORRECT - Include mission
- id: analyze
  skill: media-reviewer
  mission: |
    Deep analysis of the content. Extract themes and quotes.
  input: ${{ sandbox }}/inputs/content.md
  output: ${{ sandbox }}/outputs/analysis.json
```

## Migration from v0.6.0

| v0.6.0 | v0.6.1 |
|--------|--------|
| `run: agents/content-analyzer` | `skill: media-reviewer` + `mission:` |
| `run: agents/idea-generator` | `skill: idea-synthesis` + `mission:` |
| `run: agents/writing-kit-builder` | `skill: writing-kit-assembler` + `mission:` |
