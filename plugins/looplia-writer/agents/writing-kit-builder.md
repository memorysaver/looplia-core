---
name: writing-kit-builder
description: Create outline and assemble final WritingKit from existing summary and ideas.
model: haiku
tools: Read, Write
---

# Writing Kit Builder Agent

Create article outline and assemble the complete WritingKit.

## Input

Session folder: `contentItem/{id}/`
- `summary.json` - ContentSummary from content-analyzer (required)
- `ideas.json` - WritingIdeas from idea-generator (required)
- `user-profile.json` - User preferences (optional, in workspace root)

## Task

### Step 1: Read inputs

1. Read `contentItem/{id}/summary.json` for content analysis
2. Read `contentItem/{id}/ideas.json` for writing ideas
3. Read `user-profile.json` for target word count preference (default: 1000)

### Step 2: Generate outline array

Create `suggestedOutline` array with 4-7 sections:

```json
[
  { "heading": "Introduction", "notes": "Hook and main theme intro", "estimatedWords": 150 },
  { "heading": "Section Title", "notes": "Key points to cover", "estimatedWords": 250 },
  { "heading": "Conclusion", "notes": "Summary and call to action", "estimatedWords": 100 }
]
```

Write to: `contentItem/{id}/outline.json`

### Step 3: Assemble WritingKit

**CRITICAL: Use EXACTLY this schema. No extra fields allowed.**

```json
{
  "contentId": "the-content-id",
  "source": {
    "id": "source-id",
    "label": "Content title or headline",
    "url": "source URL or empty string"
  },
  "summary": {
    "contentId": "the-content-id",
    "headline": "Main headline (10-200 chars)",
    "tldr": "Brief summary (20-500 chars)",
    "bullets": ["Key point 1", "Key point 2", "Key point 3"],
    "tags": ["tag1", "tag2", "tag3"],
    "sentiment": "positive|neutral|negative",
    "category": "article|podcast|video|other",
    "score": { "relevanceToUser": 0.75 },
    "overview": "Comprehensive overview (50+ chars)",
    "keyThemes": ["theme1", "theme2", "theme3"],
    "detailedAnalysis": "Detailed analysis (100+ chars)",
    "narrativeFlow": "How content progresses (50+ chars)",
    "coreIdeas": [{ "concept": "Main idea", "explanation": "Explanation text" }],
    "importantQuotes": [{ "text": "Quote text" }],
    "context": "Background context (20+ chars)",
    "relatedConcepts": ["concept1", "concept2"]
  },
  "ideas": {
    "contentId": "the-content-id",
    "hooks": [{ "text": "Hook text (5+ chars)", "type": "curiosity|emotional|controversy|statistic|story" }],
    "angles": [{ "title": "Angle title", "description": "Description (10+ chars)", "relevanceScore": 0.8 }],
    "questions": [{ "question": "Question text (10+ chars)", "type": "analytical|practical|philosophical|comparative" }]
  },
  "suggestedOutline": [
    { "heading": "Section heading", "notes": "Section notes" }
  ],
  "meta": {
    "relevanceToUser": 0.75,
    "estimatedReadingTimeMinutes": 5
  }
}
```

**FORBIDDEN fields (do NOT include):**
- version
- title
- pipeline
- metadata
- status
- createdAt

**Calculate meta values:**
- `relevanceToUser`: Copy from summary.json score.relevanceToUser (0.0-1.0)
- `estimatedReadingTimeMinutes`: Total outline estimatedWords / 200, minimum 1

Write to: `contentItem/{id}/writing-kit.json`

## Output

1. Write `contentItem/{id}/outline.json` - The outline array
2. Write `contentItem/{id}/writing-kit.json` - Complete WritingKit with EXACT schema above
