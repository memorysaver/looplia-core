---
name: writing-kit-builder
description: Create outline and assemble final WritingKit from existing summary and ideas.
model: haiku
tools: Read, Write
---

# Writing Kit Builder Agent

Create article outline and assemble the complete WritingKit.

**Note:** This agent assumes `summary.json` and `ideas.json` already exist in the session folder (created by content-analyzer and idea-generator subagents).

## Input

Session folder: `contentItem/{id}/`
- `summary.json` - ContentSummary from content-analyzer (required)
- `ideas.json` - WritingIdeas from idea-generator (required)
- `user-profile.json` - User preferences (optional, in workspace root)

## Task

### Step 1: Read inputs

1. Read `contentItem/{id}/summary.json` for content analysis
2. Read `contentItem/{id}/ideas.json` for writing ideas
3. Read `user-profile.json` for target word count preference

### Step 2: Generate article outline

Create a structured outline based on:
- Content themes and narrative flow from summary
- Best angles and hooks from ideas
- User's target word count

Outline structure:
```json
[
  {
    "heading": "Introduction",
    "notes": "Hook with [best hook]. Introduce [main theme].",
    "estimatedWords": 150
  },
  {
    "heading": "Section 1: [Key Theme]",
    "notes": "Explore [core idea]. Use [quote] for impact.",
    "estimatedWords": 300
  },
  ...
]
```

Word count distribution:
- Introduction: ~15% of target
- Background/Context: ~20% of target
- Main sections: ~35% of target
- Implications/Applications: ~20% of target
- Conclusion: ~10% of target

Write outline to: `contentItem/{id}/outline.json`

### Step 3: Assemble WritingKit

Combine all components into final WritingKit:

```json
{
  "contentId": "{id}",
  "source": {
    "id": "{source.id}",
    "label": "{summary.headline}",
    "url": ""
  },
  "summary": { /* from summary.json */ },
  "ideas": { /* from ideas.json */ },
  "suggestedOutline": [ /* from Step 2 */ ],
  "meta": {
    "relevanceToUser": 0.0-1.0,
    "estimatedReadingTimeMinutes": wordCount / 200
  }
}
```

Calculate metadata:
- `relevanceToUser`: Use score from summary.json
- `estimatedReadingTimeMinutes`: Total outline words / 200

Write to: `contentItem/{id}/writing-kit.json`

## Output

Two files written:
1. `contentItem/{id}/outline.json` - Article outline
2. `contentItem/{id}/writing-kit.json` - Complete WritingKit

Return the complete WritingKit JSON.
