# Looplia Core – Technical Design Document v0.3.1

**Version:** 0.3.1
**Status:** Draft
**Last Updated:** 2025-12-08

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Architecture Comparison](#3-architecture-comparison)
4. [True Agentic Design](#4-true-agentic-design)
5. [Plugin File Specifications](#5-plugin-file-specifications)
6. [Query Flow](#6-query-flow)
7. [Implementation Plan](#7-implementation-plan)
8. [Migration from v0.3](#8-migration-from-v03)
9. [Testing Strategy](#9-testing-strategy)
10. [Benefits](#10-benefits)

---

## 1. Overview

### 1.1 Purpose

v0.3.1 completes the transition to a **true agentic architecture** that was intended but not fully implemented in v0.3. The key insight is that v0.3's implementation remained workflow-based despite having plugin infrastructure in place.

### 1.2 Key Changes from v0.3

| Aspect | v0.3 (Implemented) | v0.3.1 (Target) |
|--------|-------------------|-----------------|
| **Query Prompts** | Hardcoded 50+ line prompts in TypeScript | Minimal 5-word prompts |
| **Logic Location** | In provider `.ts` files | In plugin files (CLAUDE.md + skills) |
| **SDK Calls per Command** | 3 separate calls (summarize, ideas, outline) | 1 single call |
| **Context Sharing** | Lost between calls | Shared in single session |
| **Skill Usage** | Skills exist but never invoked | Agent uses skills autonomously |
| **Plugin Files** | Created but unused | Active runtime components |

### 1.3 Goals

- Complete the agentic vision outlined in DESIGN-0.3.md
- Move all prompt logic from TypeScript into plugin files
- Reduce SDK calls from 3 to 1 for better context sharing
- Capture full analysis depth from legacy writing-agent skills
- Enable plugin-based customization without code changes

### 1.4 Non-Goals

- New features beyond architectural cleanup
- Changes to domain types or schemas (already complete in v0.3)
- New CLI commands
- Multi-model support

---

## 2. Problem Statement

### 2.1 Current Implementation Analysis

The v0.3 codebase has a fundamental disconnect between design and implementation:

**What DESIGN-0.3.md describes:**
```
CLI
 └─► Invoke Agent SDK (cwd: ~/.looplia/)
      └─► CLAUDE.md (main mission)
           └─► Subagents orchestrate workflow
                ├─► content-analyzer (media-reviewer)
                ├─► idea-generator
                └─► writing-kit-builder
                     └─► Skills process content
```

**What the code actually does:**
```
CLI
 └─► TypeScript Provider Code
      ├─► SDK Call 1: buildSummarizePrompt() → hardcoded 76-line prompt
      ├─► SDK Call 2: buildIdeasPrompt() → hardcoded prompt
      └─► SDK Call 3: buildOutlinePrompt() → hardcoded prompt
```

### 2.2 Evidence from Codebase

**packages/provider/src/claude-agent-sdk/prompts/summarize.ts:31-76**
```typescript
export function buildSummarizePrompt(
  content: ContentItem,
  user?: UserProfile
): string {
  // ... 45 lines of hardcoded prompt logic ...
  return `Analyze and summarize the following content:
    Title: ${content.title}
    // ... extensive instructions ...
    Provide a comprehensive summary with:
    1. A compelling headline (10-200 chars)
    2. A concise TL;DR (3-5 sentences, 20-500 chars)
    // ... 7 more fields ...
  `;
}
```

**Key observations:**
1. `CLAUDE.md` exists in plugins but is never read by the SDK call
2. Skills (`media-reviewer`, `content-documenter`) exist but are never invoked
3. Each SDK call is independent (no shared context)
4. Only 7 of 15 ContentSummary fields are requested in the prompt

### 2.3 Gap Analysis: Old Writing-Agent vs Current

The legacy writing-agent (`docs/writing-agent-example/`) used a sophisticated 2-skill workflow:

| Old Writing-Agent Process | Current Summarize Prompt | Gap |
|--------------------------|-------------------------|-----|
| **media-reviewer skill** | | |
| Read ALL source materials | Truncated to 5000 chars | Limited |
| Track narrative progression | Not requested | Missing |
| Extract quotes + timestamps | Not requested | Missing |
| Understand author's intent | Not in prompt | Missing |
| Documentary angle analysis | Not in prompt | Missing |
| **content-documenter skill** | | |
| overview (2-3 paragraphs) | Not requested | Missing |
| keyThemes (3-7 items) | Not requested | Missing |
| detailedAnalysis | Not requested | Missing |
| narrativeFlow | Not requested | Missing |
| coreIdeas + explanations | Not requested | Missing |
| importantQuotes + timestamps | Not requested | Missing |
| context (background) | Not requested | Missing |
| relatedConcepts | Not requested | Missing |

**Result:** Current implementation produces ~30% of the output richness possible.

---

## 3. Architecture Comparison

### 3.1 v0.3 Architecture (Workflow-Based)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         v0.3 CURRENT (WORKFLOW-BASED)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLI: looplia kit --file article.txt                                         │
│   │                                                                          │
│   └─► buildWritingKit(content, user, providers)                              │
│         │                                                                    │
│         ├─► [SDK CALL 1] ─────────────────────────────────────────────────┐  │
│         │   │                                                              │  │
│         │   │  prompt = buildSummarizePrompt(content, user)                │  │
│         │   │           └─► 76 lines of hardcoded TypeScript               │  │
│         │   │                                                              │  │
│         │   │  query({ prompt, options: { cwd, model, schema } })          │  │
│         │   │           └─► SDK session 1 (isolated)                       │  │
│         │   │                                                              │  │
│         │   └─► Returns: ContentSummary (7 fields only)                    │  │
│         │                                                              ────┘  │
│         │                                                                    │
│         ├─► [SDK CALL 2] ─────────────────────────────────────────────────┐  │
│         │   │                                                              │  │
│         │   │  prompt = buildIdeasPrompt(summary, user)                    │  │
│         │   │           └─► Hardcoded TypeScript                           │  │
│         │   │                                                              │  │
│         │   │  query({ prompt, options: { ... } })                         │  │
│         │   │           └─► SDK session 2 (isolated, no context from #1)   │  │
│         │   │                                                              │  │
│         │   └─► Returns: WritingIdeas                                      │  │
│         │                                                              ────┘  │
│         │                                                                    │
│         └─► [SDK CALL 3] ─────────────────────────────────────────────────┐  │
│             │                                                              │  │
│             │  prompt = buildOutlinePrompt(summary, ideas, user)           │  │
│             │           └─► Hardcoded TypeScript                           │  │
│             │                                                              │  │
│             │  query({ prompt, options: { ... } })                         │  │
│             │           └─► SDK session 3 (isolated)                       │  │
│             │                                                              │  │
│             └─► Returns: OutlineSection[]                                  │  │
│                                                                        ────┘  │
│                                                                              │
│   PROBLEMS:                                                                  │
│   ✗ 3 separate SDK sessions = no shared context                             │
│   ✗ Plugin files (CLAUDE.md, skills) never used                             │
│   ✗ All logic hardcoded in TypeScript                                       │
│   ✗ Only 7 of 15 ContentSummary fields requested                            │
│   ✗ No deep analysis (media-reviewer logic missing)                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 v0.3.1 Architecture (True Agentic)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         v0.3.1 TARGET (TRUE AGENTIC)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLI: looplia kit --file article.txt                                         │
│   │                                                                          │
│   ├─► writeContentItem(content, workspace)                                   │
│   │     └─► Creates: ~/.looplia/contentItem/{id}.md                          │
│   │                                                                          │
│   └─► [SINGLE SDK CALL] ────────────────────────────────────────────────────┐│
│       │                                                                      ││
│       │  prompt = "Build writing kit for: contentItem/{id}.md"               ││
│       │            └─► MINIMAL: 8 words only                                 ││
│       │                                                                      ││
│       │  query({                                                             ││
│       │    prompt,                                                           ││
│       │    options: {                                                        ││
│       │      cwd: "~/.looplia/",        ← Workspace directory                ││
│       │      allowedTools: ["Read", "Skill"],                                ││
│       │      outputFormat: { type: "json_schema", schema }                   ││
│       │    }                                                                 ││
│       │  })                                                                  ││
│       │                                                                      ││
│       │  ┌─────────────────────────────────────────────────────────────┐    ││
│       │  │              INSIDE SDK SESSION                              │    ││
│       │  ├─────────────────────────────────────────────────────────────┤    ││
│       │  │                                                              │    ││
│       │  │  1. Agent reads ~/.looplia/CLAUDE.md (mission file)          │    ││
│       │  │     └─► Understands: "I need to build a writing kit"         │    ││
│       │  │                                                              │    ││
│       │  │  2. Agent reads contentItem/{id}.md                          │    ││
│       │  │     └─► Gets: title, source, raw content                     │    ││
│       │  │                                                              │    ││
│       │  │  3. Agent reads user-profile.json                            │    ││
│       │  │     └─► Gets: topics, tone, word count preferences           │    ││
│       │  │                                                              │    ││
│       │  │  4. Agent uses media-reviewer SKILL                          │    ││
│       │  │     └─► Deep analysis (9 steps)                              │    ││
│       │  │     └─► Output: implicit (in agent's thinking)               │    ││
│       │  │                                                              │    ││
│       │  │  5. Agent uses content-documenter SKILL                      │    ││
│       │  │     └─► Produces all 15 ContentSummary fields                │    ││
│       │  │     └─► Uses analysis from step 4                            │    ││
│       │  │                                                              │    ││
│       │  │  6. Agent generates ideas (hooks, angles, questions)         │    ││
│       │  │     └─► Context preserved from analysis                      │    ││
│       │  │                                                              │    ││
│       │  │  7. Agent creates outline                                    │    ││
│       │  │     └─► Uses summary + ideas context                         │    ││
│       │  │                                                              │    ││
│       │  │  8. Agent returns WritingKit JSON                            │    ││
│       │  │                                                              │    ││
│       │  └─────────────────────────────────────────────────────────────┘    ││
│       │                                                                      ││
│       └─► Returns: WritingKit (complete, with all 15 summary fields)         ││
│                                                                          ────┘│
│                                                                              │
│   BENEFITS:                                                                  │
│   ✓ Single session = shared context throughout                              │
│   ✓ Plugin files actively used (CLAUDE.md, skills)                          │
│   ✓ Logic in plugins = easy to modify without code                          │
│   ✓ All 15 ContentSummary fields populated                                  │
│   ✓ Full analysis depth from media-reviewer                                 │
│   ✓ Fewer API calls = cost savings                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Call Stack Comparison

**v0.3 (Current):**
```
looplia summarize --file article.txt
 └─► runSummarizeCommand()
      └─► createClaudeSummarizer()
           └─► summarize()
                └─► executeQueryWithRetry()
                     └─► executeQuery()
                          │
                          │  prompt = buildSummarizePrompt(content, user)
                          │           ├─► 76 lines of hardcoded logic
                          │           └─► Returns long prompt string
                          │
                          └─► query({ prompt, ... })
                               └─► SDK processes prompt directly
                                    └─► Returns ContentSummary (7 fields)
```

**v0.3.1 (Target):**
```
looplia summarize --file article.txt
 └─► runSummarizeCommand()
      └─► writeContentItem(content, workspace)
      └─► query({
            prompt: "Summarize content: contentItem/{id}.md",
            options: { cwd: "~/.looplia/", ... }
          })
           │
           └─► SDK SESSION (cwd = ~/.looplia/)
                │
                ├─► Reads CLAUDE.md
                │    └─► "When asked to summarize: use media-reviewer,
                │         then content-documenter"
                │
                ├─► Reads contentItem/{id}.md
                │
                ├─► Uses media-reviewer skill
                │    └─► 9-step deep analysis
                │
                ├─► Uses content-documenter skill
                │    └─► Produces all 15 fields
                │
                └─► Returns ContentSummary (15 fields)
```

---

## 4. True Agentic Design

### 4.1 Design Principles

1. **Minimal Query Prompts**: The TypeScript code sends only what to do, not how
2. **CLAUDE.md as Brain**: All workflow logic lives in the plugin mission file
3. **Skills as Capabilities**: Agent invokes skills based on task requirements
4. **Single Session**: One SDK call maintains context throughout
5. **Plugin-First**: Modifications happen in markdown, not TypeScript

### 4.2 Query Prompt Design

**Principle:** Prompts should be task identifiers, not instructions.

| Command | v0.3 Prompt | v0.3.1 Prompt |
|---------|-------------|---------------|
| summarize | 76 lines | `Summarize content: contentItem/{id}.md` |
| kit | 3 × ~50 lines | `Build writing kit for: contentItem/{id}.md` |

**Why minimal prompts work:**
- Agent reads CLAUDE.md which contains full instructions
- Agent has access to skills with detailed processes
- Agent can read input files and user profile
- JSON schema enforces output structure

### 4.3 Skill Invocation Flow

```
Agent receives: "Summarize content: contentItem/abc123.md"
        │
        ▼
Agent reads CLAUDE.md:
  "When asked to summarize:
   1. Read the content file
   2. Use media-reviewer skill
   3. Use content-documenter skill
   4. Return JSON matching schema"
        │
        ▼
Agent uses media-reviewer skill:
  - Reads SKILL.md for instructions
  - Performs 9-step analysis
  - Analysis stored in agent's thinking (implicit output)
        │
        ▼
Agent uses content-documenter skill:
  - Reads SKILL.md for instructions
  - Uses analysis from media-reviewer
  - Produces all 15 ContentSummary fields
        │
        ▼
Agent returns structured JSON
```

---

## 5. Plugin File Specifications

### 5.1 README.md → CLAUDE.md (Agent Brain)

**Location:** `plugins/looplia-writer/README.md`
**Runtime Location:** `~/.looplia/CLAUDE.md` (renamed during bootstrap)

```markdown
# Looplia Content Intelligence Agent

You are a content analysis agent. When given a task, use your skills to complete it.

## Workspace

- Content input: `contentItem/{id}.md` (YAML frontmatter + raw text)
- User preferences: `user-profile.json`
- Your skills: `.claude/skills/`

## Task: Summarize Content

When asked to summarize content:

1. **Read** the content file specified
2. **Read** user-profile.json for personalization
3. **Use media-reviewer skill** to deeply analyze:
   - Content structure and organization
   - Core ideas and concepts
   - Narrative flow and progression
   - Key moments and themes
   - Important quotes with timestamps
4. **Use content-documenter skill** to produce structured output
5. **Return** JSON matching ContentSummary schema

## Task: Build Writing Kit

When asked to build a writing kit:

1. First, summarize the content (steps above)
2. Generate writing ideas:
   - Hooks (emotional, curiosity, controversy, statistic, story)
   - Angles with relevance scores
   - Questions (analytical, practical, philosophical, comparative)
3. Create article outline:
   - Section headings with writing notes
   - Estimated word counts per section
   - Consider user's target word count
4. Return JSON matching WritingKit schema

## ContentSummary Schema

All 15 fields required:

### Core Fields
- contentId: string (from input)
- headline: string (10-200 chars) - one compelling sentence
- tldr: string (20-500 chars) - 3-5 sentence summary
- bullets: string[] (1-10 items) - key points
- tags: string[] (1-20 items) - topic tags
- sentiment: "positive" | "neutral" | "negative"
- category: string - content type
- score: { relevanceToUser: number (0-1) }

### Documentary Fields
- overview: string (min 50 chars) - 2-3 rich paragraphs
- keyThemes: string[] (3-7 items) - main themes
- detailedAnalysis: string (min 100 chars) - documentary breakdown
- narrativeFlow: string (min 50 chars) - how content progresses
- coreIdeas: CoreIdea[] (1-10 items)
  - concept: string
  - explanation: string (min 10 chars)
  - examples?: string[]
- importantQuotes: Quote[] (0-20 items)
  - text: string (verbatim)
  - timestamp?: string (HH:MM:SS or MM:SS)
  - context?: string
- context: string (min 20 chars) - background needed
- relatedConcepts: string[] (0-15 items)

## WritingKit Schema

- contentId: string
- source: { id, label, url }
- summary: ContentSummary (above)
- ideas: WritingIdeas
  - hooks: { text, type }[]
  - angles: { title, description, relevanceScore }[]
  - questions: { question, type }[]
- suggestedOutline: OutlineSection[]
  - heading: string
  - notes: string
  - estimatedWords: number
- meta: { relevanceToUser, estimatedReadingTimeMinutes }

## Rules

✅ Preserve original meaning - never add interpretation
✅ Include timestamps for video/audio content
✅ Extract verbatim quotes - never paraphrase
✅ Document structure as-is
✅ Read ALL content before analyzing
❌ Never skip source materials
❌ Never add opinions beyond source
❌ Never modify quotes
```

### 5.2 media-reviewer/SKILL.md (Deep Analysis)

**Location:** `plugins/looplia-writer/skills/media-reviewer/SKILL.md`

```markdown
---
name: media-reviewer
description: Deep content analysis for structure, themes, narrative flow,
key moments, and important quotes. Use before content-documenter.
---

# Media Reviewer Skill

Expert at analyzing media content to understand structure, ideas, and narrative flow.

## What This Skill Does

- Reads content materials (text, captions, transcripts)
- Understands ideas and concepts being presented
- Identifies narrative structure and progression
- Discovers key moments, turning points, and themes
- Recognizes content organization patterns

## Analysis Process

Follow these 9 steps in order:

### Step 1: Read Everything
- Read the complete content file
- Note the metadata (title, source, date, type)
- Don't skim - read thoroughly
- If content is truncated, note what's missing

### Step 2: Understand Context
- What is this content about?
- Who created it and why?
- What's the intended audience?
- What's the publication context?
- When was it created?

### Step 3: Identify Structure
- How is the content organized?
- What are the main sections/segments?
- How long is each part?
- What's the logical flow?
- Are there chapters, timestamps, or markers?

### Step 4: Extract Core Ideas
- What are the 3-7 main concepts?
- How are they explained?
- What examples are given?
- How do ideas connect to each other?
- What's the central thesis?

### Step 5: Track Narrative Flow
- How does content progress?
- What's the arc (intro → development → conclusion)?
- Where are the key transitions?
- How do ideas build on each other?
- What's the pacing?

### Step 6: Find Key Moments
- What are the most important points?
- Where are the "aha" moments?
- What would someone quote from this?
- What's most memorable?
- What's surprising or novel?

### Step 7: Extract Quotes + Timestamps
- Find 5-20 verbatim quotes
- For video/audio: note exact timestamps (HH:MM:SS or MM:SS)
- Capture the most insightful statements
- Include context for each quote
- Never paraphrase - exact words only

### Step 8: Identify Themes
- What recurring topics emerge?
- What patterns appear throughout?
- What's the underlying message?
- What values or perspectives are expressed?

### Step 9: Documentary Angle
- If making a documentary about this, how would you structure it?
- What's the narrative hook that draws people in?
- What makes this content unique?
- What's the emotional arc?

## Output

Your analysis is IMPLICIT - it stays in your thinking.
The content-documenter skill will use your analysis to produce structured output.
Do NOT output JSON directly from this skill.

Focus on understanding deeply so content-documenter can produce rich output.

## Important Rules

✅ Be thorough and comprehensive
✅ Understand the material deeply
✅ Preserve nuance and detail
✅ Note what makes this content unique
✅ Always include timestamps for video/audio
✅ Read the ENTIRE content before analyzing
❌ Don't add interpretation or opinion
❌ Don't skip important details
❌ Don't oversimplify complex concepts
❌ Don't paraphrase quotes - keep verbatim
❌ Don't rush - thoroughness over speed
```

### 5.3 content-documenter/SKILL.md (Structured Output)

**Location:** `plugins/looplia-writer/skills/content-documenter/SKILL.md`

```markdown
---
name: content-documenter
description: Generate structured ContentSummary JSON from analyzed content.
Use after media-reviewer to produce final output with all 15 fields.
---

# Content Documenter Skill

Transforms media-reviewer analysis into structured JSON documentation.

## What This Skill Does

Takes your media-reviewer analysis and produces ContentSummary JSON
with all 15 required fields.

## Input

You should have already used media-reviewer skill which provides:
- Deep understanding of content structure
- Core ideas and their connections
- Narrative flow analysis
- Key moments and quotes with timestamps
- Thematic patterns

## Output Fields

### Core Fields (7)

1. **contentId** (string)
   - Copy from input file frontmatter id field

2. **headline** (string, 10-200 chars)
   - One compelling sentence capturing the essence
   - Should make someone want to read more
   - Focus on the unique value or insight

3. **tldr** (string, 20-500 chars)
   - 3-5 sentence summary
   - Cover the main points concisely
   - Answer: "What is this about and why does it matter?"

4. **bullets** (string[], 1-10 items)
   - Key points as bullet list
   - Each bullet = one distinct insight
   - Ordered by importance or logical flow

5. **tags** (string[], 1-20 items)
   - Topic tags for categorization
   - Include broad tags (e.g., "AI") and specific (e.g., "Constitutional AI")
   - Lowercase, no special characters

6. **sentiment** ("positive" | "neutral" | "negative")
   - Overall tone of content
   - Based on language and framing, not topic

7. **category** (string)
   - Content type: article, video, podcast, tutorial, interview, etc.

8. **score.relevanceToUser** (number, 0-1)
   - Based on user-profile.json topics
   - 1.0 = perfectly matches user interests
   - 0.0 = no relevance to user interests
   - Calculate: sum(matched topic weights) / sum(all topic weights)

### Documentary Fields (8)

9. **overview** (string, min 50 chars)
   - 2-3 rich paragraphs introducing the material
   - Write for someone unfamiliar with the content
   - Cover: what it is, who it's for, why it matters
   - Set the stage for detailed analysis

10. **keyThemes** (string[], 3-7 items)
    - Main topics/themes identified
    - Broader than tags, more conceptual
    - Examples: "The tension between safety and capability"

11. **detailedAnalysis** (string, min 100 chars)
    - Documentary-style breakdown
    - Follow the content's structure
    - Explain each major section/segment
    - Include specific details and examples

12. **narrativeFlow** (string, min 50 chars)
    - How the content progresses
    - Explain the arc and transitions
    - Show how ideas build on each other
    - Note pacing and structure choices

13. **coreIdeas** (CoreIdea[], 1-10 items)
    Each item has:
    - concept: string - the idea name
    - explanation: string (min 10 chars) - what it means in this context
    - examples?: string[] - specific examples from content

14. **importantQuotes** (Quote[], 0-20 items)
    Each item has:
    - text: string - EXACT verbatim quote (never paraphrase!)
    - timestamp?: string - HH:MM:SS or MM:SS format (for video/audio)
    - context?: string - what was being discussed when this was said

15. **context** (string, min 20 chars)
    - Background needed to understand the content
    - Prerequisites or prior knowledge assumed
    - Historical or situational context
    - Related work or references mentioned

16. **relatedConcepts** (string[], 0-15 items)
    - Related topics mentioned or implied
    - Connections to other ideas or fields
    - What someone might want to learn next

## Timestamp Format

For video/audio content:
- `0:30` - 30 seconds
- `2:45` - 2 minutes 45 seconds
- `1:30:00` - 1 hour 30 minutes
- Always use the format from the source (don't normalize)

## JSON Output Example

```json
{
  "contentId": "abc123",
  "headline": "Constitutional AI introduces a novel approach to aligning language models through self-critique",
  "tldr": "This video explains Constitutional AI, Anthropic's method for training helpful and harmless AI assistants. The approach uses a set of principles (a 'constitution') to guide the model's self-improvement, reducing the need for human feedback while maintaining safety.",
  "bullets": [
    "Constitutional AI uses self-critique guided by explicit principles",
    "The method reduces reliance on human feedback for safety training",
    "Models learn to identify and correct their own harmful outputs"
  ],
  "tags": ["ai", "safety", "alignment", "constitutional-ai", "anthropic", "rlhf"],
  "sentiment": "positive",
  "category": "video",
  "score": { "relevanceToUser": 0.85 },
  "overview": "This comprehensive video from Anthropic introduces Constitutional AI, a groundbreaking approach to AI alignment. The presentation walks through the limitations of existing methods like RLHF and presents a novel solution.\n\nThe core innovation is using a 'constitution' - a set of explicit principles - to guide an AI model's self-improvement process. This allows the model to critique and revise its own outputs without requiring constant human oversight.\n\nThe video is essential viewing for anyone interested in AI safety, as it represents one of the most practical approaches to the alignment problem developed to date.",
  "keyThemes": [
    "AI Safety and Alignment",
    "Self-supervised learning for safety",
    "Reducing human feedback requirements",
    "Explicit principles for AI behavior"
  ],
  "detailedAnalysis": "The video opens with a clear problem statement: current AI safety methods require extensive human feedback, which is expensive and doesn't scale. The presenters then introduce Constitutional AI as their solution.\n\nThe method works in two phases: first, the model generates responses and critiques them against constitutional principles; second, it revises based on these critiques. This cycle repeats until outputs meet safety standards.\n\nKey technical details include the specific constitutional principles used, the training procedure, and empirical results showing improved safety without sacrificing helpfulness.",
  "narrativeFlow": "The presentation follows a classic problem-solution structure. It begins by establishing the importance of AI safety, then details the limitations of current approaches (particularly RLHF). The middle section introduces Constitutional AI conceptually before diving into technical details. The conclusion presents results and future directions.",
  "coreIdeas": [
    {
      "concept": "Constitutional AI",
      "explanation": "An alignment approach where AI models critique and revise their own outputs based on explicit principles, rather than relying solely on human feedback",
      "examples": ["A model generating a harmful response, then self-critiquing against the principle 'be helpful but harmless', and revising to remove the harmful content"]
    },
    {
      "concept": "Self-critique loop",
      "explanation": "The iterative process where a model evaluates its own outputs against constitutional principles and improves them",
      "examples": ["Generate → Critique → Revise → Evaluate"]
    }
  ],
  "importantQuotes": [
    {
      "text": "The key insight is that we can use AI to supervise AI",
      "timestamp": "12:34",
      "context": "Explaining the core mechanism that makes Constitutional AI scalable"
    },
    {
      "text": "Human feedback is precious and we should use it wisely",
      "timestamp": "5:20",
      "context": "Motivating why reducing human feedback requirements matters"
    }
  ],
  "context": "This video builds on prior work in RLHF (Reinforcement Learning from Human Feedback) and assumes familiarity with transformer-based language models. It's part of Anthropic's broader research agenda on AI safety and alignment.",
  "relatedConcepts": ["RLHF", "red teaming", "scalable oversight", "AI alignment", "harmlessness", "helpfulness"]
}
```

## Quality Checklist

Before outputting, verify:
- ✅ All 15 fields are present
- ✅ All minimum lengths are met
- ✅ Quotes are exact (verbatim)
- ✅ Timestamps are included for video/audio
- ✅ contentId matches input file
- ✅ relevanceToUser is calculated from user profile
- ✅ JSON is valid

## Important Rules

✅ Include ALL 15 fields - never omit any
✅ Use exact verbatim quotes - never paraphrase
✅ Include timestamps when source has them
✅ Meet all minimum character requirements
✅ Follow the JSON schema exactly
✅ Base relevanceToUser on actual user profile
❌ Never paraphrase quotes
❌ Never add interpretation beyond source
❌ Never omit required fields
❌ Never guess timestamps - only include if known
```

### 5.4 user-profile-reader/SKILL.md (Personalization)

**Location:** `plugins/looplia-writer/skills/user-profile-reader/SKILL.md`

```markdown
---
name: user-profile-reader
description: Read user profile from workspace and calculate content relevance.
Use to personalize output based on user interests.
---

# User Profile Reader Skill

Read and interpret user preferences for content personalization.

## What This Skill Does

- Reads `user-profile.json` from workspace root
- Provides user context to other processing
- Calculates relevance scores for content

## User Profile Location

`~/.looplia/user-profile.json`

## User Profile Schema

```json
{
  "userId": "string",
  "topics": [
    { "topic": "string", "interestLevel": 1-5 }
  ],
  "style": {
    "tone": "beginner" | "intermediate" | "expert" | "mixed",
    "targetWordCount": 100-10000,
    "voice": "first-person" | "third-person" | "instructional"
  }
}
```

## Relevance Scoring Algorithm

Calculate `score.relevanceToUser` (0-1):

```
1. For each user topic:
   - weight = interestLevel / 5
   - matched = content tags/themes contain topic (case-insensitive)

2. Calculate score:
   - matchedWeight = sum of weights for matched topics
   - totalWeight = sum of all topic weights
   - score = matchedWeight / totalWeight

3. If no user topics defined:
   - score = 0.5 (neutral)
```

## Example Calculation

User profile:
```json
{
  "topics": [
    { "topic": "AI", "interestLevel": 5 },
    { "topic": "productivity", "interestLevel": 3 },
    { "topic": "cooking", "interestLevel": 2 }
  ]
}
```

Content tags: ["AI", "safety", "alignment"]

Calculation:
- AI: matched, weight = 5/5 = 1.0
- productivity: not matched, weight = 0
- cooking: not matched, weight = 0
- matchedWeight = 1.0
- totalWeight = 1.0 + 0.6 + 0.4 = 2.0
- score = 1.0 / 2.0 = 0.5

## Usage in Other Skills

When content-documenter needs relevance score:
1. Read user-profile.json
2. Compare content tags/themes to user topics
3. Apply algorithm above
4. Return score in `score.relevanceToUser` field

## Handling Edge Cases

- **No user profile file:** Use score = 0.5
- **Empty topics array:** Use score = 0.5
- **Invalid JSON:** Use score = 0.5, log warning
- **All topics matched:** score = 1.0
- **No topics matched:** score = 0.0
```

---

## 6. Query Flow

### 6.1 Summarize Command Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  CLI: looplia summarize --file article.txt                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Validate input and check API key                             │
│  2. Read file content                                            │
│  3. Create ContentItem from file                                 │
│  4. Ensure workspace exists (~/.looplia/)                        │
│  5. Write content to workspace:                                  │
│     ~/.looplia/contentItem/{id}.md                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  query({                                                         │
│    prompt: "Summarize content: contentItem/{id}.md",             │
│    options: {                                                    │
│      cwd: "~/.looplia/",                                         │
│      model: "claude-haiku-4-5-20251001",                         │
│      allowedTools: ["Read", "Skill"],                            │
│      outputFormat: {                                             │
│        type: "json_schema",                                      │
│        schema: CONTENT_SUMMARY_SCHEMA                            │
│      },                                                          │
│      permissionMode: "bypassPermissions"                         │
│    }                                                             │
│  })                                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  INSIDE SDK SESSION (cwd = ~/.looplia/)                          │
│                                                                  │
│  Agent: "I need to summarize contentItem/{id}.md"                │
│    │                                                             │
│    ├─► Reads CLAUDE.md                                           │
│    │   └─► Understands workflow: media-reviewer → documenter     │
│    │                                                             │
│    ├─► Reads contentItem/{id}.md                                 │
│    │   └─► Gets title, source, raw content                       │
│    │                                                             │
│    ├─► Reads user-profile.json                                   │
│    │   └─► Gets topics for relevance scoring                     │
│    │                                                             │
│    ├─► Uses media-reviewer skill                                 │
│    │   └─► 9-step deep analysis                                  │
│    │   └─► Analysis stored in thinking                           │
│    │                                                             │
│    ├─► Uses content-documenter skill                             │
│    │   └─► Produces all 15 fields                                │
│    │   └─► Uses analysis from media-reviewer                     │
│    │                                                             │
│    └─► Returns ContentSummary JSON                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLI receives ContentSummary                                     │
│  Format as JSON or Markdown                                      │
│  Output to stdout or file                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Kit Command Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  CLI: looplia kit --file article.txt --topics "AI,safety"        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Validate input and check API key                             │
│  2. Read file content                                            │
│  3. Load/create user profile (CLI args override)                 │
│  4. Ensure workspace exists                                      │
│  5. Write content to workspace                                   │
│  6. Write user profile to workspace                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  query({                                                         │
│    prompt: "Build writing kit for: contentItem/{id}.md",         │
│    options: {                                                    │
│      cwd: "~/.looplia/",                                         │
│      model: "claude-haiku-4-5-20251001",                         │
│      allowedTools: ["Read", "Skill"],                            │
│      outputFormat: {                                             │
│        type: "json_schema",                                      │
│        schema: WRITING_KIT_SCHEMA                                │
│      },                                                          │
│      permissionMode: "bypassPermissions"                         │
│    }                                                             │
│  })                                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  INSIDE SDK SESSION (cwd = ~/.looplia/)                          │
│                                                                  │
│  Agent: "I need to build a writing kit"                          │
│    │                                                             │
│    ├─► Reads CLAUDE.md                                           │
│    │   └─► Understands full kit workflow                         │
│    │                                                             │
│    ├─► Reads contentItem/{id}.md                                 │
│    ├─► Reads user-profile.json                                   │
│    │                                                             │
│    ├─► PHASE 1: Summarize (uses skills)                          │
│    │   ├─► media-reviewer skill → deep analysis                  │
│    │   └─► content-documenter skill → ContentSummary             │
│    │                                                             │
│    ├─► PHASE 2: Generate Ideas                                   │
│    │   └─► Hooks, angles, questions                              │
│    │   └─► Context from Phase 1 available                        │
│    │                                                             │
│    ├─► PHASE 3: Create Outline                                   │
│    │   └─► Section structure                                     │
│    │   └─► Word count estimates                                  │
│    │                                                             │
│    └─► Returns complete WritingKit JSON                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLI receives WritingKit                                         │
│  Format as JSON or Markdown                                      │
│  Output to stdout or file                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Plan

### 7.1 Phase 1: Enhance Plugin Files

**Files to modify:**

| File | Action | Description |
|------|--------|-------------|
| `plugins/looplia-writer/README.md` | REWRITE | Complete agent brain with workflow logic |
| `plugins/looplia-writer/skills/media-reviewer/SKILL.md` | ENHANCE | Full 9-step analysis process |
| `plugins/looplia-writer/skills/content-documenter/SKILL.md` | ENHANCE | All 15 output fields with examples |
| `plugins/looplia-writer/skills/user-profile-reader/SKILL.md` | ENHANCE | Clear relevance algorithm |

### 7.2 Phase 2: Update Provider Code

**Files to modify:**

| File | Action | Description |
|------|--------|-------------|
| `packages/provider/src/claude-agent-sdk/summarizer.ts` | UPDATE | Use minimal prompt |
| `packages/provider/src/claude-agent-sdk/idea-generator.ts` | UPDATE | Use minimal prompt |
| `packages/provider/src/claude-agent-sdk/outline-generator.ts` | UPDATE | Use minimal prompt |
| `packages/provider/src/claude-agent-sdk/index.ts` | UPDATE | Simplify provider creation |

**Code change example:**

```typescript
// BEFORE (summarizer.ts)
export function createClaudeSummarizer(config?: ClaudeAgentConfig) {
  return {
    summarize(content, user) {
      const prompt = buildSummarizePrompt(content, user);  // 76 lines
      return executeQueryWithRetry(prompt, SYSTEM_PROMPT, SCHEMA, config);
    }
  };
}

// AFTER (summarizer.ts)
export function createClaudeSummarizer(config?: ClaudeAgentConfig) {
  return {
    async summarize(content, user) {
      const workspace = await ensureWorkspace();
      await writeContentItem(content, workspace);
      if (user) await writeUserProfile(user, workspace);

      const prompt = `Summarize content: contentItem/${content.id}.md`;
      return executeQueryWithRetry(prompt, undefined, SCHEMA, {
        ...config,
        workspace
      });
    }
  };
}
```

### 7.3 Phase 3: Delete Hardcoded Prompts

**Files to DELETE:**

| File | Reason |
|------|--------|
| `packages/provider/src/claude-agent-sdk/prompts/summarize.ts` | Logic moves to CLAUDE.md + skills |
| `packages/provider/src/claude-agent-sdk/prompts/ideas.ts` | Logic moves to CLAUDE.md |
| `packages/provider/src/claude-agent-sdk/prompts/outline.ts` | Logic moves to CLAUDE.md |

### 7.4 Phase 4: Update CLI Commands

**Files to modify:**

| File | Action | Description |
|------|--------|-------------|
| `apps/cli/src/commands/summarize.ts` | UPDATE | Verify workspace flow |
| `apps/cli/src/commands/kit.ts` | UPDATE | Single query approach |

**Kit command change:**

```typescript
// BEFORE: 3 separate calls
const summaryResult = await providers.summarizer.summarize(content, user);
const ideasResult = await providers.idea.generateIdeas(summary, user);
const outlineResult = await providers.outline.generateOutline(summary, ideas, user);

// AFTER: Single call
const prompt = `Build writing kit for: contentItem/${content.id}.md`;
const result = await query({
  prompt,
  options: {
    cwd: workspace,
    allowedTools: ['Read', 'Skill'],
    outputFormat: { type: 'json_schema', schema: WRITING_KIT_SCHEMA }
  }
});
```

### 7.5 Phase 5: Update Tests

- Update unit tests for new minimal prompts
- Update integration tests for single-query flow
- Add tests verifying skills are invoked
- Update E2E tests for CLI commands

---

## 8. Migration from v0.3

### 8.1 Breaking Changes

1. **Provider API signature unchanged** - External API remains the same
2. **Output format unchanged** - Still returns same types
3. **Internal implementation changes** - How results are generated differs

### 8.2 Migration Steps

For users:
1. Run `looplia bootstrap` to get updated plugin files
2. Commands work the same way externally

For developers:
1. Pull latest code
2. Note that hardcoded prompt files are deleted
3. Customization now happens in plugin files, not TypeScript

### 8.3 Backward Compatibility

- CLI interface unchanged
- JSON output schema unchanged
- User profile format unchanged
- Workspace location unchanged

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// Test minimal prompt generation
describe('Minimal Prompts', () => {
  it('should generate summarize prompt', () => {
    const prompt = buildMinimalPrompt('summarize', 'abc123');
    expect(prompt).toBe('Summarize content: contentItem/abc123.md');
  });

  it('should generate kit prompt', () => {
    const prompt = buildMinimalPrompt('kit', 'abc123');
    expect(prompt).toBe('Build writing kit for: contentItem/abc123.md');
  });
});
```

### 9.2 Integration Tests

```typescript
// Test that agent uses skills
describe('Agentic Flow', () => {
  it('should invoke media-reviewer skill', async () => {
    const result = await summarizeContent(testContent);
    // Verify output has depth that requires media-reviewer
    expect(result.data.coreIdeas.length).toBeGreaterThan(0);
    expect(result.data.importantQuotes.length).toBeGreaterThan(0);
  });

  it('should produce all 15 ContentSummary fields', async () => {
    const result = await summarizeContent(testContent);
    expect(result.data).toHaveProperty('overview');
    expect(result.data).toHaveProperty('keyThemes');
    expect(result.data).toHaveProperty('detailedAnalysis');
    // ... verify all 15 fields
  });
});
```

### 9.3 E2E Tests

```typescript
describe('CLI E2E', () => {
  it('summarize produces rich output', async () => {
    const output = await exec('looplia summarize --file test.txt --format json');
    const result = JSON.parse(output);

    // Verify documentary fields are populated
    expect(result.overview.length).toBeGreaterThan(50);
    expect(result.keyThemes.length).toBeGreaterThanOrEqual(3);
  });

  it('kit produces complete writing kit', async () => {
    const output = await exec('looplia kit --file test.txt --format json');
    const result = JSON.parse(output);

    expect(result.summary).toBeDefined();
    expect(result.ideas.hooks.length).toBeGreaterThan(0);
    expect(result.suggestedOutline.length).toBeGreaterThan(0);
  });
});
```

---

## 10. Benefits

### 10.1 Technical Benefits

| Benefit | Description |
|---------|-------------|
| **Shared Context** | Single SDK session maintains analysis context |
| **Reduced API Calls** | 1 call instead of 3 for kit command |
| **Richer Output** | All 15 ContentSummary fields populated |
| **Plugin Customization** | Modify behavior without code changes |
| **Cleaner Codebase** | Remove 200+ lines of hardcoded prompts |

### 10.2 User Benefits

| Benefit | Description |
|---------|-------------|
| **Better Summaries** | Documentary-style analysis with quotes |
| **Faster Execution** | Fewer API round-trips |
| **Lower Cost** | Single session more efficient |
| **Customizable** | Edit plugin files to change behavior |

### 10.3 Developer Benefits

| Benefit | Description |
|---------|-------------|
| **Simpler Code** | Minimal prompt generation |
| **Plugin-First** | Add features via markdown |
| **Testable** | Clear boundaries between components |
| **Maintainable** | Logic in readable markdown files |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.3.1 | 2025-12-08 | Initial v0.3.1 design: true agentic architecture |
