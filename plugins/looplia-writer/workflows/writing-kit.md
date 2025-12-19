---
name: writing-kit
version: 1.0.0
description: Transform content into structured writing kit with summary, ideas, and outline

steps:
  - id: summary
    run: agents/content-analyzer
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    validate:
      required_fields: [contentId, headline, tldr, bullets, tags, sentiment, category, overview, keyThemes, detailedAnalysis, narrativeFlow, coreIdeas, importantQuotes, context, relatedConcepts]
      min_quotes: 3
      min_key_points: 5

  - id: ideas
    run: agents/idea-generator
    needs: [summary]
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json
    validate:
      required_fields: [contentId, hooks, angles, questions]
      has_hooks: true

  - id: writing-kit
    run: agents/writing-kit-builder
    needs: [summary, ideas]
    input:
      - ${{ steps.summary.output }}
      - ${{ steps.ideas.output }}
    output: ${{ sandbox }}/outputs/writing-kit.json
    final: true
    validate:
      required_fields: [contentId, source, summary, ideas, suggestedOutline, meta]
      min_outline_sections: 4
      has_hooks: true
---

# Writing Kit Workflow

Transform raw content into a comprehensive writing kit with summary, creative ideas, and suggested outlines.

## Pipeline Overview

```
content.md
    │
    ▼
┌─────────────────────┐
│  content-analyzer   │  Step 1: Deep content analysis
│  (summary.json)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   idea-generator    │  Step 2: Generate creative hooks and angles
│   (ideas.json)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ writing-kit-builder │  Step 3: Assemble final writing kit
│ (writing-kit.json)  │
└─────────────────────┘
```

## Step Details

### Step 1: Summary (content-analyzer)

Deep analysis of content to extract:
- Key themes and concepts
- Minimum 3 verbatim quotes with context
- At least 5 key bullet points
- Narrative flow analysis
- Related concepts for exploration

### Step 2: Ideas (idea-generator)

Generate creative writing inspiration:
- 5 types of hooks: emotional, curiosity, controversy, statistic, story
- Multiple narrative angles with relevance scores
- Exploratory questions by type (analytical, practical, philosophical, comparative)

### Step 3: Writing Kit (writing-kit-builder)

Assemble final kit with:
- Structured outline with estimated word counts
- All components from previous steps
- Meta information (difficulty, time to write, audience)
- Relevance scores based on user profile

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

## Validation Criteria

| Step | Required Fields | Additional Checks |
|------|-----------------|-------------------|
| summary | contentId, headline, tldr, bullets... | min_quotes: 3, min_key_points: 5 |
| ideas | contentId, hooks, angles, questions | has_hooks: true |
| writing-kit | contentId, source, summary, ideas... | min_outline_sections: 4 |

## Error Handling

If validation fails:
1. Review the failed checks in validation result
2. Retry the subagent with specific feedback
3. Report to user if retry also fails
