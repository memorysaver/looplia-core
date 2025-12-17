---
name: writing-kit
description: Transform content into structured writing kit with summary and creative ideas

outputs:
  summary:
    artifact: summary.json
    agent: content-analyzer
    validate:
      required_fields: [contentId, headline, tldr, bullets, tags, sentiment, category, overview, keyThemes, detailedAnalysis, narrativeFlow, coreIdeas, importantQuotes, context, relatedConcepts]
      min_quotes: 3
      min_key_points: 5

  writing-kit:
    artifact: writing-kit.json
    agent: writing-kit-builder
    requires: [summary]
    final: true
    validate:
      required_fields: [contentId, source, summary, ideas, suggestedOutline, meta]
      min_outline_sections: 4
      has_hooks: true
---

# Writing Kit Workflow

Transform raw content into a comprehensive writing kit with summary, creative ideas, and suggested outlines.

## Purpose

This workflow processes content through two stages:
1. **Summary Stage**: Deep analysis of content to extract key themes, quotes, and insights
2. **Writing Kit Stage**: Generate creative hooks, angles, and structured outline for writing

## Content Analysis Guidelines

### Summary Requirements
- Extract minimum 3 verbatim quotes with context
- Identify 5-7 key themes from the content
- Generate at least 5 key bullet points
- Provide detailed narrative flow analysis
- Include related concepts for further exploration

### Writing Kit Requirements
- Generate 5 types of hooks: emotional, curiosity, controversy, statistic, story
- Provide multiple writing angles with relevance scores
- Create structured outline with estimated word counts per section
- Calculate relevance score based on user profile topics

## Quality Standards

1. **Accuracy**: Preserve original meaning without paraphrasing
2. **Completeness**: Cover all major themes and ideas
3. **Relevance**: Tailor output to user's interests and writing style
4. **Creativity**: Provide diverse hooks and angles for inspiration

## User Profile Integration

Read `user-profile.json` from workspace root to personalize:
- Calculate relevance scores based on user's topics of interest
- Adjust writing tone to match user's preferred style
- Target word count based on user's typical article length

## Output Validation

Each output is validated by the workflow-validator skill:
- Required fields must be present
- Minimum counts for quotes, key points, outline sections
- Hooks array must not be empty

## Error Handling

If validation fails:
1. Review the failed checks in validation result
2. Retry the subagent with specific feedback
3. Report to user if retry also fails

## Session Structure

```
contentItem/{id}/
  content.md          # Original content
  validation.json     # Generated validation checklist
  summary.json        # Stage 1 output
  writing-kit.json    # Stage 2 output (final)
```
