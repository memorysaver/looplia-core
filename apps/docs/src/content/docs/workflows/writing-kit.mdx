---
title: Writing Kit Workflow
description: Transform content into a structured writing kit with themes, ideas, and outlines.
---

import { Aside, Steps } from '@astrojs/starlight/components';

The **writing-kit** workflow is Looplia's flagship workflow. It transforms any content into a comprehensive writing kit that helps content creators develop articles, blog posts, or newsletters.

## What It Produces

The writing-kit workflow generates three artifacts:

| Output | Description |
|--------|-------------|
| `summary.json` | Deep content analysis with themes, quotes, and structure |
| `ideas.json` | Creative hooks, angles, questions, and writing prompts |
| `writing-kit.json` | Combined output with structured outline |

## Running the Workflow

```bash
# Basic usage
looplia run writing-kit --file my-content.md

# Resume interrupted run
looplia run writing-kit --sandbox-id my-content-2025-12-28-x7km
```

## Workflow Definition

```yaml
---
name: writing-kit
version: 1.1.0
description: Transform content into structured writing kit

steps:
  - id: summary
    skill: media-reviewer
    mission: |
      Deep analysis of content to extract key themes, concepts.
      Extract minimum 3 verbatim quotes, at least 5 key points.
      Identify structure, tone, and target audience.
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    validate:
      required_fields: [contentId, headline, keyThemes, tldr]
      min_quotes: 3

  - id: ideas
    skill: idea-synthesis
    mission: |
      Generate creative writing ideas based on the content analysis.
      Include hooks, angles, questions, and content prompts.
      Consider multiple perspectives and formats.
    needs: [summary]
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json

  - id: writing-kit
    skill: writing-kit-assembler
    mission: |
      Assemble a comprehensive writing kit combining summary and ideas.
      Create a structured outline with sections and talking points.
      Include call-to-action suggestions.
    needs: [summary, ideas]
    input:
      - ${{ steps.summary.output }}
      - ${{ steps.ideas.output }}
    output: ${{ sandbox }}/outputs/writing-kit.json
    final: true
---
```

## Step-by-Step Breakdown

<Steps>

1. **Content Analysis (media-reviewer)**

   The first step uses the `media-reviewer` skill to deeply analyze your content:

   - Extracts key themes and concepts
   - Identifies verbatim quotes (minimum 3)
   - Captures key points (minimum 5)
   - Infers structure and target audience

   **Output:** `summary.json`

   ```json
   {
     "contentId": "ai-healthcare-2025-12-28",
     "headline": "AI Revolution in Healthcare Diagnostics",
     "tldr": "AI is enabling earlier disease detection...",
     "keyThemes": ["predictive diagnostics", "personalized medicine"],
     "quotes": [
       {
         "text": "We're seeing a fundamental shift...",
         "speaker": "Dr. Sarah Chen",
         "context": "On AI adoption in hospitals"
       }
     ],
     "keyPoints": [
       "94% accuracy in cancer detection from imaging",
       "Drug discovery acceleration through simulation"
     ],
     "structure": {
       "format": "article",
       "sections": ["introduction", "developments", "quotes", "conclusion"]
     }
   }
   ```

2. **Idea Generation (idea-synthesis)**

   The second step uses `idea-synthesis` to generate creative content ideas:

   - Compelling hooks to grab attention
   - Unique angles for the topic
   - Questions to explore
   - Content prompts for different formats

   **Output:** `ideas.json`

   ```json
   {
     "hooks": [
       "What if your doctor could predict disease before symptoms appear?",
       "The algorithm that sees what radiologists miss"
     ],
     "angles": [
       "Patient perspective: Living with AI-assisted diagnosis",
       "Ethics: When algorithms make life-or-death decisions"
     ],
     "questions": [
       "How do patients feel about AI making diagnoses?",
       "What happens when the AI is wrong?"
     ],
     "prompts": [
       "Write a day-in-the-life of an AI-assisted oncologist",
       "Compare: Traditional vs AI diagnosis workflows"
     ]
   }
   ```

3. **Kit Assembly (writing-kit-assembler)**

   The final step combines everything into a structured writing kit:

   - Unified summary with all key information
   - Selected hooks and angles
   - Structured outline with sections
   - Call-to-action suggestions

   **Output:** `writing-kit.json`

   ```json
   {
     "title": "AI Healthcare Revolution: A Writer's Kit",
     "summary": {
       "headline": "...",
       "keyThemes": [...],
       "quotes": [...]
     },
     "selectedHooks": [...],
     "selectedAngles": [...],
     "outline": {
       "sections": [
         {
           "title": "The Diagnostic Revolution",
           "points": ["94% accuracy claim", "Dr. Chen quote"],
           "suggestedLength": "300 words"
         },
         {
           "title": "From Lab to Bedside",
           "points": ["Real-world implementations", "Patient outcomes"],
           "suggestedLength": "400 words"
         }
       ]
     },
     "callToAction": [
       "Learn more about AI in healthcare at...",
       "Share your experience with AI diagnosis in the comments"
     ]
   }
   ```

</Steps>

## Customizing the Workflow

You can modify the writing-kit workflow for your needs:

### Shorter Analysis

Edit `~/.looplia/workflows/writing-kit.md`:

```yaml
- id: summary
  skill: media-reviewer
  mission: |
    Quick analysis of content.
    Extract 2-3 key themes and 3 key points.
    Focus on actionable insights only.
```

### Different Output Focus

```yaml
- id: writing-kit
  skill: writing-kit-assembler
  mission: |
    Create a Twitter thread outline (10-15 tweets).
    Focus on controversial angles and quotable moments.
```

### Add a Step

```yaml
- id: fact-check
  skill: content-verifier
  mission: Verify claims and statistics in the content
  needs: [summary]
  input: ${{ steps.summary.output }}
  output: ${{ sandbox }}/outputs/fact-check.json

- id: ideas
  needs: [summary, fact-check]  # Now depends on fact-check too
```

## Input Requirements

The writing-kit workflow works best with:

- **Articles** (500-5000 words)
- **Blog posts**
- **Video/podcast transcripts**
- **Research summaries**
- **News articles**

<Aside type="tip">
For best results, provide content with clear structure and at least a few quotable statements.
</Aside>

## See Also

- [Understanding Workflows](/workflows/understanding-workflows/) — Schema reference
- [Building Custom Workflows](/workflows/custom-workflows/) — Create your own
- [run Command](/cli/run/) — Execution options
