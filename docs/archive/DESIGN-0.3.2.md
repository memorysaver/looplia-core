# Looplia Core – Technical Design Document v0.3.2

**Version:** 0.3.2
**Status:** Draft
**Last Updated:** 2025-12-09

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Architecture](#3-architecture)
4. [Kit Command Design](#4-kit-command-design)
5. [Subagent Specifications](#5-subagent-specifications)
6. [Session Management](#6-session-management)
7. [Workspace Structure](#7-workspace-structure)
8. [Implementation Plan](#8-implementation-plan)
9. [Migration from v0.3.1](#9-migration-from-v031)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Overview

### 1.1 Purpose

v0.3.2 refines the agentic architecture introduced in v0.3.1 with:

- **Simplified main agent** - Pure orchestrator, no business logic
- **Clear subagent responsibilities** - 3 subagents with distinct roles
- **Smart continuation** - Agent-controlled resume of interrupted sessions
- **Session-based identity** - Rename `content-id` to `session-id`

### 1.2 Key Changes from v0.3.1

| Aspect | v0.3.1 | v0.3.2 |
|--------|--------|--------|
| **Main Agent Role** | Some inline logic (outline generation) | Pure orchestrator only |
| **Subagent Count** | 2 (content-analyzer, idea-generator) | 3 (+writing-kit-builder) |
| **Outline Generation** | Main agent inline | writing-kit-builder subagent |
| **CLI Flag** | `--content-id` | `--session-id` |
| **Continuation Logic** | Hardcoded in TypeScript | Agent-controlled |

### 1.3 Design Principles

1. **CLI → ONE Prompt** - Each CLI command maps to exactly one SDK prompt
2. **Main Agent = Orchestrator** - Only invokes subagents, no business logic
3. **Agent-Controlled Flow** - Agent decides what work is needed based on session state
4. **Flat Folder Structure** - All session files at same level, no subfolders

---

## 2. Problem Statement

### 2.1 v0.3.1 Issues

The v0.3.1 kit command fails with:
```
Error: Success subtype but no structured_output
```

**Root cause:** The orchestrating agent returns conversational text instead of using `StructuredOutput` tool.

**Evidence from SDK logs:**
```
Summarize (works): Agent used StructuredOutput tool → structured_output field present ✓
Kit (fails): Agent returned text → structured_output undefined ✗
```

### 2.2 Architecture Issues

1. **Mixed responsibilities** - Main agent does both orchestration AND outline generation
2. **Unclear continuation** - Logic split between TypeScript and agent
3. **Confusing terminology** - `content-id` suggests content identity, not work session

---

## 3. Architecture

### 3.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ARCHITECTURE OVERVIEW                                                      │
│                                                                             │
│  CLI Command ──► ONE Prompt ──► Main Agent ──► Subagents (sequential)       │
│                                     │                                       │
│                                     └──► Main Agent decides when to stop    │
│                                          (by detecting existing files)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility | Does NOT do |
|-----------|---------------|-------------|
| **CLI (TypeScript)** | Parse args, write content.md, send ONE prompt | Business logic, orchestration |
| **Main Agent** | Check session state, invoke subagents, return result | Content analysis, idea generation, outline creation |
| **content-analyzer** | Deep content analysis using skills | Anything else |
| **idea-generator** | Generate hooks, angles, questions | Anything else |
| **writing-kit-builder** | Create outline, assemble final WritingKit | Anything else |

### 3.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATA FLOW                                                                  │
│                                                                             │
│  content.md ──► content-analyzer ──► summary.json                           │
│                                           │                                 │
│                                           ▼                                 │
│                                    idea-generator ──► ideas.json            │
│                                           │               │                 │
│                                           ▼               ▼                 │
│                                    writing-kit-builder ──► outline.json     │
│                                           │                   │             │
│                                           └───────────────────┘             │
│                                                   │                         │
│                                                   ▼                         │
│                                            writing-kit.json                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Kit Command Design

### 4.1 CLI Interface

```bash
# Start fresh session from file
looplia kit --file article.txt [--topics "ai,safety"] [--tone expert]

# Continue existing session
looplia kit --session-id abc123

# Output options
looplia kit --file article.txt --format markdown --output kit.md
```

### 4.2 Command Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLI: looplia kit --file article.txt                                        │
│       looplia kit --session-id abc123                                       │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PRE-PROCESSING (TypeScript) - Minimal logic                                │
│                                                                             │
│  1. Parse CLI arguments                                                     │
│  2. If --file: Create NEW session-id, write content.md                      │
│     If --session-id: Use existing session                                   │
│  3. Send ONE prompt to SDK                                                  │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SDK CALL (Single Session) - ONE PROMPT                                     │
│                                                                             │
│  query({                                                                    │
│    prompt: kitPrompt,                                                       │
│    options: {                                                               │
│      cwd: "~/.looplia/",                                                    │
│      outputFormat: { type: "json_schema", schema: WRITING_KIT_SCHEMA }      │
│    }                                                                        │
│  })                                                                         │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAIN AGENT - Simple Orchestrator                                           │
│                                                                             │
│  1. Check session folder for existing files                                 │
│     ├─► Glob contentItem/{id}/*.json                                        │
│     └─► Decide which subagents to invoke                                    │
│                                                                             │
│  2. IF summary.json missing:                                                │
│     ├─► Invoke content-analyzer subagent (Task tool)                        │
│     └─► Wait for completion (AgentOutputTool)                               │
│                                                                             │
│  3. IF ideas.json missing:                                                  │
│     ├─► Invoke idea-generator subagent (Task tool)                          │
│     └─► Wait for completion (AgentOutputTool)                               │
│                                                                             │
│  4. IF writing-kit.json missing:                                            │
│     ├─► Invoke writing-kit-builder subagent (Task tool)                     │
│     │   └─► Creates outline.json + writing-kit.json                         │
│     └─► Wait for completion (AgentOutputTool)                               │
│                                                                             │
│  5. Return:                                                                 │
│     ├─► Read writing-kit.json                                               │
│     └─► Return via StructuredOutput tool                                    │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  POST-PROCESSING (TypeScript)                                               │
│                                                                             │
│  1. Receive WritingKit from structured_output                               │
│  2. Format as JSON or Markdown                                              │
│  3. Output to stdout or file                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Prompt Design

```typescript
// CLI: looplia kit --session-id {id}
// Maps to this ONE prompt:

const kitPrompt = `
Task: Build WritingKit for session: contentItem/${sessionId}

## Check Existing Progress
First, check which files already exist in contentItem/${sessionId}/:
- summary.json → If exists, skip content-analyzer
- ideas.json → If exists, skip idea-generator
- writing-kit.json → If exists, return it directly

## Sequential Workflow (invoke only what's needed)

Step 1: IF summary.json missing:
  → Invoke content-analyzer subagent for contentItem/${sessionId}/content.md
  → Wait for completion → summary.json created

Step 2: IF ideas.json missing:
  → Invoke idea-generator subagent for contentItem/${sessionId}/summary.json
  → Wait for completion → ideas.json created

Step 3: IF writing-kit.json missing:
  → Invoke writing-kit-builder subagent for contentItem/${sessionId}/
  → Wait for completion → outline.json + writing-kit.json created

Step 4: Return
  → Read writing-kit.json
  → Return as structured output
`;
```

---

## 5. Subagent Specifications

### 5.1 Subagent Overview

| Subagent | When Invoked | Input | Output |
|----------|--------------|-------|--------|
| **content-analyzer** | IF summary.json missing | content.md | summary.json |
| **idea-generator** | IF ideas.json missing | summary.json | ideas.json |
| **writing-kit-builder** | IF writing-kit.json missing | summary.json, ideas.json | outline.json, writing-kit.json |

### 5.2 content-analyzer

**File:** `~/.looplia/.claude/agents/content-analyzer.md`

```markdown
---
name: content-analyzer
description: Deep content analysis using media-reviewer skill.
model: haiku
tools: Read, Skill
---

# Content Analyzer Agent

Analyze content deeply to understand structure, themes, narrative flow.

## Task

1. Read content from `contentItem/{id}/content.md`
2. Detect source type (podcast, article, transcript, etc.)
3. Use **media-reviewer** skill for deep analysis
4. Use **content-documenter** skill for structured output
5. Write output to: `contentItem/{id}/summary.json`

## Output Schema

ContentSummary with all 15 fields:
- Core: contentId, headline, tldr, bullets, tags, sentiment, category, score
- Documentary: overview, keyThemes, detailedAnalysis, narrativeFlow,
  coreIdeas, importantQuotes, context, relatedConcepts
```

### 5.3 idea-generator

**File:** `~/.looplia/.claude/agents/idea-generator.md`

```markdown
---
name: idea-generator
description: Generate writing ideas from content summary.
model: haiku
tools: Read
---

# Idea Generator Agent

Generate creative writing ideas from analyzed content.

## Task

1. Read ContentSummary from `contentItem/{id}/summary.json`
2. Read user-profile.json for personalization
3. Generate hooks (5 types: emotional, curiosity, controversy, statistic, story)
4. Suggest narrative angles with relevance scores
5. Formulate exploratory questions (4 types)
6. Write output to: `contentItem/{id}/ideas.json`

## Output Schema

WritingIdeas:
- hooks: Array of { text, type }
- angles: Array of { title, description, relevanceScore }
- questions: Array of { question, type }
```

### 5.4 writing-kit-builder

**File:** `~/.looplia/.claude/agents/writing-kit-builder.md`

```markdown
---
name: writing-kit-builder
description: Create outline and assemble final WritingKit.
model: haiku
tools: Read, Write
---

# Writing Kit Builder Agent

Build complete WritingKit by creating outline and assembling all components.

## Task

1. Read `contentItem/{id}/summary.json`
2. Read `contentItem/{id}/ideas.json`
3. Read `user-profile.json` for target word count
4. Generate article outline:
   - Section headings with writing notes
   - Estimated word counts per section
   - Total matches user's targetWordCount
5. Write outline to: `contentItem/{id}/outline.json`
6. Assemble final WritingKit:
   - Combine summary + ideas + outline
   - Calculate meta (relevanceToUser, estimatedReadingTimeMinutes)
7. Write to: `contentItem/{id}/writing-kit.json`

## Output Schema

WritingKit:
- contentId: string
- source: { id, label, url }
- summary: ContentSummary
- ideas: WritingIdeas
- suggestedOutline: OutlineSection[]
- meta: { relevanceToUser, estimatedReadingTimeMinutes }
```

---

## 6. Session Management

### 6.1 Session Identity

**Rename:** `content-id` → `session-id`

The term `session-id` better reflects that this represents a work session, not just content identity.

```bash
# OLD
looplia kit --content-id abc123

# NEW
looplia kit --session-id abc123
```

### 6.2 Fresh Session (`--file`)

```
looplia kit --file article.txt
  │
  └─► Always creates NEW session with NEW session-id
      └─► Starts from scratch even if same file was processed before
```

- Generates unique session-id (e.g., `article-2025-12-09-abc123`)
- Writes content to `contentItem/{session-id}/content.md`
- Runs full workflow from beginning

### 6.3 Continue Session (`--session-id`)

```
looplia kit --session-id abc123
  │
  └─► Agent reads contentItem/abc123/ and detects existing files:
      │
      ├─► If only content.md exists:
      │   └─► Run full workflow (content-analyzer → idea-generator → writing-kit-builder)
      │
      ├─► If summary.json exists:
      │   └─► Skip content-analyzer, continue (idea-generator → writing-kit-builder)
      │
      ├─► If ideas.json exists:
      │   └─► Skip first two, continue (writing-kit-builder only)
      │
      └─► If writing-kit.json exists:
          └─► Return existing kit directly
```

### 6.4 Agent-Controlled Continuation

**Key Design Principle:** The agent decides what work is needed. No hardcoded control logic in TypeScript.

Benefits:
1. Lets the agent decide what work is needed
2. No hardcoded control logic in TypeScript
3. Enables resuming interrupted sessions
4. Saves API costs by reusing existing analysis

---

## 7. Workspace Structure

### 7.1 Flat Folder Structure

All files for a session live at the same level (no subfolders):

```
~/.looplia/
├── CLAUDE.md                    # Agent mission file
├── user-profile.json            # User preferences
├── .claude/
│   ├── agents/
│   │   ├── content-analyzer.md
│   │   ├── idea-generator.md
│   │   └── writing-kit-builder.md
│   └── skills/
│       ├── media-reviewer/
│       │   └── SKILL.md
│       └── content-documenter/
│           └── SKILL.md
└── contentItem/
    └── {session-id}/
        ├── content.md           # Source content (input)
        ├── summary.json         # From content-analyzer
        ├── ideas.json           # From idea-generator
        ├── outline.json         # From writing-kit-builder
        └── writing-kit.json     # Final assembled output
```

### 7.2 File I/O Sequence

| Step | Agent | Reads | Writes |
|------|-------|-------|--------|
| 1 | Main | Check *.json files | - |
| 2 | content-analyzer | content.md | summary.json |
| 3 | idea-generator | summary.json, user-profile.json | ideas.json |
| 4 | writing-kit-builder | summary.json, ideas.json, user-profile.json | outline.json, writing-kit.json |
| 5 | Main | writing-kit.json | - (returns via StructuredOutput) |

---

## 8. Implementation Plan

### 8.1 Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `docs/DESIGN-0.3.2.md` | CREATE | This document |
| `apps/cli/src/commands/kit.ts` | UPDATE | Use WritingKitProvider, rename --content-id to --session-id |
| `apps/cli/src/commands/summarize.ts` | UPDATE | Rename --content-id to --session-id |
| `packages/provider/src/claude-agent-sdk/writing-kit-provider.ts` | UPDATE | Update prompt for smart continuation |
| `plugins/looplia-writer/agents/writing-kit-builder.md` | UPDATE | Add outline generation responsibility |

### 8.2 Implementation Steps

1. **Update CLI commands** - Rename `--content-id` to `--session-id`
2. **Update kit.ts** - Use `createClaudeWritingKitProvider()` instead of `createClaudeProviders()`
3. **Update writing-kit-provider.ts** - New prompt design with smart continuation
4. **Update writing-kit-builder.md** - Add outline creation responsibility
5. **Update tests** - Verify all commands work with new flags

---

## 9. Migration from v0.3.1

### 9.1 Breaking Changes

| Change | Impact | Migration |
|--------|--------|-----------|
| `--content-id` → `--session-id` | CLI flag renamed | Update scripts/commands |
| Outline generation moved | Internal change | No user impact |

### 9.2 Backward Compatibility

- Existing session folders remain valid
- JSON output schemas unchanged
- User profile format unchanged

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
describe('Kit Command', () => {
  it('should create new session with --file', async () => {
    const output = await exec('looplia kit --file test.txt --mock');
    expect(output).toContain('session-id');
  });

  it('should continue existing session with --session-id', async () => {
    // Create session first
    await exec('looplia summarize --file test.txt --mock');
    // Continue with kit
    const output = await exec('looplia kit --session-id <id> --mock');
    expect(output).toContain('writing-kit.json');
  });
});
```

### 10.2 Integration Tests

```typescript
describe('Smart Continuation', () => {
  it('should skip content-analyzer if summary.json exists', async () => {
    // Setup: Create summary.json manually
    // Run: looplia kit --session-id <id>
    // Verify: content-analyzer not invoked
  });

  it('should run full workflow if only content.md exists', async () => {
    // Setup: Create only content.md
    // Run: looplia kit --session-id <id>
    // Verify: All 3 subagents invoked
  });
});
```

### 10.3 E2E Tests

```bash
# Test fresh session
looplia kit --file ./examples/ai-healthcare.md --format json

# Test continuation
looplia summarize --file ./examples/ai-healthcare.md
looplia kit --session-id <id-from-above>

# Test all output files created
ls ~/.looplia/contentItem/<session-id>/
# Should show: content.md, summary.json, ideas.json, outline.json, writing-kit.json
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.3.2 | 2025-12-09 | Initial v0.3.2 design: 3-subagent architecture, session-id, smart continuation |
