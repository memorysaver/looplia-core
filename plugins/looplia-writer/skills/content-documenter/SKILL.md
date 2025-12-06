---
name: content-documenter
description: Write comprehensive structured documentation from analyzed media content. Generates JSON fields with overview, themes, analysis, quotes, and context. Use after media-reviewer analysis.
---

# Content Documenter Skill

Expert at writing clear, structured documentation that preserves original meaning while providing comprehensive context.

## What This Skill Does

- Takes analyzed content and generates structured JSON fields
- Creates overview, keyThemes, detailedAnalysis, narrativeFlow
- Extracts coreIdeas with explanations and examples
- Preserves verbatim quotes with timestamps (for video/audio)
- Provides context and identifies related concepts

## Input

You receive:
- Content ID and metadata
- Content text
- Analysis from media-reviewer skill (your internal thinking)

## Output

Populate these ContentSummary fields:

1. **overview** (string): 2-3 paragraph rich summary introducing the material

2. **keyThemes** (string[]): 3-7 main topics/themes identified

3. **detailedAnalysis** (string): Documentary-style detailed breakdown of content following its structure

4. **narrativeFlow** (string): Explanation of how ideas build on each other and content progresses

5. **coreIdeas** (CoreIdea[]): Main concepts with:
   - concept: The concept name
   - explanation: Detailed explanation
   - examples: Optional examples from content

6. **importantQuotes** (Quote[]): 3-20 verbatim quotes with:
   - text: Exact quote
   - timestamp: Optional timestamp (HH:MM:SS or MM:SS)
   - context: Optional contextual information

7. **context** (string): Background information needed to understand the content

8. **relatedConcepts** (string[]): 0-15 related topics/concepts mentioned

## Writing Guidelines

- **overview**: Introduce the material clearly for someone unfamiliar
- **keyThemes**: Bullet list of main topics (3-7 items)
- **detailedAnalysis**: Follow the structure of original content, breaking into logical sections
- **narrativeFlow**: Explain progression and how ideas connect
- **coreIdeas**: Define key concepts with clear explanations
- **importantQuotes**: Extract verbatim quotes - DO NOT paraphrase
- **context**: Explain prerequisites or background knowledge
- **relatedConcepts**: Link to other topics mentioned or implied

## Timestamp Format

For video/audio content:
- `0:30` - 30 seconds
- `2:45` - 2 minutes 45 seconds
- `2:45:30` - 2 hours 45 minutes 30 seconds

## Important Rules

✅ Preserve every important detail from source
✅ Include timestamps when available
✅ Use exact quotes (no paraphrasing)
✅ Document what's actually there, not what should be there
✅ Provide sufficient detail for future reference
❌ Never add interpretation or analysis beyond source
❌ Never add opinions
❌ Never modify quotes
❌ Never omit important information
