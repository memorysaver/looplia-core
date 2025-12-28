---
title: Understanding Workflows
description: Learn the skills-first workflow architecture and schema.
---

import { Aside, Card, CardGrid } from '@astrojs/starlight/components';

Workflows are the heart of Looplia. They define how AI skills are composed to transform content. This page covers the workflow schema in detail.

## Workflow Structure

A workflow is a Markdown file with YAML frontmatter:

```yaml
---
name: writing-kit
version: 1.1.0
description: Transform content into structured writing kit

steps:
  - id: summary
    skill: media-reviewer
    mission: Analyze content for themes and structure
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json

  - id: ideas
    skill: idea-synthesis
    mission: Generate creative hooks and angles
    needs: [summary]
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json

  - id: writing-kit
    skill: writing-kit-assembler
    mission: Assemble final writing kit
    needs: [summary, ideas]
    input:
      - ${{ steps.summary.output }}
      - ${{ steps.ideas.output }}
    output: ${{ sandbox }}/outputs/writing-kit.json
    final: true
---

# Writing Kit Workflow

Documentation about this workflow goes here...
```

## Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Unique workflow identifier |
| `version` | string | No | Semantic version (e.g., `1.0.0`) |
| `description` | string | No | Human-readable description |

## Step Schema

Each step in the `steps` array has the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique step identifier |
| `skill` | string | **Yes** | Skill to execute |
| `mission` | string | **Yes** | Natural language task description |
| `input` | string/array | Conditional | Input file path(s) |
| `output` | string | **Yes** | Output file path |
| `needs` | array | No | Step dependencies |
| `model` | string | No | Model override (`haiku`, `sonnet`, `opus`) |
| `validate` | object | No | Validation criteria |
| `final` | boolean | No | Mark as final output |

### Step ID

The `id` uniquely identifies a step within the workflow. Use descriptive, kebab-case names:

```yaml
- id: content-analysis    # Good
- id: step1               # Avoid - not descriptive
```

### Skill

The `skill` field references a skill from installed plugins:

```yaml
skill: media-reviewer     # From looplia-writer plugin
skill: idea-synthesis     # From looplia-writer plugin
```

<Aside>
Use `looplia build` to discover available skills interactively.
</Aside>

### Mission

The `mission` field is the natural language instruction for Claude. Be specific about requirements:

```yaml
mission: |
  Analyze the content to extract:
  - Key themes and concepts (minimum 3)
  - Verbatim quotes that capture the essence (minimum 3)
  - Structural breakdown of the content
  - Target audience inference

  Focus on actionable insights for content creators.
```

**Tips for good missions:**
- Be specific about quantities ("minimum 3 quotes")
- Describe the desired output format
- Include context ("for content creators")
- Use multi-line YAML (`|`) for complex missions

### Input and Output

Specify file paths using variable substitution:

```yaml
input: ${{ sandbox }}/inputs/content.md
output: ${{ sandbox }}/outputs/summary.json
```

For multiple inputs:

```yaml
input:
  - ${{ steps.summary.output }}
  - ${{ steps.ideas.output }}
```

### Dependencies (needs)

The `needs` field declares dependencies on other steps:

```yaml
- id: ideas
  skill: idea-synthesis
  needs: [summary]           # Waits for 'summary' to complete
  input: ${{ steps.summary.output }}
```

Steps without `needs` run first. Steps with `needs` wait for all dependencies.

### Model Override

Override the default model for specific steps:

```yaml
- id: complex-analysis
  skill: media-reviewer
  model: opus              # Use Claude Opus for this step
  mission: Perform deep semantic analysis
```

| Value | Model |
|-------|-------|
| `haiku` | claude-haiku-4-* (fast, cheap) |
| `sonnet` | claude-sonnet-4-* (balanced) |
| `opus` | claude-opus-4-* (most capable) |

### Validation

Define validation criteria for step outputs:

```yaml
- id: summary
  skill: media-reviewer
  validate:
    required_fields: [contentId, headline, keyThemes, tldr]
    min_quotes: 3
    min_key_points: 5
```

If validation fails, the step is marked incomplete and can be retried.

### Final Step

Mark the last step with `final: true`:

```yaml
- id: writing-kit
  skill: writing-kit-assembler
  final: true              # This is the workflow's final output
```

---

## Variable Substitution

Looplia uses `${{ }}` syntax for dynamic values:

| Variable | Description |
|----------|-------------|
| `${{ sandbox }}` | Current sandbox path |
| `${{ steps.<id>.output }}` | Output path from a previous step |

### Examples

```yaml
# Reference sandbox directory
input: ${{ sandbox }}/inputs/content.md

# Reference another step's output
input: ${{ steps.summary.output }}

# Multiple inputs from different steps
input:
  - ${{ steps.summary.output }}
  - ${{ steps.ideas.output }}
```

---

## Execution Flow

1. **Load Workflow** — Parse YAML frontmatter from workflow file
2. **Resolve Dependencies** — Build execution graph from `needs`
3. **Execute Steps** — Run each step through skill-executor
4. **Validate Outputs** — Check against `validate` criteria
5. **Track State** — Update `validation.json` after each step

```
Step 1: summary           Step 2: ideas           Step 3: writing-kit
     │                         │                         │
     ▼                         ▼                         ▼
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│ skill:      │          │ skill:      │          │ skill:      │
│ media-      │────▶     │ idea-       │────▶     │ writing-kit │
│ reviewer    │          │ synthesis   │          │ -assembler  │
└─────────────┘          └─────────────┘          └─────────────┘
     │                         │                         │
     ▼                         ▼                         ▼
summary.json              ideas.json            writing-kit.json
```

---

## Best Practices

<CardGrid>
  <Card title="Clear Step IDs" icon="pencil">
    Use descriptive IDs like `content-analysis` instead of `step1`.
  </Card>
  <Card title="Specific Missions" icon="magnifier">
    Include quantities and format requirements in missions.
  </Card>
  <Card title="Proper Dependencies" icon="seti:todo">
    Always declare `needs` when a step uses another step's output.
  </Card>
  <Card title="Validate Outputs" icon="approve-check">
    Use `validate` to ensure quality before proceeding.
  </Card>
</CardGrid>

---

## See Also

- [Writing Kit](/workflows/writing-kit/) — Example workflow walkthrough
- [Building Custom Workflows](/workflows/custom-workflows/) — Create your own
- [build Command](/cli/build/) — AI-assisted workflow creation
