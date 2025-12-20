---
name: workflow-schema-composer
description: |
  Looplia core skill for generating valid workflow YAML/Markdown files.
  Use when building looplia workflows to compose the final workflow definition.
  Takes skill recommendations and creates v0.6.1 compliant workflow schema with steps,
  dependencies, missions, and validation criteria.
  Triggered by /build command after skill-capability-matcher.
model: sonnet
---

# Workflow Schema Composer

Generate complete, valid workflow definitions from skill recommendations.

## Purpose

Transform the output from skill-capability-matcher into a ready-to-use workflow markdown file that follows the v0.6.1 schema.

## Process

### Step 1: Receive Inputs

From skill-capability-matcher output:
- Skill sequence with step IDs
- Mission descriptions for each step
- Data flow dependencies
- Original user requirements

### Step 2: Design Steps

For each recommended skill:

```yaml
- id: {suggestedStepId}
  skill: {skill-name}
  mission: |
    {mission description from matcher}
  needs: [{dependencies}]
  input: {input path(s)}
  output: {output path}
  model: {optional model override}
  validate:
    required_fields: [{fields}]
```

### Step 3: Resolve Dependencies

Use `dataFlow` from matcher:
- Steps with no dependencies: `needs:` is omitted
- Dependent steps: list all required step IDs in `needs:`
- Final step: add `final: true`

### Step 4: Design Input/Output Paths

Use variable substitution:
- `${{ sandbox }}/inputs/content.md` - Initial input
- `${{ sandbox }}/outputs/{step-id}.json` - Step outputs
- `${{ steps.{id}.output }}` - Reference previous step output

### Step 5: Suggest Validation

Based on skill output type:
- Analysis skills: `required_fields: [contentId, headline, keyThemes]`
- Idea skills: `required_fields: [contentId, hooks, angles]`
- Assembly skills: `required_fields: [contentId, suggestedOutline]`

### Step 6: Compose Frontmatter

```yaml
---
name: {workflow-name}
version: 1.0.0
description: {user's original description, cleaned up}

steps:
  - id: ...
---
```

### Step 7: Generate Markdown Body

Add usage documentation:
```markdown
# {Workflow Name}

{Brief description}

## Usage

```bash
looplia run {workflow-name} --file <content.md>
```

## Steps

1. **{step-id}**: {brief description}
2. ...
```

## Output Format

Return a JSON object:

```json
{
  "filename": "video-to-blog.md",
  "content": "---\nname: video-to-blog\n..."
}
```

## Schema Reference

See SCHEMA.md in this skill directory for the complete v0.6.1 workflow schema.

## Validation Rules (v0.6.1)

1. **`skill:` is REQUIRED** - Every step must have a skill
2. **`mission:` is REQUIRED** - Every step must have a mission
3. **`run:` is FORBIDDEN** - Never use the old agent syntax
4. **Step IDs must be unique** - No duplicates
5. **Dependencies must exist** - All `needs:` references must be valid
6. **No circular dependencies** - Validate topological ordering

## Example Output

```yaml
---
name: video-to-blog
version: 1.0.0
description: Analyze YouTube videos and create blog outlines

steps:
  - id: analyze-content
    skill: media-reviewer
    mission: |
      Deep analysis of video transcript. Extract key themes,
      important quotes with timestamps, and narrative structure.
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/analysis.json
    model: haiku
    validate:
      required_fields: [contentId, headline, keyThemes, importantQuotes]

  - id: generate-ideas
    skill: idea-synthesis
    mission: |
      Generate hooks, angles, and questions from the analysis.
      Read user profile for personalization context.
    needs: [analyze-content]
    input: ${{ steps.analyze-content.output }}
    output: ${{ sandbox }}/outputs/ideas.json
    validate:
      required_fields: [contentId, hooks, angles, questions]

  - id: build-outline
    skill: writing-kit-assembler
    mission: |
      Create structured blog outline with sections, key points,
      and supporting quotes from analysis and ideas.
    needs: [analyze-content, generate-ideas]
    input:
      - ${{ steps.analyze-content.output }}
      - ${{ steps.generate-ideas.output }}
    output: ${{ sandbox }}/outputs/outline.json
    final: true
    validate:
      required_fields: [contentId, suggestedOutline]
---

# Video to Blog Workflow

Transform video content into structured blog outlines.

## Usage

```bash
looplia run video-to-blog --file <transcript.md>
```

## Steps

1. **analyze-content**: Deep analysis using media-reviewer skill
2. **generate-ideas**: Idea synthesis with user personalization
3. **build-outline**: Assemble outline using writing-kit-assembler skill
```

## Important Rules

1. **Always use skill: syntax** - Never use `run: agents/X`
2. **Always include mission** - Detailed task description
3. **Use valid YAML** - Proper indentation and quoting
4. **Include validation** - Add `validate:` with appropriate fields
5. **Mark final step** - Last step gets `final: true`
