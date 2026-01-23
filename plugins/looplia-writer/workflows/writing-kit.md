---
name: writing-kit
version: 1.1.0
description: Transform content into structured writing kit with summary, ideas, and outline

steps:
  - id: summary
    skill: media-reviewer
    mission: |
      Deep analysis of content to extract key themes, concepts, and narrative structure.
      Extract minimum 3 verbatim quotes with context, at least 5 key bullet points,
      and analyze the narrative flow. Identify related concepts for exploration.
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    validate:
      required_fields: [contentId, headline, tldr, bullets, tags, sentiment, category, overview, keyThemes, detailedAnalysis, narrativeFlow, coreIdeas, importantQuotes, context, relatedConcepts]
      min_quotes: 3
      min_key_points: 5

  - id: ideas
    skill: idea-synthesis
    mission: |
      Generate creative writing ideas, hooks, and angles based on the content summary.
      Create 5 types of hooks: emotional, curiosity, controversy, statistic, and story.
      Develop multiple narrative angles with relevance scores.
      Generate exploratory questions by type (analytical, practical, philosophical, comparative).
    needs: [summary]
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json
    validate:
      required_fields: [contentId, hooks, angles, questions]
      has_hooks: true

  - id: writing-kit
    skill: writing-kit-assembler
    mission: |
      Assemble final writing kit combining summary and ideas.
      Create structured outline with estimated word counts.
      Include meta information (difficulty, time to write, audience).
      Calculate relevance scores based on user profile.
    needs: [summary, ideas]
    input: ["${{ steps.summary.output }}", "${{ steps.ideas.output }}"]
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
│   media-reviewer    │  Step 1: Deep content analysis
│   (summary.json)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   idea-synthesis    │  Step 2: Generate creative hooks and angles
│   (ideas.json)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│ writing-kit-assembler   │  Step 3: Assemble final writing kit
│ (writing-kit.json)      │
└─────────────────────────┘
```

## Step Details

### Step 1: Summary (media-reviewer)

Deep analysis of content to extract:
- Key themes and concepts
- Minimum 3 verbatim quotes with context
- At least 5 key bullet points
- Narrative flow analysis
- Related concepts for exploration

### Step 2: Ideas (idea-synthesis)

Generate creative writing inspiration:
- 5 types of hooks: emotional, curiosity, controversy, statistic, story
- Multiple narrative angles with relevance scores
- Exploratory questions by type (analytical, practical, philosophical, comparative)

### Step 3: Writing Kit (writing-kit-assembler)

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

| Step | Skill | Required Fields | Additional Checks |
|------|-------|-----------------|-------------------|
| summary | media-reviewer | contentId, headline, tldr, bullets... | min_quotes: 3, min_key_points: 5 |
| ideas | idea-synthesis | contentId, hooks, angles, questions | has_hooks: true |
| writing-kit | writing-kit-assembler | contentId, source, summary, ideas... | min_outline_sections: 4 |

## Error Handling

If validation fails:
1. Review the failed checks in validation result
2. Retry the skill-executor with specific feedback
3. Report to user if retry also fails
