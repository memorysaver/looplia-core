# Looplia Core – Technical Design Document v0.3

**Version:** 0.3
**Status:** Draft
**Last Updated:** 2025-12-07

---

## Table of Contents

1. [Overview](#1-overview)
2. [What's New in v0.3](#2-whats-new-in-v03)
3. [Architecture Shift: Provider-Centric to Agent-Centric](#3-architecture-shift-provider-centric-to-agent-centric)
4. [Enhanced Domain Model](#4-enhanced-domain-model)
5. [Workspace Design](#5-workspace-design)
6. [Agent & Skills Architecture](#6-agent--skills-architecture)
7. [CLI Integration](#7-cli-integration)
8. [Implementation Plan](#8-implementation-plan)
9. [Migration from v0.2](#9-migration-from-v02)
10. [Testing Strategy](#10-testing-strategy)
11. [Future Roadmap](#11-future-roadmap)

---

## 1. Overview

### 1.1 Purpose

Looplia v0.3 introduces an **agent-centric workspace architecture** that fundamentally changes how content intelligence is generated. Instead of TypeScript providers calling the Claude Agent SDK, the workspace itself becomes the runtime environment where agents orchestrate skills to produce enriched writing kits.

**Beyond v0.3:** This release is the **first milestone in a larger vision** — Looplia as a **general-purpose agent framework** where any workflow can be defined as a plugin. The looplia-writer plugin proves that specialized agent personas can be bootstrapped into a workspace and triggered via CLI to execute multi-step agentic workflows. Future versions will enable users to install and switch between different agent plugins (writer, coder, researcher, analyst, etc.), each with their own workflows, subagents, and skills.

### 1.2 Key Changes from v0.2

| Aspect | v0.2 (Provider-Centric) | v0.3 (Agent-Centric) |
|--------|------------------------|---------------------|
| **Execution Model** | TypeScript code calls SDK | SDK runs agents in workspace |
| **Plugin Structure** | N/A | Claude Code plugin at project root |
| **Workspace Location** | `~/.looplia/agents/` (flat) | `~/.looplia/.claude/agents/` (nested) |
| **Workspace Role** | Template storage | Active runtime environment |
| **Bootstrap Strategy** | Manual template copy | Auto-copy from plugin on first run |
| **Agent SDK cwd** | N/A in v0.2 | `~/.looplia/` (workspace) |
| **Input Handling** | Function arguments | Files in workspace |
| **Output Richness** | Basic summary fields | Enhanced with legacy skill depth |
| **User Profile** | Passed as arguments | Configured via CLI, stored in workspace |
| **Skills** | Generic `content-analysis` | Specialized: `media-reviewer`, `content-documenter` |

### 1.3 Goals

**Immediate (v0.3):**
- Leverage legacy writing-agent patterns for richer content analysis
- Make `~/.looplia/` the canonical workspace with `.claude/` structure
- Enhance domain types with documentary-style analysis (themes, quotes, narrative flow)
- Enable CLI-based user profile configuration
- Maintain JSON output compatibility while enriching content

**Strategic (Proof of Concept):**
- **Prove plugin-based agent architecture works** for specialized workflows
- **Demonstrate workspace bootstrap enables agent switching** between different personas
- **Show skills can be composed into multi-step workflows** triggered by CLI
- **Validate README.md → CLAUDE.md pattern** for self-documenting plugins
- **Establish foundation for general-purpose agent framework** (v0.4+)

### 1.4 Non-Goals

- Backward compatibility with v0.2 provider API (breaking change)
- Markdown file output (keep JSON for structured data)
- Multi-model support in v0.3 (focus on Claude Agent SDK)
- Multiple plugin support in v0.3 (single looplia-writer plugin only)
- Workflow configuration system (hardcoded workflow in v0.3)

---

## 2. What's New in v0.3

### 2.1 Enhanced Domain Types

**New Types:**
- `CoreIdea` - Concept with explanation and examples
- `Quote` - Verbatim quote with optional timestamp and context

**Enhanced `ContentSummary`:**
Added 8 new fields from legacy media-reviewer + content-documenter skills:
- `overview` - 2-3 paragraph rich summary
- `keyThemes` - 3-7 main themes
- `detailedAnalysis` - Documentary-style breakdown
- `narrativeFlow` - How content progresses
- `coreIdeas` - Main concepts with explanations
- `importantQuotes` - Verbatim quotes with timestamps
- `context` - Background needed to understand
- `relatedConcepts` - Connections to other topics

### 2.2 Dual-Purpose Plugin Architecture

**The repository serves two purposes:**
1. **Claude Code Plugin** - Can be used as a general Claude Code plugin
2. **Looplia Writer Agent** - Specialized agent for CLI content processing

**Project Root Structure:**
```
looplia-core/
├── .claude-plugin/
│   └── plugin.json              # Root plugin metadata for Claude Code
├── .claude/                     # General Claude Code structure
│   ├── agents/                  # (can be empty or have general agents)
│   └── skills/                  # (can be empty or have general skills)
├── plugins/
│   └── looplia-writer/          # Looplia writer agent (for CLI)
│       ├── .claude-plugin/
│       │   └── plugin.json      # Looplia writer plugin metadata
│       ├── README.md            # Plugin mission (→ CLAUDE.md in workspace)
│       ├── agents/              # Writing-specific agents
│       │   ├── content-analyzer.md
│       │   ├── idea-generator.md
│       │   └── writing-kit-builder.md
│       └── skills/              # Writing-specific skills
│           ├── media-reviewer/
│           ├── content-documenter/
│           ├── user-profile-reader/
│           └── writing-enhancer/
├── packages/                    # Existing packages
└── apps/                        # Existing apps
```

**Runtime Workspace (Bootstrapped from Looplia Writer Plugin):**
```
~/.looplia/
├── CLAUDE.md                    # Copied from plugins/looplia-writer/README.md
├── user-profile.json            # CLI-managed user preferences
├── contentItem/                 # Input content (preserved)
│   └── {id}.md
└── .claude/                     # Bootstrapped from plugin
    ├── agents/                  # Copied from plugins/looplia-writer/agents/
    │   ├── content-analyzer.md
    │   ├── idea-generator.md
    │   └── writing-kit-builder.md
    └── skills/                  # Copied from plugins/looplia-writer/skills/
        ├── media-reviewer/
        ├── content-documenter/
        ├── user-profile-reader/
        └── writing-enhancer/
```

**Bootstrap Strategy:**
- On first run, CLI copies from `/plugins/looplia-writer/` to `~/.looplia/`
- `agents/` and `skills/` subdirectories are copied to `.claude/`
- `README.md` is renamed to `CLAUDE.md` (GitHub shows README, workspace uses CLAUDE.md)
- Agent SDK runs with `cwd: ~/.looplia/` (finds agents in `.claude/`)
- Matches Claude Code user config pattern (`~/.claude/`)

### 2.3 CLI Commands

**New Commands:**
```bash
looplia config topics "AI, productivity, writing"
looplia config style --tone expert --word-count 1500
looplia config show
```

**Enhanced Commands:**
```bash
looplia kit --file ./article.md
looplia kit --url https://example.com/article
looplia kit --youtube https://youtube.com/watch?v=xyz
```

### 2.4 Skills from Legacy Writing Agent

- **media-reviewer** - Deep content analysis (structure, themes, narrative)
- **content-documenter** - Structured documentation with quotes/timestamps
- **user-profile-reader** (new) - Personalization based on workspace config
- **writing-enhancer** (future) - Style-aware rewriting

---

## 3. Architecture Shift: Provider-Centric to Agent-Centric

### 3.1 v0.2 Architecture (Provider-Centric)

```
┌──────────────────────────────────────────────────┐
│ CLI                                              │
│  ↓                                               │
│ Provider Package (TypeScript)                    │
│  ├─ createClaudeProviders()                     │
│  └─ buildWritingKit(content, user, providers)   │
│      ↓                                           │
│     Query Claude Agent SDK                       │
│      ↓                                           │
│     Return structured JSON                       │
└──────────────────────────────────────────────────┘

Workspace Role: Template storage only
```

### 3.2 v0.3 Architecture (Agent-Centric)

```
┌──────────────────────────────────────────────────┐
│ CLI                                              │
│  ├─ Configure user profile → user-profile.json  │
│  ├─ Copy content → contentItem/{id}.md          │
│  └─ Invoke Agent SDK (cwd: ~/.looplia/)        │
│      ↓                                           │
│     CLAUDE.md (main mission)                     │
│      ↓                                           │
│     Subagents orchestrate workflow               │
│      ├─ content-analyzer (media-reviewer)       │
│      ├─ idea-generator                          │
│      └─ writing-kit-builder                     │
│          ↓                                       │
│         Skills process content                   │
│          ├─ media-reviewer                      │
│          ├─ content-documenter                  │
│          └─ user-profile-reader                 │
│              ↓                                   │
│             Return enhanced JSON WritingKit      │
└──────────────────────────────────────────────────┘

Workspace Role: Active runtime environment
```

### 3.3 Key Differences

| Component | v0.2 | v0.3 |
|-----------|------|------|
| **Entry Point** | TypeScript provider function | CLAUDE.md agent mission |
| **Content Input** | `content: ContentItem` arg | `contentItem/{id}.md` file |
| **User Profile** | `user: UserProfile` arg | `user-profile.json` file |
| **Processing** | Provider calls SDK with prompts | Agent reads files, uses skills |
| **Output** | Basic ContentSummary | Enhanced with 8 new fields |
| **Workspace** | `~/.looplia/agents/` flat | `~/.looplia/.claude/agents/` nested |

---

## 4. Enhanced Domain Model

### 4.1 New Domain Types

```typescript
// packages/core/src/domain/core-idea.ts

/**
 * A core concept with explanation and examples
 */
export type CoreIdea = {
  /** The concept name */
  concept: string;

  /** Detailed explanation */
  explanation: string;

  /** Optional examples from the content */
  examples?: string[];
};
```

```typescript
// packages/core/src/domain/quote.ts

/**
 * A verbatim quote with optional metadata
 */
export type Quote = {
  /** The exact quote text */
  text: string;

  /** Timestamp in HH:MM:SS or MM:SS format (for video/audio) */
  timestamp?: string;

  /** Contextual information about the quote */
  context?: string;
};
```

### 4.2 Enhanced ContentSummary

```typescript
// packages/core/src/domain/summary.ts

import type { CoreIdea } from './core-idea';
import type { Quote } from './quote';

/**
 * Summarized content with key insights
 * Enhanced in v0.3 with documentary-style analysis
 */
export type ContentSummary = {
  /** Reference to source content */
  contentId: string;

  // ─── Core Fields (from v0.1) ───
  /** One-sentence distilled insight (10-200 chars) */
  headline: string;

  /** 3-5 sentence summary (20-500 chars) */
  tldr: string;

  /** Key points as bullet list (1-10 items) */
  bullets: string[];

  /** Topic tags (1-20 tags) */
  tags: string[];

  /** Overall sentiment */
  sentiment: 'positive' | 'neutral' | 'negative';

  /** Content category */
  category: string;

  /** Relevance scores */
  score: SummaryScore;

  // ─── Enhanced Fields (v0.3 - from legacy skills) ───

  /** Rich 2-3 paragraph overview */
  overview: string;

  /** 3-7 main themes identified in content */
  keyThemes: string[];

  /** Documentary-style detailed breakdown of content */
  detailedAnalysis: string;

  /** Description of how content progresses and builds */
  narrativeFlow: string;

  /** Core concepts with explanations and examples */
  coreIdeas: CoreIdea[];

  /** Important verbatim quotes with timestamps */
  importantQuotes: Quote[];

  /** Background context needed to understand content */
  context: string;

  /** Related topics and concepts mentioned */
  relatedConcepts: string[];
};
```

### 4.3 Validation Schemas

```typescript
// packages/core/src/validation/schemas.ts

import { z } from 'zod';

export const CoreIdeaSchema = z.object({
  concept: z.string().min(1),
  explanation: z.string().min(10),
  examples: z.array(z.string()).optional()
});

export const QuoteSchema = z.object({
  text: z.string().min(1),
  timestamp: z.string().optional(), // Format: HH:MM:SS or MM:SS
  context: z.string().optional()
});

export const ContentSummarySchema = z.object({
  contentId: z.string().min(1),

  // Core fields
  headline: z.string().min(10).max(200),
  tldr: z.string().min(20).max(500),
  bullets: z.array(z.string()).min(1).max(10),
  tags: z.array(z.string()).min(1).max(20),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  category: z.string(),
  score: SummaryScoreSchema,

  // Enhanced fields (v0.3)
  overview: z.string().min(50),
  keyThemes: z.array(z.string()).min(3).max(7),
  detailedAnalysis: z.string().min(100),
  narrativeFlow: z.string().min(50),
  coreIdeas: z.array(CoreIdeaSchema).min(1).max(10),
  importantQuotes: z.array(QuoteSchema).min(0).max(20),
  context: z.string().min(20),
  relatedConcepts: z.array(z.string()).min(0).max(15)
});
```

---

## 5. Workspace Design

### 5.1 Directory Structure

**Dual-Purpose Plugin Structure:**

**Project Root (Dual Purpose):**
```
looplia-core/                           # Project root
├── .claude-plugin/
│   └── plugin.json                     # Root plugin metadata for Claude Code
├── .claude/                            # General Claude Code structure
│   ├── agents/                         # (can have general agents)
│   └── skills/                         # (can have general skills)
├── plugins/
│   └── looplia-writer/                 # Looplia writer plugin (CLI bootstrap source)
│       ├── .claude-plugin/
│       │   └── plugin.json             # Looplia writer plugin metadata
│       ├── README.md                   # Plugin mission (→ CLAUDE.md in workspace)
│       ├── agents/                     # Writing-specific agents
│       │   ├── content-analyzer.md     # Deep analysis agent
│       │   ├── idea-generator.md       # Ideas generation agent
│       │   └── writing-kit-builder.md  # Full pipeline orchestrator
│       └── skills/                     # Writing-specific skills
│           ├── media-reviewer/
│           │   └── SKILL.md            # Deep content analysis
│           ├── content-documenter/
│           │   └── SKILL.md            # Structured documentation
│           ├── user-profile-reader/
│           │   └── SKILL.md            # Read user preferences
│           └── writing-enhancer/
│               └── SKILL.md            # Style-aware rewriting (future)
├── packages/                           # Existing packages
└── apps/                               # Existing apps
```

**Runtime Workspace (~/.looplia/):**
```
~/.looplia/                             # CLI workspace (like ~/.claude/)
├── CLAUDE.md                           # Main agent mission (from README.md)
├── user-profile.json                   # User preferences (CLI-managed)
├── contentItem/                        # Input content directory
│   └── {id}.md                         # ContentItem as markdown with frontmatter
└── .claude/                            # Bootstrapped from looplia-writer plugin
    ├── agents/                         # Subagent definitions
    │   ├── content-analyzer.md
    │   ├── idea-generator.md
    │   └── writing-kit-builder.md
    └── skills/                         # Reusable skill components
        ├── media-reviewer/
        │   └── SKILL.md
        ├── content-documenter/
        │   └── SKILL.md
        ├── user-profile-reader/
        │   └── SKILL.md
        └── writing-enhancer/
            └── SKILL.md
```

**Bootstrap Process:**
1. Check if `~/.looplia/` exists
2. If not:
   - Create `~/.looplia/` directory
   - Create `~/.looplia/.claude/` directory
   - Copy `plugins/looplia-writer/agents/` → `~/.looplia/.claude/agents/`
   - Copy `plugins/looplia-writer/skills/` → `~/.looplia/.claude/skills/`
   - Copy `plugins/looplia-writer/README.md` → `~/.looplia/CLAUDE.md` (rename!)
   - Create `contentItem/` directory
   - Create default `user-profile.json`
3. If exists: Skip (preserve user customizations)

### 5.2 README.md (Plugin) / CLAUDE.md (Workspace)

**Plugin Location:** `plugins/looplia-writer/README.md`
**Workspace Location:** `~/.looplia/CLAUDE.md` (renamed from README.md on bootstrap)

**Why README.md in plugin?**
- GitHub displays README.md automatically for the plugin directory
- Makes the plugin self-documenting and discoverable
- Bootstrap renames to CLAUDE.md for Agent SDK compatibility

**Content:**

```markdown
# Looplia Content Intelligence Agent

Transform raw content into structured writing kits with rich analysis.

## Mission

Convert long-form content (articles, videos, podcasts, transcripts) into
comprehensive writing kits that preserve original meaning while providing
deep insights, ideas, and outlines for future writing.

## Workspace Context

You are running in `~/.looplia/` workspace:
- Input content: `contentItem/{id}.md` with YAML frontmatter
- User preferences: `user-profile.json`
- Agents: `.claude/agents/`
- Skills: `.claude/skills/`

## Content Input

Input content is stored in `contentItem/{id}.md` with YAML frontmatter:

```yaml
---
id: "content-123"
title: "Original Title"
source_type: "youtube" | "podcast" | "rss" | "text"
source_url: "https://..."
published_at: "2024-01-01T00:00:00Z"
---

[Raw content text here]
```

## User Profile

Read `user-profile.json` for personalization:
- topics: Array of topics with interest levels (1-5)
- style: Preferred tone, word count, voice

## Workflow

1. **Analyze**: Use media-reviewer skill for deep content understanding
   - Understand structure, themes, narrative flow
   - Identify key moments, turning points
   - Extract core ideas with explanations

2. **Document**: Use content-documenter skill for structured summary
   - Generate overview, keyThemes, detailedAnalysis
   - Extract verbatim quotes with timestamps
   - Document narrativeFlow, context, relatedConcepts

3. **Generate Ideas**: Create hooks, angles, questions
   - Emotional, curiosity, controversy, statistic, story hooks
   - Narrative angles with relevance scores
   - Analytical, practical, philosophical, comparative questions

4. **Build Outline**: Structure article outline
   - Section headings with writing notes
   - Estimated word counts per section
   - Consider user's target word count

5. **Personalize**: Use user-profile-reader skill to tailor relevance
   - Score content against user topics
   - Match narrative angles to user tone preference

## Available Skills

- **media-reviewer**: Deep content analysis (structure, themes, narrative)
- **content-documenter**: Structured documentation with quotes/timestamps
- **user-profile-reader**: Read user preferences for personalization
- **writing-enhancer**: Rephrase/rewrite matching user style (future)

## Output Format

Return JSON matching WritingKit schema with enhanced ContentSummary fields:
- overview, keyThemes, detailedAnalysis, narrativeFlow
- coreIdeas, importantQuotes, context, relatedConcepts

## Rules

✅ Preserve original meaning - never add interpretation
✅ Include timestamps for video/audio content (HH:MM:SS format)
✅ Extract verbatim quotes for accuracy
✅ Document structure as-is, following original organization
✅ Score relevance to user interests (0-1)
✅ Read ALL available content sources
❌ Never skip available source materials
❌ Never add opinions or analysis beyond source
❌ Never modify or infer beyond what's explicitly stated
```

### 5.3 User Profile Format

```json
{
  "userId": "user-123",
  "topics": [
    { "topic": "AI", "interestLevel": 5 },
    { "topic": "productivity", "interestLevel": 4 },
    { "topic": "writing", "interestLevel": 3 }
  ],
  "style": {
    "tone": "expert",
    "targetWordCount": 1500,
    "voice": "first-person"
  }
}
```

### 5.4 ContentItem File Format

```markdown
---
id: "content-abc123"
title: "Understanding Constitutional AI"
source_type: "youtube"
source_url: "https://youtube.com/watch?v=xyz"
published_at: "2024-10-31T15:30:53Z"
metadata:
  language: "en"
  durationSeconds: 1800
  author: "Anthropic"
---

# Understanding Constitutional AI

[Transcript or article content here...]

The concept of Constitutional AI represents a breakthrough...
```

---

## 6. Agent & Skills Architecture

### 6.1 Agent Definitions

#### content-analyzer.md

```markdown
---
name: content-analyzer
description: Deep content analysis using media-reviewer skill. Extracts structure, themes, narrative flow, core ideas, and important moments.
model: haiku
tools: Read, Skill
---

# Content Analyzer Agent

Analyze content deeply to understand structure, themes, and narrative flow.

## Task

1. Read content from `contentItem/{id}.md`
2. Use **media-reviewer** skill for analysis
3. Use **content-documenter** skill for structured output

## Output

Return enriched ContentSummary JSON with:
- overview, keyThemes, detailedAnalysis
- narrativeFlow, coreIdeas, importantQuotes
- context, relatedConcepts
```

#### idea-generator.md

```markdown
---
name: idea-generator
description: Generate writing ideas (hooks, angles, questions) from content summary.
model: haiku
tools: Read, Skill
---

# Idea Generator Agent

Generate creative writing ideas from analyzed content.

## Task

1. Read ContentSummary from previous step
2. Read user-profile.json for personalization
3. Generate hooks (5 types: emotional, curiosity, controversy, statistic, story)
4. Suggest narrative angles with relevance scores
5. Formulate exploratory questions (4 types: analytical, practical, philosophical, comparative)

## Output

Return WritingIdeas JSON with hooks, angles, questions.
```

#### writing-kit-builder.md

```markdown
---
name: writing-kit-builder
description: Orchestrates full pipeline to build complete WritingKit.
model: haiku
tools: Read, Skill
---

# Writing Kit Builder Agent

Build complete WritingKit by orchestrating all subagents.

## Workflow

1. Invoke content-analyzer agent
2. Invoke idea-generator agent
3. Generate outline based on summary + ideas
4. Assemble complete WritingKit

## Output

Return WritingKit JSON with all components.
```

### 6.2 Skills Design

#### media-reviewer (from legacy)

```markdown
---
name: media-reviewer
description: Analyze media content structure, narrative flow, key themes, and important moments from videos, podcasts, and articles. Use when you need to understand content organization before documenting.
---

# Media Reviewer Skill

Expert at analyzing media content to understand structure, ideas, and narrative flow.

## What This Skill Does

- Reads media materials (text, captions, transcripts)
- Understands the ideas and concepts being presented
- Identifies narrative structure and how content progresses
- Discovers key moments, turning points, and themes
- Recognizes how content is organized and why

## Input

You receive:
- Content ID
- Content text from contentItem/{id}.md
- Content metadata (source type, title, etc.)

## Output (Implicit)

Internal analysis (structured as assistant's thinking) that will be used by content-documenter skill to generate documentation.

Focus on:
- **Content structure**: How is this organized?
- **Core ideas**: What are the main concepts?
- **Narrative flow**: How does it progress?
- **Key moments**: What are important moments?
- **Themes**: What topics emerge?
- **Documentary angle**: How would you structure this for a documentary?

## Analysis Approach

1. **Read all available content** for the given material ID
2. **Understand the context** from metadata (title, source, date)
3. **Identify main topics** and how they connect
4. **Track narrative progression** from beginning to end
5. **Extract key insights** and memorable moments
6. **Note important quotes** and (if applicable) timestamps
7. **Understand the author's intent**
8. **Recognize patterns** and recurring themes

## Important Rules

✅ Be thorough and comprehensive
✅ Understand the material deeply
✅ Preserve nuance and detail
✅ Note what makes this content unique
❌ Don't add your own analysis or interpretation
❌ Don't skip important details
❌ Don't oversimplify complex concepts
```

#### content-documenter (adapted from legacy)

```markdown
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
```

#### user-profile-reader (NEW)

```markdown
---
name: user-profile-reader
description: Read user profile from workspace and provide personalization context for content analysis and idea generation.
---

# User Profile Reader Skill

Read and interpret user preferences for content personalization.

## What This Skill Does

- Reads `user-profile.json` from workspace
- Scores content relevance to user topics
- Provides personalization context to other skills

## Input

- Path to user-profile.json (default: ~/.looplia/user-profile.json)

## Output

UserProfile object with:
- userId
- topics: Array of { topic, interestLevel (1-5) }
- style: { tone, targetWordCount, voice }

## Relevance Scoring

Calculate relevance score (0-1) by:
1. For each user topic, assign weight = interestLevel / 5
2. Check if content tags/themes match topic (case-insensitive)
3. Sum matched weights / sum total weights
4. Return score between 0 and 1

## Usage

Other skills can invoke this skill to:
- Score content relevance
- Tailor narrative angles to user tone
- Match writing style preferences
```

#### writing-enhancer (NEW, future)

```markdown
---
name: writing-enhancer
description: Rephrase or completely rewrite content matching user's preferred tone, voice, and style.
---

# Writing Enhancer Skill

Transform writing to match user's style preferences.

## What This Skill Does

- Reads WritingKit + UserProfile
- Rephrases content in user's preferred tone/voice
- Generates complete article draft (future feature)

## Input

- WritingKit JSON
- UserProfile JSON

## Output

Enhanced content matching:
- tone: beginner, intermediate, expert, mixed
- voice: first-person, third-person, instructional
- targetWordCount: Desired article length

## Important Rules

✅ Preserve original meaning and facts
✅ Match user's preferred style
✅ Maintain accuracy of quotes and data
❌ Don't add information not in source
❌ Don't change factual claims
```

---

## 7. CLI Integration

### 7.1 New Commands

#### Config Command

```typescript
// apps/cli/src/commands/config.ts

export async function runConfigCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'topics':
      await setTopics(args.slice(1));
      break;
    case 'style':
      await setStyle(args.slice(1));
      break;
    case 'show':
      await showProfile();
      break;
    default:
      printConfigHelp();
  }
}

async function setTopics(args: string[]): Promise<void> {
  const topicsStr = args[0];
  if (!topicsStr) {
    console.error('Error: Topics required');
    process.exit(1);
  }

  const topics = topicsStr.split(',').map(t => t.trim());
  const workspace = await ensureWorkspace();
  const profilePath = path.join(workspace, 'user-profile.json');

  let profile = await readProfile(profilePath);
  profile.topics = topics.map(topic => ({
    topic,
    interestLevel: 3 // Default interest level
  }));

  await writeProfile(profilePath, profile);
  console.log(`✓ Topics set: ${topics.join(', ')}`);
}

async function setStyle(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const workspace = await ensureWorkspace();
  const profilePath = path.join(workspace, 'user-profile.json');

  let profile = await readProfile(profilePath);
  if (flags.tone) profile.style.tone = flags.tone;
  if (flags['word-count']) profile.style.targetWordCount = parseInt(flags['word-count']);
  if (flags.voice) profile.style.voice = flags.voice;

  await writeProfile(profilePath, profile);
  console.log('✓ Style preferences updated');
}
```

### 7.2 Updated Kit Command

```typescript
// apps/cli/src/commands/kit.ts

import { query } from '@anthropic-ai/claude-agent-sdk';
import { ensureWorkspace, writeContentItem } from '@looplia-core/provider/claude-agent-sdk';
import { WritingKitSchema } from '@looplia-core/core';

export async function runKitCommand(args: string[]): Promise<void> {
  const flags = parseFlags(args);

  // 1. Parse input source
  const content = await loadContent(flags);

  // 2. Ensure workspace exists (bootstrap on first run)
  const workspace = await ensureWorkspace();
  // workspace = expandPath('~/.looplia')
  // On first run, copies from plugins/looplia-writer/:
  //   - agents/ → ~/.looplia/.claude/agents/
  //   - skills/ → ~/.looplia/.claude/skills/
  //   - README.md → ~/.looplia/CLAUDE.md

  // 3. Write content to workspace
  const contentId = await writeContentItem(content, workspace);
  console.log(`✓ Content copied to workspace: ${contentId}`);

  // 4. Invoke agent with workspace as cwd
  console.log('⏳ Processing content...');
  const result = query({
    prompt: `Process content item: ${contentId}`,
    options: {
      cwd: workspace,  // ~/.looplia/ (Agent SDK finds .claude/ here)
      model: 'claude-haiku-4-5-20251001',
      allowedTools: ['Read', 'Skill'],
      outputFormat: {
        type: 'json_schema',
        schema: zodToJsonSchema(WritingKitSchema)
      },
      permissionMode: 'bypassPermissions'
    }
  });

  // 5. Parse result
  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      const kit = message.structured_output as WritingKit;

      // 6. Output result
      if (flags.format === 'markdown') {
        printMarkdown(kit);
      } else {
        console.log(JSON.stringify(kit, null, 2));
      }

      // 7. Show usage stats
      if (message.usage) {
        console.error(`\n📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);
        console.error(`💰 Cost: $${message.total_cost_usd?.toFixed(4)}`);
      }

      return;
    }

    if (message.type === 'result' && message.subtype !== 'success') {
      console.error('Error:', message.errors?.join(', ') || 'Unknown error');
      process.exit(1);
    }
  }
}

async function loadContent(flags: Record<string, string>): Promise<ContentItem> {
  if (flags.file) {
    return loadFromFile(flags.file);
  } else if (flags.url) {
    return loadFromUrl(flags.url);
  } else if (flags.youtube) {
    return loadFromYouTube(flags.youtube);
  } else {
    console.error('Error: Must specify --file, --url, or --youtube');
    process.exit(1);
  }
}
```

### 7.3 Content I/O Functions

```typescript
// packages/provider/src/claude-agent-sdk/content-io.ts

import type { ContentItem } from '@looplia-core/core';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Write ContentItem to workspace as markdown file
 */
export async function writeContentItem(
  content: ContentItem,
  workspace: string
): Promise<string> {
  const contentDir = path.join(workspace, 'contentItem');
  await ensureDir(contentDir);

  const filePath = path.join(contentDir, `${content.id}.md`);

  // Create markdown with frontmatter
  const markdown = `---
id: "${content.id}"
title: "${content.title}"
source_type: "${content.source.type}"
source_url: "${content.url}"
published_at: "${content.publishedAt || new Date().toISOString()}"
metadata:
  language: "${content.metadata.language || 'en'}"
  ${content.metadata.author ? `author: "${content.metadata.author}"` : ''}
  ${content.metadata.durationSeconds ? `durationSeconds: ${content.metadata.durationSeconds}` : ''}
---

# ${content.title}

${content.rawText}
`;

  await writeFile(filePath, markdown, 'utf-8');
  return content.id;
}
```

---

## 8. Implementation Plan

### 8.1 Phase 1: Domain Type Enhancement

**Goal:** Extend domain types with enhanced fields

**Files to modify:**
- `packages/core/src/domain/core-idea.ts` (new)
- `packages/core/src/domain/quote.ts` (new)
- `packages/core/src/domain/summary.ts` (add 8 new fields)
- `packages/core/src/domain/index.ts` (export new types)
- `packages/core/src/validation/schemas.ts` (add validation)

**New types:**
```typescript
CoreIdea { concept, explanation, examples? }
Quote { text, timestamp?, context? }
```

**Enhanced ContentSummary with:**
- overview, keyThemes, detailedAnalysis, narrativeFlow
- coreIdeas[], importantQuotes[], context, relatedConcepts[]

**Validation:**
- Update ContentSummarySchema with new fields
- Add CoreIdeaSchema and QuoteSchema

### 8.2 Phase 2: Dual-Purpose Plugin Files

**Goal:** Create dual-purpose plugin structure

**Files to create at project root (for Claude Code plugin):**

1. **`.claude-plugin/plugin.json`** - Root plugin metadata
```json
{
  "name": "looplia-core",
  "version": "0.3.0",
  "description": "Looplia content intelligence framework",
  "author": "Looplia",
  "homepage": "https://github.com/looplia/looplia-core"
}
```

2. **`.claude/`** - General Claude Code structure (can be empty or have general agents/skills)

**Files to create in plugins/looplia-writer/ (for CLI bootstrap):**

1. **`plugins/looplia-writer/.claude-plugin/plugin.json`** - Looplia writer plugin metadata
```json
{
  "name": "looplia-writer",
  "version": "0.3.0",
  "description": "Looplia writing assistant with content analysis and idea generation",
  "author": "Looplia",
  "homepage": "https://github.com/looplia/looplia-core/tree/main/plugins/looplia-writer"
}
```

2. **`plugins/looplia-writer/README.md`** - Plugin mission (becomes CLAUDE.md in workspace)
3. **`plugins/looplia-writer/agents/content-analyzer.md`** - Deep analysis agent
4. **`plugins/looplia-writer/agents/idea-generator.md`** - Ideas generation agent
5. **`plugins/looplia-writer/agents/writing-kit-builder.md`** - Pipeline orchestrator
6. **`plugins/looplia-writer/skills/media-reviewer/SKILL.md`** - From legacy (copy)
7. **`plugins/looplia-writer/skills/content-documenter/SKILL.md`** - From legacy (adapt)
8. **`plugins/looplia-writer/skills/user-profile-reader/SKILL.md`** - New skill
9. **`plugins/looplia-writer/skills/writing-enhancer/SKILL.md`** - New skill (placeholder)

**Source for legacy skills:**
- Copy from `/temp-agent/writing-agent/.claude/skills/`
- Adapt `content-documenter` to output JSON fields instead of markdown

### 8.3 Phase 3: Provider Package Implementation

**Goal:** Implement workspace bootstrap from looplia-writer plugin

**Files to create:**
- `packages/provider/src/claude-agent-sdk/content-io.ts`
  - `writeContentItem(content, workspace)` - Write to contentItem/
  - `readUserProfile(workspace)` - Read user-profile.json

**Files to modify:**
- `packages/provider/src/claude-agent-sdk/workspace.ts`
  - Update `ensureWorkspace()` with bootstrap logic:
    - Copy `plugins/looplia-writer/agents/` → `~/.looplia/.claude/agents/`
    - Copy `plugins/looplia-writer/skills/` → `~/.looplia/.claude/skills/`
    - Copy `plugins/looplia-writer/README.md` → `~/.looplia/CLAUDE.md` (rename!)
    - Create `contentItem/` directory
    - Initialize default `user-profile.json`
  - Add `getWorkspacePath()` helper - Return `~/.looplia/` path
  - Add `getPluginPath()` helper - Return `plugins/looplia-writer/` path
  - Preserve existing workspace (skip if already exists)

- `packages/provider/src/claude-agent-sdk/index.ts`
  - Update to use `expandPath('~/.looplia')` as SDK cwd
  - Export workspace functions
  - Deprecate old provider functions

**Bootstrap Implementation:**
```typescript
async function ensureWorkspace(): Promise<string> {
  const workspaceDir = expandPath('~/.looplia');
  const projectRoot = process.cwd(); // Assuming CLI runs from project root
  const pluginDir = path.join(projectRoot, 'plugins', 'looplia-writer');

  if (!fs.existsSync(workspaceDir)) {
    // First run: Bootstrap workspace from looplia-writer plugin
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(path.join(workspaceDir, '.claude'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'contentItem'), { recursive: true });

    // Copy agents/ from plugin to workspace
    await fs.cp(
      path.join(pluginDir, 'agents'),
      path.join(workspaceDir, '.claude', 'agents'),
      { recursive: true }
    );

    // Copy skills/ from plugin to workspace
    await fs.cp(
      path.join(pluginDir, 'skills'),
      path.join(workspaceDir, '.claude', 'skills'),
      { recursive: true }
    );

    // Copy README.md and rename to CLAUDE.md
    await fs.copyFile(
      path.join(pluginDir, 'README.md'),
      path.join(workspaceDir, 'CLAUDE.md')
    );

    // Create default user profile
    await fs.writeFile(
      path.join(workspaceDir, 'user-profile.json'),
      JSON.stringify({
        userId: 'default',
        topics: [],
        style: {
          tone: 'intermediate',
          targetWordCount: 1000,
          voice: 'first-person'
        }
      }, null, 2)
    );

    console.log('✓ Workspace initialized at ~/.looplia/');
    console.log('✓ Copied looplia-writer agents and skills from plugin');
  }

  return workspaceDir;
}
```

### 8.4 Phase 4: CLI Updates

**Goal:** Implement new CLI commands and workflows

**Files to create:**
- `apps/cli/src/commands/config.ts`
  - `setTopics(topics)` - Configure user topics
  - `setStyle(flags)` - Configure writing style
  - `showProfile()` - Display current profile

**Files to modify:**
- `apps/cli/src/commands/kit.ts`
  - Call `ensureWorkspace()` before processing (bootstraps on first run)
  - Use `writeContentItem()` to copy input to `~/.looplia/contentItem/`
  - Invoke agent with `cwd: expandPath('~/.looplia')` (workspace)
  - Support --file, --url, --youtube

- `apps/cli/src/index.ts`
  - Add 'config' command routing

### 8.5 Phase 5: Documentation

**Goal:** Document new architecture

**Files to create:**
- `docs/DESIGN-0.3.md` (this file)
- `docs/MIGRATION-0.2-to-0.3.md` - Migration guide

**Files to update:**
- `docs/DESIGN-0.2.md` - Mark as superseded
- `README.md` - Update examples

---

## 9. Migration from v0.2

### 9.1 Breaking Changes

1. **Provider API removed:**
   ```typescript
   // v0.2 (REMOVED)
   const providers = createClaudeProviders();
   const result = await buildWritingKit(content, user, providers);

   // v0.3 (NEW)
   const workspace = await ensureWorkspace();
   await writeContentItem(content, workspace);
   const result = await invokeAgent(workspace, content.id);
   ```

2. **ContentSummary schema changed:**
   - Added 8 required fields
   - Old summaries will fail validation
   - Migration: Set default values for new fields

3. **Workspace structure changed:**
   ```
   v0.2: ~/.looplia/agents/              (flat structure)
   v0.3: ~/.looplia/.claude/agents/      (nested, matches Claude Code pattern)

   Plugin template location:
   v0.3: plugins/looplia-writer/         (source for CLI bootstrap)
         plugins/looplia-writer/README.md → ~/.looplia/CLAUDE.md
         plugins/looplia-writer/agents/ → ~/.looplia/.claude/agents/
         plugins/looplia-writer/skills/ → ~/.looplia/.claude/skills/
   ```

### 9.2 Migration Steps

1. **Update dependencies:**
   ```bash
   bun update @looplia-core/core@0.3.0
   bun update @looplia-core/provider@0.3.0
   ```

2. **Clear old workspace:**
   ```bash
   rm -rf ~/.looplia/agents
   rm -rf ~/.looplia/skills
   ```

3. **Initialize new workspace:**
   ```bash
   looplia config topics "your,topics,here"
   looplia config style --tone expert --word-count 1500
   ```

4. **Update code:**
   - Replace provider calls with agent invocations
   - Handle new ContentSummary fields
   - Use workspace-based flow

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Domain Types:**
```typescript
// packages/core/test/domain/enhanced-summary.test.ts

describe('Enhanced ContentSummary', () => {
  it('should validate complete summary', () => {
    const summary: ContentSummary = {
      // ... core fields ...
      overview: 'Rich overview paragraph...',
      keyThemes: ['AI', 'Safety', 'Alignment'],
      detailedAnalysis: 'Detailed analysis...',
      narrativeFlow: 'Content progresses from...',
      coreIdeas: [{
        concept: 'Constitutional AI',
        explanation: 'An approach to...',
        examples: ['Example 1']
      }],
      importantQuotes: [{
        text: 'Quote here',
        timestamp: '12:34',
        context: 'Said during discussion of...'
      }],
      context: 'Background context...',
      relatedConcepts: ['RLHF', 'Red teaming']
    };

    const result = validateContentSummary(summary);
    expect(result.success).toBe(true);
  });
});
```

**Workspace Operations:**
```typescript
// packages/provider/test/claude-agent-sdk/content-io.test.ts

describe('writeContentItem', () => {
  it('should write content to workspace', async () => {
    const workspace = await createTempWorkspace();
    const content = createTestContent();

    const id = await writeContentItem(content, workspace);

    const filePath = path.join(workspace, 'contentItem', `${id}.md`);
    expect(fs.existsSync(filePath)).toBe(true);

    const fileContent = await fs.readFile(filePath, 'utf-8');
    expect(fileContent).toContain('---');
    expect(fileContent).toContain(`id: "${content.id}"`);
  });
});
```

### 10.2 Integration Tests

```typescript
// packages/provider/test/claude-agent-sdk/workspace-flow.test.ts

describe('Workspace Agent Flow', () => {
  it('should process content through full pipeline', async () => {
    const workspace = await ensureWorkspace();
    const content = createTestContent();

    // Write content
    await writeContentItem(content, workspace);

    // Configure user profile
    await writeProfile(workspace, {
      userId: 'test',
      topics: [{ topic: 'ai', interestLevel: 5 }],
      style: { tone: 'expert', targetWordCount: 1000, voice: 'first-person' }
    });

    // Invoke agent
    const kit = await invokeAgent(workspace, content.id);

    // Verify enhanced summary
    expect(kit.summary.overview).toBeDefined();
    expect(kit.summary.keyThemes.length).toBeGreaterThan(0);
    expect(kit.summary.coreIdeas.length).toBeGreaterThan(0);
  });
});
```

### 10.3 CLI E2E Tests

```typescript
// apps/cli/test/e2e/workspace-commands.test.ts

describe('CLI Workspace Commands', () => {
  it('should configure user profile', async () => {
    await exec('looplia config topics "ai,productivity"');
    await exec('looplia config style --tone expert --word-count 1500');

    const output = await exec('looplia config show');
    expect(output).toContain('ai');
    expect(output).toContain('expert');
  });

  it('should process content with workspace', async () => {
    const output = await exec('looplia kit --file test-article.txt --format json');
    const kit = JSON.parse(output);

    expect(kit.summary.overview).toBeDefined();
    expect(kit.summary.keyThemes).toBeInstanceOf(Array);
  });
});
```

---

## 11. Future Roadmap

### 11.1 Vision: General-Purpose Agent Framework

**The looplia-writer plugin (v0.3) is the first milestone** in a larger vision: Looplia as a **general-purpose agent framework** where any workflow can be defined as a plugin.

#### Pluggable Agent Architecture

**Future Plugin Ecosystem:**
```
looplia-core/
├── plugins/
│   ├── looplia-writer/          # ✅ v0.3 - Writing workflows (CURRENT)
│   ├── looplia-coder/           # Future - Code generation workflows
│   ├── looplia-researcher/      # Future - Research workflows
│   ├── looplia-analyst/         # Future - Data analysis workflows
│   └── [custom-plugins]/        # Future - Community plugins
```

**Key Concept:**
- Each plugin = specialized agent persona with specific workflows
- CLI triggers workflows based on plugin context
- Subagents and skills composed dynamically per workflow
- Users can install/switch between agent personas

**Example Future Usage:**
```bash
# Install writer agent (v0.3)
looplia plugin install writer
looplia kit --file article.txt  # Uses writer workflow

# Install coder agent (future)
looplia plugin install coder
looplia code --file spec.md     # Uses coding workflow

# Install researcher agent (future)
looplia plugin install researcher
looplia research --topic "AI safety"  # Uses research workflow
```

#### Workflow as Configuration

Each plugin defines:
1. **Main Mission** (README.md → CLAUDE.md) - Agent persona and goals
2. **Workflow Steps** - Series of prompts/tasks to accomplish mission
3. **Subagents** - Specialized agents for workflow steps
4. **Skills** - Reusable capabilities across workflows

**Example: Writer Workflow (v0.3 - Current)**
```
User: looplia kit --file article.txt
  ↓
Step 1: Analyze content (media-reviewer skill)
  ↓
Step 2: Document structure (content-documenter skill)
  ↓
Step 3: Generate ideas (idea-generator agent)
  ↓
Step 4: Build outline (writing-kit-builder agent)
  ↓
Output: WritingKit JSON
```

**Example: Future Coder Workflow**
```
User: looplia code --file spec.md
  ↓
Step 1: Analyze requirements (spec-analyzer skill)
  ↓
Step 2: Design architecture (architect agent)
  ↓
Step 3: Generate code (code-generator agent)
  ↓
Step 4: Write tests (test-writer agent)
  ↓
Output: CodeProject structure
```

#### Extended Plugin Metadata (Future)

Future plugin.json can define workflows:
```json
{
  "name": "looplia-writer",
  "version": "0.3.0",
  "description": "Writing assistant",
  "workflows": [
    {
      "name": "kit",
      "description": "Generate writing kit from content",
      "steps": ["analyze", "document", "ideate", "outline"],
      "output": "WritingKit"
    },
    {
      "name": "enhance",
      "description": "Enhance existing writing",
      "steps": ["review", "style-match", "rewrite"],
      "output": "EnhancedContent"
    }
  ],
  "agents": ["content-analyzer", "idea-generator", "writing-kit-builder"],
  "skills": ["media-reviewer", "content-documenter", "user-profile-reader"]
}
```

#### Why v0.3 Matters

**v0.3 (Writing Agent) proves the concept:**
- ✅ Plugin-based agent architecture works
- ✅ Workspace bootstrap enables agent switching
- ✅ Skills can be composed into workflows
- ✅ CLI can trigger agentic workflows
- ✅ README.md → CLAUDE.md pattern supports discoverability

**Future expansion becomes straightforward:**
- New plugins add new agent personas
- Same infrastructure, different workflows
- Users can create custom agents
- Community can share agent plugins

**Looplia's Evolution:**
- **v0.1-0.2**: "Content intelligence CLI"
- **v0.3**: "Writing assistant agent" ← **We are here (POC)**
- **v0.4+**: "General-purpose agent framework"

### 11.2 v0.3.1 - Polish & Refinement

- [ ] Improve agent prompts based on usage feedback
- [ ] Add progress indicators during agent execution
- [ ] Optimize skill composition for faster processing
- [ ] Add caching for repeated content processing

### 11.3 v0.4 - Plugin Infrastructure

- [ ] Extract common patterns from looplia-writer
- [ ] Implement `looplia plugin` command (install, list, switch)
- [ ] Add plugin version management
- [ ] Support multiple installed plugins
- [ ] Plugin isolation and sandboxing

### 11.4 v0.5 - Workflow Configuration

- [ ] Workflow definition in plugin.json
- [ ] Dynamic workflow execution based on config
- [ ] Workflow step composition
- [ ] Cross-plugin skill sharing

### 11.5 v0.6 - Community & Collaboration

- [ ] Plugin registry/marketplace
- [ ] Community plugin submission
- [ ] Shared workspace support
- [ ] Team profiles and collaboration features
- [ ] Plugin templates for creators

---

## Appendix A: File Checklist

### New Files (16)

**Root Plugin Files (2):**
```
.claude-plugin/plugin.json                  # Root plugin metadata for Claude Code
.claude/                                     # General Claude Code structure (can be empty)
```

**Looplia Writer Plugin Files (11):**
```
plugins/looplia-writer/.claude-plugin/plugin.json  # Looplia writer plugin metadata
plugins/looplia-writer/README.md                    # Plugin mission (→ CLAUDE.md in workspace)
plugins/looplia-writer/agents/content-analyzer.md
plugins/looplia-writer/agents/idea-generator.md
plugins/looplia-writer/agents/writing-kit-builder.md
plugins/looplia-writer/skills/media-reviewer/SKILL.md
plugins/looplia-writer/skills/content-documenter/SKILL.md
plugins/looplia-writer/skills/user-profile-reader/SKILL.md
plugins/looplia-writer/skills/writing-enhancer/SKILL.md
```

**Core Domain Types (2):**
```
packages/core/src/domain/quote.ts
packages/core/src/domain/core-idea.ts
```

**Provider Implementation (1):**
```
packages/provider/src/claude-agent-sdk/content-io.ts
```

**CLI Commands (1):**
```
apps/cli/src/commands/config.ts
```

### Modified Files (7)

```
packages/core/src/domain/summary.ts          # Add 8 new fields
packages/core/src/domain/index.ts            # Export new types
packages/core/src/validation/schemas.ts      # Add validation for new fields
packages/provider/src/claude-agent-sdk/workspace.ts  # Bootstrap from plugins/looplia-writer/
packages/provider/src/claude-agent-sdk/index.ts      # Use ~/.looplia/ as SDK cwd
apps/cli/src/commands/kit.ts                 # Use workspace flow
apps/cli/src/index.ts                        # Add config command
```

---

## Appendix B: Example Workflow

### User Workflow

```bash
# 1. Configure profile
looplia config topics "AI, machine learning, safety"
looplia config style --tone expert --word-count 2000 --voice first-person

# 2. Process content
looplia kit --file article.txt --format json > kit.json

# 3. View results
cat kit.json | jq '.summary.overview'
cat kit.json | jq '.summary.keyThemes'
cat kit.json | jq '.summary.importantQuotes'

# 4. Future: Enhance with style
looplia enhance --kit kit.json --output article.md
```

### Expected Output Structure

```json
{
  "contentId": "abc123",
  "source": { "id": "...", "label": "...", "url": "..." },
  "summary": {
    "contentId": "abc123",
    "headline": "Understanding Constitutional AI: A New Approach to AI Safety",
    "tldr": "Constitutional AI represents a breakthrough in AI alignment...",
    "bullets": ["Point 1", "Point 2", "Point 3"],
    "tags": ["AI", "safety", "alignment", "constitutional-ai"],
    "sentiment": "positive",
    "category": "technical-article",
    "score": { "relevanceToUser": 0.92 },

    "overview": "This article explores Constitutional AI, a novel approach...\n\nThe method builds on previous work...\n\nKey innovations include...",
    "keyThemes": [
      "Constitutional AI methodology",
      "AI safety and alignment",
      "RLHF limitations",
      "Scalable oversight"
    ],
    "detailedAnalysis": "The article begins by establishing context...",
    "narrativeFlow": "Content progresses from problem statement (RLHF limitations) to solution (Constitutional AI) to implementation details to results.",
    "coreIdeas": [
      {
        "concept": "Constitutional AI",
        "explanation": "An approach to AI alignment that uses a constitution...",
        "examples": ["Harmlessness constitution", "Helpfulness constitution"]
      }
    ],
    "importantQuotes": [
      {
        "text": "The key insight is that we can use AI to supervise AI",
        "context": "Explaining the core mechanism of Constitutional AI"
      }
    ],
    "context": "Builds on RLHF (Reinforcement Learning from Human Feedback) and prior alignment research. Assumes familiarity with transformer models.",
    "relatedConcepts": ["RLHF", "red teaming", "scalable oversight", "AI alignment"]
  },
  "ideas": { /* ... */ },
  "suggestedOutline": [ /* ... */ ],
  "meta": { "relevanceToUser": 0.92, "estimatedReadingTimeMinutes": 8 }
}
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.3 | 2025-12-07 | Initial v0.3 design: agent-centric workspace, enhanced domain types, legacy skill integration |
