# Looplia-Core: Agentic Architecture & Design (v0.3.1)

## Executive Summary

Looplia-core implements a **true agentic architecture** where autonomous agents read natural-language instructions from markdown files and invoke skills to solve complex tasks. Unlike traditional service-oriented architectures where multiple provider calls orchestrate a workflow, looplia uses **single agent sessions** with file-based workspace state management.

**Core Innovation:** The entire application logic is defined in markdown files (`CLAUDE.md`, `SKILL.md`, agent definitions) that are deployed to a workspace filesystem. The CLI merely triggers initial prompts; the agent autonomously reads instructions, invokes skills, and manages state through files.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The Agentic Workflow](#the-agentic-workflow)
3. [CLI Command Triggering](#cli-command-triggering)
4. [Agent SDK & Execution](#agent-sdk--execution)
5. [Plugin System: CLAUDE.md & SKILL.md](#plugin-system-claudemd--skillmd)
6. [Subagents & Multi-Step Orchestration](#subagents--multi-step-orchestration)
7. [Workspace: File-Based State Management](#workspace-file-based-state-management)
8. [End-to-End Data Flow: Summarize Command](#end-to-end-data-flow-summarize-command)
9. [End-to-End Data Flow: Kit Command](#end-to-end-data-flow-kit-command)
10. [Responsibility Mapping: Agent ↔ Subagent ↔ Skill](#responsibility-mapping-agent--subagent--skill)
11. [Design Rationale: Why This Architecture](#design-rationale-why-this-architecture)
12. [Implementation Details](#implementation-details)

---

## Architecture Overview

### Conceptual Layers

```
┌─────────────────────────────────────────────────────────────┐
│ COMMAND LAYER (TypeScript CLI)                              │
│ ├─ looplia summarize --file article.txt                     │
│ ├─ looplia kit --file article.txt --topics "ai,safety"      │
│ └─ looplia config topics --add "machine-learning"           │
└──────────────────────┬──────────────────────────────────────┘
                       │ Write to workspace
┌──────────────────────┴──────────────────────────────────────┐
│ WORKSPACE LAYER (Persistent Filesystem)                     │
│ ~/.looplia/                                                 │
│ ├─ CLAUDE.md (agent brain from plugin README.md)            │
│ ├─ user-profile.json (personalization)                      │
│ ├─ contentItem/{id}/ (content + outputs)                    │
│ └─ .claude/ (agents & skills from plugin)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ Minimal prompt
┌──────────────────────┴──────────────────────────────────────┐
│ AGENT SDK LAYER (Single Session)                            │
│ ├─ Main Agent reads CLAUDE.md                               │
│ ├─ Agent reads workspace files                              │
│ ├─ Agent invokes skills autonomously                        │
│ ├─ Agent optionally spawns subagents                        │
│ └─ Agent writes results to workspace                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ Structured JSON
┌──────────────────────┴──────────────────────────────────────┐
│ OUTPUT LAYER (CLI Display)                                  │
│ ├─ JSON formatted for structured processing                 │
│ ├─ Markdown formatted for human reading                     │
│ └─ Written to stdout or file                                │
└─────────────────────────────────────────────────────────────┘
```

### Key Characteristics

| Aspect | Traditional | Looplia v0.3.1 |
|--------|------------|-----------------|
| Logic location | TypeScript code | Markdown files (CLAUDE.md, SKILL.md) |
| Orchestration | SDK provider calls (3+) | Single agent session |
| Context | Lost between calls | Maintained in single session |
| Customization | Code rebuild needed | Edit markdown, restart |
| State management | In-memory transfer | Filesystem (workspace) |
| Plugin role | Templates only | Active runtime (agent reads files) |

---

## The Agentic Workflow

### From Imperative to Declarative

**Pre-Agentic (v0.2):**
```typescript
// TypeScript imperative workflow
const summary = await summarizer.summarize(content, user);
const ideas = await ideaGenerator.generateIdeas(summary, user);
const outline = await outlineGenerator.generateOutline(summary, ideas, user);
const kit = assemble(summary, ideas, outline);
```

Problems:
- Each call is independent (context lost)
- Agent cannot reason about workflow
- Hardcoded English prompts in TypeScript (200+ lines)
- Plugin files exist but are never read
- Only 7 of 15 summary fields are populated

**Agentic (v0.3.1):**
```
CLI: looplia kit --file article.txt --topics "ai,safety"
  ↓
Write to workspace
  ↓
Single SDK call:
  ├─ Minimal prompt: "Build writing kit from contentItem/{id}"
  ├─ cwd: ~/.looplia (workspace as runtime)
  ├─ allowedTools: ["Read", "Skill"]
  └─ agent_version: "v0.3.1"
  ↓
Agent session:
  ├─ Read CLAUDE.md (full instructions)
  ├─ Read contentItem/{id}/content.md (input)
  ├─ Read user-profile.json (preferences)
  ├─ Invoke media-reviewer skill (9-step analysis)
  ├─ Invoke content-documenter skill (all 15 fields)
  ├─ Invoke writing-enhancer skill (personalization)
  ├─ Reason about task decomposition
  ├─ Write intermediate results to workspace
  └─ Return complete WritingKit JSON
  ↓
CLI: Display to user
```

Benefits:
- Single session maintains full context
- Markdown is the source of truth for instructions
- Agent can reason about workflow structure
- All 15 summary fields populated
- Skills invoked in optimal sequence
- Subagents spawned for complex subtasks

---

## CLI Command Triggering

### The Four Commands

#### 1. `looplia summarize --file <path>`

**File:** `apps/cli/src/commands/summarize.ts`

```typescript
export async function runSummarizeCommand(args: string[]): Promise<void> {
  // 1. Parse arguments
  const filePath = getArg(parsed, "file", "f");
  const format = getArg(parsed, "format") ?? "json";
  const outputPath = getArg(parsed, "output", "o");

  // 2. Validate & prepare
  const workspace = await ensureWorkspace();
  const rawText = readContentFile(filePath);
  const content = createContentItemFromFile(filePath, rawText);
  validateContentItem(content); // Schema validation

  // 3. Write to workspace
  const newContentId = await writeContentItem(content, workspace);

  // 4. Create provider & execute
  const providers = createClaudeProviders();
  const result = await providers.summarizer.summarize(content);

  // 5. Format & output
  const output = format === "markdown"
    ? formatKitAsMarkdown(result.data)
    : JSON.stringify(result.data, null, 2);
  writeOutput(output, outputPath);
}
```

**What happens next:**
- Provider's `summarize()` method (see [Agent SDK](#agent-sdk--execution))
- Minimal prompt sent to SDK
- Agent autonomously handles all analysis
- Returns `ContentSummary` (15 fields)

#### 2. `looplia kit --file <path> [--topics X] [--tone Y] [--word-count Z]`

**File:** `apps/cli/src/commands/kit.ts`

```typescript
export async function runKitCommand(args: string[]): Promise<void> {
  // 1. Parse arguments
  const filePath = getArg(parsed, "file", "f");
  const contentId = getArg(parsed, "content-id");
  const topicsArg = getArg(parsed, "topics");
  const toneArg = getArg(parsed, "tone");
  const wordCountArg = getArg(parsed, "word-count");

  // 2. Load content from file OR content ID
  if (filePath) {
    const rawText = readContentFile(filePath);
    content = createContentItemFromFile(filePath, rawText);
    await writeContentItem(content, workspace);
  } else {
    const { content: loaded } = loadContentFromId(workspace, contentId);
    content = loaded;
  }

  // 3. Load or create user profile
  const user = await loadUserProfile(
    workspace,
    topicsArg,    // CLI args override workspace defaults
    toneArg,
    wordCountArg
  );

  // 4. Build complete writing kit
  const providers = createClaudeProviders();
  const result = await buildWritingKit(content, user, providers);
  // (see buildWritingKit in packages/core)
}
```

#### 3. `looplia config [topics|style] [args]`

**File:** `apps/cli/src/commands/config.ts`

Manages persistent user preferences stored in `~/.looplia/user-profile.json`

```typescript
// Add a topic of interest
looplia config topics --add "machine-learning" --interest 4

// Update writing style
looplia config style --tone intermediate --word-count 1500
```

#### 4. `looplia bootstrap`

**File:** `apps/cli/src/commands/bootstrap.ts`

Destructively refreshes workspace by copying plugin files:

```bash
looplia bootstrap
# Recreates:
# - ~/.looplia/CLAUDE.md (from README.md)
# - ~/.looplia/.claude/agents/
# - ~/.looplia/.claude/skills/
```

### Input Validation Layer

All commands validate input against schemas before proceeding:

```typescript
// ContentItem validation
const validation = validateContentItem(content);
if (!validation.success) {
  console.error(`Validation error: ${validation.error.message}`);
  process.exit(1);
}

// ContentSummary validation (on agent output)
const summaryValidation = validateContentSummary(result.data);
if (!summaryValidation.success) {
  throw new Error(`Invalid summary structure: ${summaryValidation.error.message}`);
}
```

Schemas are defined in `packages/core/src/validation/schemas.ts` using Zod.

---

## Agent SDK & Execution

### The Query Execution Layer

**Location:** `packages/provider/src/claude-agent-sdk/utils/query-wrapper.ts`

Three execution modes evolved across versions:

#### Mode 1: `executeQuery()` (v0.2 - Basic)

```typescript
const result = await executeQuery<ContentSummary>({
  model: "claude-haiku-4-5-20251001",
  systemPrompt: "You are a content analyst...", // 200 lines hardcoded
  userPrompt: "Summarize this content:\n\n" + content.rawText,
  outputFormat: {
    type: "json_schema",
    schema: SUMMARY_OUTPUT_SCHEMA
  }
});
```

**Problems:**
- Hardcoded 200+ line prompts in TypeScript
- Cannot access workspace files
- Cannot invoke skills
- Context lost between calls

#### Mode 2: `executeQueryWithRetry()` (v0.3 - Workflow)

```typescript
const result = await executeQueryWithRetry<ContentSummary>({
  query: async () => executeQuery({...}),
  maxRetries: 3,
  backoffMs: 1000
});
```

**Still problems:**
- Each call is independent
- Hardcoded prompts
- No workspace integration

#### Mode 3: `executeAgenticQuery()` (v0.3.1 - True Agentic)

```typescript
const result = await executeAgenticQuery<ContentSummary>(
  prompt,  // Minimal: "Summarize content: contentItem/{id}.md"
  SUMMARY_OUTPUT_SCHEMA,
  {
    workspace: "~/.looplia",
    model: "claude-haiku-4-5-20251001",
    allowedTools: ["Read", "Skill"],
    timeout: 300000
  }
);
```

**What this enables:**
- Agent reads workspace files (via `Read` tool)
- Agent invokes skills from `.claude/skills/` (via `Skill` tool)
- Single session maintains context
- No hardcoded prompts (uses CLAUDE.md)
- Full agentic reasoning

### The Summarizer Provider

**File:** `packages/provider/src/claude-agent-sdk/summarizer.ts`

```typescript
export function createClaudeSummarizer(config?: ClaudeAgentConfig): ClaudeSummarizerProvider {
  return {
    async summarizeWithUsage(content, user) {
      // Step 1: Ensure workspace exists
      const workspace = await ensureWorkspace({ baseDir: config?.workspace });

      // Step 2: Write content item to workspace
      await writeContentItem(content, workspace);
      // Creates: ~/.looplia/contentItem/{id}/content.md

      // Step 3: Write user profile if provided
      if (user) {
        await writeUserProfile(workspace, user);
      }

      // Step 4: Build minimal prompt (agent reads CLAUDE.md for full instructions)
      const prompt = buildMinimalSummarizePrompt(content.id);
      // Result: "Task: Analyze and summarize content. Use the content-analyzer
      //          subagent to process: contentItem/{id}/content.md"

      // Step 5: Execute agentic query (single session, full context)
      const result = await executeAgenticQuery<ContentSummary>(
        prompt,
        SUMMARY_OUTPUT_SCHEMA,
        {
          workspace,
          ...config,
        }
      );

      // Step 6: Persist summary and handle ID generation
      if (result.success) {
        const summaryPath = join(workspace, "contentItem", content.id, "summary.json");
        writeFileSync(summaryPath, JSON.stringify(result.data, null, 2), "utf-8");

        // Generate meaningful ID from detected source
        const meaningfulId = generateMeaningfulId(result.data);

        // If ID changed, relocate folder (semantic naming)
        if (meaningfulId !== content.id) {
          const newDir = join(workspace, "contentItem", meaningfulId);
          renameSync(oldDir, newDir);
          result.data.contentId = meaningfulId;
        }
      }

      return result;
    }
  };
}
```

### Meaningful ID Generation

**Function:** `generateMeaningfulId(summary: ContentSummary): string`

After summarization, the agent output includes `detectedSource` field (from content-analyzer skill). The summarizer generates a semantic ID:

```typescript
function generateMeaningfulId(summary: ContentSummary): string {
  const source = summary.detectedSource || "text"; // podcast, article, transcript, etc.
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Extract topic from headline (first 2-3 words, hyphenated)
  let topic = "content";
  if (summary.headline) {
    const words = summary.headline
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 2);
    topic = words.join("-").replace(/[^a-z0-9-]/g, "");
  }

  // Generate: source-date-topic
  return `${source}-${date}-${topic}`
    .replace(/--+/g, "-")
    .slice(0, 60);
}
```

**Example IDs:**
- `podcast-2024-12-08-healthcare-ai`
- `article-2024-12-08-climate-change`
- `transcript-2024-12-08-interview-with-expert`

### Usage Tracking

The provider tracks API usage:

```typescript
export type ProviderResultWithUsage<T> = ProviderResult<T> & {
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
};
```

Aggregated across all providers via `createClaudeProviders().getUsage()`

---

## Plugin System: CLAUDE.md & SKILL.md

### Plugin Directory Structure

**Location:** `plugins/looplia-writer/`

```
plugins/looplia-writer/
├── README.md                          # Agent brain (→ deployed as CLAUDE.md)
├── SKILL.md                           # Plugin overview
├── agents/
│   ├── content-analyzer.md           # Detects source, analyzes content
│   ├── idea-generator.md             # Generates writing ideas
│   └── writing-kit-builder.md        # Orchestrates full pipeline
└── skills/
    ├── media-reviewer/
    │   └── SKILL.md                  # 9-step deep content analysis
    ├── content-documenter/
    │   └── SKILL.md                  # Produces 15 summary fields
    ├── user-profile-reader/
    │   └── SKILL.md                  # Calculates relevance scores
    └── writing-enhancer/
        └── SKILL.md                  # Style-aware enhancements
```

### Deployment Process

When `ensureWorkspace()` is called:

```typescript
export async function ensureWorkspace(options?: WorkspaceOptions): Promise<string> {
  const workspace = expandPath(options?.baseDir ?? "~/.looplia");

  if (options?.force) {
    // Destructive: remove existing workspace
    removeSync(workspace);
  }

  // Create directory structure
  mkdirSync(join(workspace, "contentItem"), { recursive: true });
  mkdirSync(join(workspace, ".claude", "agents"), { recursive: true });
  mkdirSync(join(workspace, ".claude", "skills"), { recursive: true });

  // Copy plugin files (ONLY if bootstrap needed)
  if (!existsSync(join(workspace, "CLAUDE.md"))) {
    const pluginPath = path.resolve(process.cwd(), "plugins/looplia-writer");

    // Copy README.md → CLAUDE.md
    copyFileSync(
      join(pluginPath, "README.md"),
      join(workspace, "CLAUDE.md")
    );

    // Copy agents/
    copySync(
      join(pluginPath, "agents"),
      join(workspace, ".claude", "agents")
    );

    // Copy skills/
    copySync(
      join(pluginPath, "skills"),
      join(workspace, ".claude", "skills")
    );
  }

  return workspace;
}
```

**Key insight:** Plugin files are not templates—they're deployed to workspace and actively read by agent at runtime.

### CLAUDE.md: Agent Brain

**Source:** `plugins/looplia-writer/README.md` (renamed to CLAUDE.md on deployment)

This is the **primary instruction document** that the agent reads and follows. It defines:

1. **Mission Statement**
   ```markdown
   # Content Transformation Agent

   Your mission: Transform diverse content into complete writing kits
   that help writers develop their ideas effectively.
   ```

2. **Workspace Architecture**
   ```markdown
   ## Workspace Structure

   ~/.looplia/
   ├── CLAUDE.md (these instructions)
   ├── user-profile.json (personalization)
   ├── contentItem/{id}/
   │   ├── content.md (input)
   │   ├── summary.json (your output)
   │   ├── ideas.json (your output)
   │   └── outline.json (your output)
   └── .claude/
       ├── agents/ (subagent definitions)
       └── skills/ (specialized capabilities)
   ```

3. **Task Definitions** - When asked to summarize, generate ideas, or build kit:
   ```markdown
   ## Task: Summarize Content

   When asked to summarize content:
   1. Use content-analyzer subagent to analyze contentItem/{id}/content.md
   2. The subagent will:
      - Detect source type (podcast, article, transcript, etc.)
      - Use media-reviewer skill (9-step analysis)
      - Use content-documenter skill (structure all 15 fields)
      - Write output to contentItem/{id}/summary.json
   3. Read the generated summary.json
   4. Return JSON matching ContentSummary schema
   ```

4. **Schema References** - Complete JSON schemas for all output types

5. **Quality Rules** - Constraints and requirements:
   ```markdown
   ## Quality Requirements

   - Headlines: 10-200 characters, compelling hooks
   - TL;DR: 20-500 characters, captures essence
   - Bullets: 1-10 items, each under 100 characters
   - Core Ideas: Include real examples from source
   - Quotes: Verbatim with [timestamps] if available
   - All fields must be non-empty
   ```

### SKILL.md: Specialized Capabilities

**Format:** Frontmatter metadata + markdown instructions

```markdown
---
name: media-reviewer
description: Deep content analysis using 9-step methodology
model: claude-3-5-sonnet-20241022
---

# Media Reviewer Skill

Expertise in analyzing content structure, narrative flow, and core ideas.

## What This Skill Does

- Reads content completely and understands context
- Identifies narrative structure and key moments
- Extracts important quotes with timestamps
- Identifies themes and core concepts
- Analyzes documentary/analytical angle

## 9-Step Process

1. **Read Everything**: Ingest all content completely
2. **Understand Context**: What type of content? Who made it? For whom?
3. **Identify Structure**: Sections, segments, flow patterns
4. **Extract Core Ideas**: Main concepts, arguments, principles
5. **Track Narrative Flow**: How does content build over time?
6. **Find Key Moments**: Turning points, climaxes, important quotes
7. **Extract Quotes**: Verbatim text with [HH:MM:SS] timestamps
8. **Identify Themes**: Recurring patterns, topics, ideas
9. **Documentary Angle**: What's the analytical/structural perspective?

## Important Rules

- All steps are conducted in thinking space (not written output)
- Analysis feeds into content-documenter skill
- Output is implicit (used by next skill)
```

#### Key Skills in looplia

| Skill | Purpose | Used By | Output |
|-------|---------|---------|--------|
| **media-reviewer** | 9-step deep analysis | content-analyzer | Implicit (thinking) |
| **content-documenter** | Structure all 15 fields | content-analyzer | summary.json (15 fields) |
| **user-profile-reader** | Calculate relevance score | content-analyzer | Implicit (feeds score) |
| **writing-enhancer** | Personalize for user style | idea-generator | Implicit (shapes output) |

---

## Subagents & Multi-Step Orchestration

### What is a Subagent?

A subagent is an autonomous agent spawned by parent agent to handle a specific subtask. Unlike skills (which are invoked inline), subagents run in their own session with their own instructions.

**When to use:**
- Complex multi-step task (5+ steps)
- Task requires specialized expertise
- Task produces significant intermediate output
- Parent agent needs result before proceeding

**When NOT to use:**
- Simple single-step operation → use skill
- Result feeds into another skill → use skill
- Need to maintain tight context → use skill

### Subagent Definitions

Located in `plugins/looplia-writer/agents/`

#### content-analyzer.md

```markdown
---
name: content-analyzer
description: Deep content analysis using media-reviewer skill
model: haiku
tools: Read, Skill
---

# Content Analyzer Agent

Analyze content deeply to understand structure, themes, narrative flow,
AND detect source type.

## Task

1. Read content from `contentItem/{id}/content.md`
2. **Detect source type** - Analyze characteristics:
   - Podcast/Transcript: Timestamps, speaker markers, dialogue
   - Article: Headline, sections, byline, date published
   - YouTube: Video description, timestamps, channel
   - Twitter: Tweet format, hashtags, engagement metrics
   - Raw Text: Unstructured, no clear formatting
   - Academic: Citations, references, methodology
3. Use **media-reviewer** skill for 9-step analysis
4. Use **content-documenter** skill for structured output
5. Write output to: `contentItem/{id}/summary.json`

## Output

Return enriched ContentSummary JSON with:
- All 15 fields (core + documentary)
- **detectedSource**: podcast, transcript, article, youtube, twitter, text, or other
```

**Key feature:** Subagent's job is to detect source type (via analysis) and populate `detectedSource` field, which CLI then uses to generate meaningful ID.

#### idea-generator.md

```markdown
---
name: idea-generator
description: Generate writing hooks, angles, and questions
model: haiku
tools: Read, Skill
---

# Idea Generator Agent

Transform content summary into writing ideas that engage your audience.

## Task

1. Read `contentItem/{id}/summary.json` (output from content-analyzer)
2. Read `user-profile.json` (personalization)
3. Generate:
   - Hooks: 5 opening strategies (emotional, curiosity, controversy, statistic, story)
   - Angles: 5 unique perspectives (with relevance scores)
   - Questions: 5 provocative questions (analytical, practical, philosophical, comparative)
4. Write to `contentItem/{id}/ideas.json`
```

#### writing-kit-builder.md (Future)

Will orchestrate full pipeline:
```
Parent: Summarize → Get summary
       ↓ Invoke idea-generator subagent
       ├─ Generate ideas
       ├─ Calculate outline
       └─ Return WritingKit
```

### Invoking Subagents

In CLAUDE.md, subagents are invoked via instructions:

```markdown
## Task: Summarize Content

When asked to summarize:
1. Use content-analyzer subagent to analyze contentItem/{id}/content.md
2. The subagent will:
   - Read content
   - Detect source type
   - Apply media-reviewer skill
   - Apply content-documenter skill
   - Write summary.json
3. Read contentItem/{id}/summary.json
4. Return the JSON as structured output
```

**Mechanism:** Agent SDK's `Skill` tool spawns subagent when invoked:

```
Agent reads: "Use content-analyzer subagent..."
             ↓
SDK invokes Skill tool with subagent definition
             ↓
Subagent runs in separate session
             ↓
Subagent produces contentItem/{id}/summary.json
             ↓
Parent agent reads summary.json
             ↓
Parent returns result
```

---

## Workspace: File-Based State Management

### Principle: Filesystem as Source of Truth

Unlike traditional architectures that pass context through memory, looplia persists all state in workspace files. This enables:

1. **Between-command continuity**: Kit command can read summary from previous summarize
2. **Debugging**: All intermediate outputs available in `~/.looplia/`
3. **Audit trail**: Complete history of agent decisions
4. **Portability**: Workspace can be backed up, shared, archived
5. **Agent reasoning**: Agent can read previous results and reason about them

### Workspace Structure

```
~/.looplia/
│
├── CLAUDE.md
│   └─ Agent brain (markdown)
│      Source: plugins/looplia-writer/README.md
│      Deployed on first ensureWorkspace()
│      Contains: tasks, schemas, rules, responsibilities
│
├── user-profile.json
│   └─ Persistent user preferences
│      Schema: { userId, topics: [{topic, interestLevel}], style: {tone, targetWordCount, voice} }
│      Created by: looplia config commands
│      Read by: agents (via user-profile-reader skill)
│      Updated by: kit/summarize CLI args (if provided)
│
├── contentItem/
│   └── {id}/
│       ├── content.md
│       │   └─ Input content with YAML frontmatter
│       │      Frontmatter: id, title, source_type, source_url, published_at, metadata
│       │      Body: raw content text
│       │      Written by: summarizeCommand or kitCommand
│       │      Read by: content-analyzer subagent
│       │
│       ├── summary.json
│       │   └─ ContentSummary output (15 fields)
│       │      Generated by: content-analyzer subagent (via media-reviewer + content-documenter skills)
│       │      Schema enforced by: SUMMARY_OUTPUT_SCHEMA
│       │      Contains: headline, tldr, bullets, tags, sentiment, category, score,
│       │               overview, keyThemes, detailedAnalysis, narrativeFlow,
│       │               coreIdeas, importantQuotes, context, relatedConcepts, detectedSource
│       │      Read by: idea-generator subagent, kit command
│       │
│       ├── ideas.json
│       │   └─ WritingIdeas output
│       │      Generated by: idea-generator subagent
│       │      Contains: hooks[], angles[], questions[]
│       │      Read by: outline generator, kit command
│       │
│       ├── outline.json
│       │   └─ Suggested outline structure
│       │      Generated by: outline-generator subagent
│       │      Contains: sections[], narrative flow
│       │      Read by: kit command
│       │
│       └── sdk-debug.log
│           └─ Execution trace for debugging
│              Contains: all SDK messages, tool invocations, skills called
│
└── .claude/
    ├── agents/
    │   ├── content-analyzer.md
    │   │   └─ Subagent definition
    │   │      Source: plugins/looplia-writer/agents/content-analyzer.md
    │   │      Deployed on first ensureWorkspace()
    │   │      Invoked by: parent agent via Skill tool
    │   │      Responsible for: source detection, media analysis
    │   │
    │   ├── idea-generator.md
    │   │   └─ Subagent definition
    │   │      Invoked by: parent agent (future)
    │   │      Responsible for: generating hooks, angles, questions
    │   │
    │   └── writing-kit-builder.md (future)
    │       └─ Orchestrates full kit workflow
    │
    └── skills/
        ├── media-reviewer/
        │   └── SKILL.md
        │      Provides: 9-step content analysis
        │      Invoked by: content-analyzer subagent
        │
        ├── content-documenter/
        │   └── SKILL.md
        │      Provides: structured output (15 fields)
        │      Invoked by: content-analyzer subagent
        │
        ├── user-profile-reader/
        │   └── SKILL.md
        │      Provides: relevance scoring
        │      Invoked by: analyzers and generators
        │
        └── writing-enhancer/
            └── SKILL.md
               Provides: style-aware personalization
               Invoked by: idea-generator, outline-generator
```

### File I/O Operations

**Writing Content:**
```typescript
await writeContentItem(content: ContentItem, workspace: string): Promise<string>

// Creates:
// ~/.looplia/contentItem/{id}/content.md
//
// Format: YAML frontmatter + raw text
//
// ---
// id: article-2024-12-08-climate-change
// title: "Climate Change: What We Know"
// source:
//   id: source-1
//   type: custom
//   url: https://example.com/article
// publishedAt: 2024-12-08
// metadata:
//   author: Jane Doe
//   language: en
//   wordCount: 1500
// ---
//
// [raw text content here]
```

**Reading Profile:**
```typescript
const profile = await readUserProfile(workspace: string): Promise<unknown>

// Reads: ~/.looplia/user-profile.json
// Returns: { userId: string, topics: [{topic, interestLevel}], style: {...} }
```

**Persisting Results:**
```typescript
// In summarizer.ts
writeFileSync(
  join(workspace, "contentItem", content.id, "summary.json"),
  JSON.stringify(result.data, null, 2),
  "utf-8"
);

// Makes available to:
// - Kit command (reads for ideas generation)
// - Idea generator subagent
// - User for inspection
```

---

## End-to-End Data Flow: Summarize Command

### Full Sequence Diagram

```
User Terminal
     │
     │ looplia summarize --file article.txt
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ runSummarizeCommand (CLI)                           │
├─────────────────────────────────────────────────────┤
│ 1. Parse: file="article.txt", format="json", ...    │
│ 2. Validate file exists & is readable               │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ createContentItemFromFile()                         │
├─────────────────────────────────────────────────────┤
│ 1. Read file: article.txt                           │
│ 2. Create ContentItem {                             │
│      id: "cli-1733660400000",                       │
│      title: "Article",                              │
│      rawText: "[file contents]",                    │
│      source: {...},                                 │
│      metadata: {...}                                │
│    }                                                │
│ 3. Validate against ContentItemSchema (Zod)         │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ ensureWorkspace()                                   │
├─────────────────────────────────────────────────────┤
│ 1. Expand ~/ → /Users/user/.looplia                 │
│ 2. Create directories (if first run):               │
│    - ~/.looplia/                                    │
│    - ~/.looplia/contentItem/                        │
│    - ~/.looplia/.claude/agents/                     │
│    - ~/.looplia/.claude/skills/                     │
│ 3. Bootstrap from plugin (if first run):            │
│    - Copy plugins/looplia-writer/README.md          │
│      → ~/.looplia/CLAUDE.md                         │
│    - Copy plugins/looplia-writer/agents/            │
│      → ~/.looplia/.claude/agents/                   │
│    - Copy plugins/looplia-writer/skills/            │
│      → ~/.looplia/.claude/skills/                   │
│ 4. Return workspace path                            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ writeContentItem()                                  │
├─────────────────────────────────────────────────────┤
│ 1. Create: ~/.looplia/contentItem/cli-1733660400000/│
│ 2. Write: content.md with YAML frontmatter          │
│ 3. Return: "cli-1733660400000"                      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ createClaudeProviders()                             │
├─────────────────────────────────────────────────────┤
│ 1. Instantiate: summarizer, ideaGenerator, etc.     │
│ 2. Wrap with usage tracking                         │
│ 3. Return: { summarizer, idea, outline, ... }       │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ providers.summarizer.summarizeWithUsage()           │
├─────────────────────────────────────────────────────┤
│ 1. ensureWorkspace() ← already done, confirm        │
│ 2. writeContentItem(content, workspace)             │
│    → ~/.looplia/contentItem/cli-1733660400000/      │
│ 3. Build minimal prompt:                            │
│    "Summarize content: contentItem/cli-1733.../... " │
│ 4. Call: executeAgenticQuery<ContentSummary>()      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ Agent SDK Query Execution                           │
│ (cwd = ~/.looplia/)                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│ AGENT SESSION STARTS                                │
│ ├─ Model: claude-haiku-4-5-20251001                │
│ ├─ Tools available: Read, Skill                     │
│ ├─ Working directory: ~/.looplia/                   │
│ └─ Output schema: SUMMARY_OUTPUT_SCHEMA (15 fields) │
│                                                     │
│ 1. Agent receives prompt:                           │
│    "Summarize content: contentItem/cli-.../content.md"│
│                                                     │
│ 2. Agent reads CLAUDE.md (full instructions)        │
│    └─ "When asked to summarize, use content-..."   │
│                                                     │
│ 3. Agent reads contentItem/cli-.../content.md       │
│    └─ [full article text]                           │
│                                                     │
│ 4. Agent invokes content-analyzer subagent:         │
│    └─ SDK spawns subagent with content-analyzer.md │
│                                                     │
│    ┌─ SUBAGENT SESSION ──────────────────────────┐  │
│    │                                              │  │
│    │ 1. Subagent reads: contentItem/cli-.../     │  │
│    │    content.md                               │  │
│    │                                              │  │
│    │ 2. Subagent invokes media-reviewer skill:   │  │
│    │    • 9-step analysis (implicit thinking)    │  │
│    │      1. Read everything                     │  │
│    │      2. Understand context                  │  │
│    │      3. Identify structure                  │  │
│    │      4. Extract core ideas                  │  │
│    │      5. Track narrative flow                │  │
│    │      6. Find key moments                    │  │
│    │      7. Extract quotes + timestamps         │  │
│    │      8. Identify themes                     │  │
│    │      9. Documentary angle                   │  │
│    │                                              │  │
│    │ 3. Subagent invokes content-documenter:     │  │
│    │    • Produces all 15 fields:                │  │
│    │      headline, tldr, bullets, tags,         │  │
│    │      sentiment, category, score,            │  │
│    │      overview, keyThemes, detailed...,      │  │
│    │      narrativeFlow, coreIdeas,              │  │
│    │      importantQuotes, context,              │  │
│    │      relatedConcepts, detectedSource        │  │
│    │                                              │  │
│    │ 4. Subagent returns ContentSummary JSON     │  │
│    └──────────────────────────────────────────────┘  │
│                                                     │
│ 5. Parent agent receives summary JSON               │
│    ├─ Validates against SUMMARY_OUTPUT_SCHEMA      │
│    └─ Returns to provider                          │
│                                                     │
│ AGENT SESSION ENDS                                  │
│                                                     │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ Post-Processing in summarizeWithUsage()             │
├─────────────────────────────────────────────────────┤
│ 1. Persist summary to disk:                         │
│    writeFileSync(                                   │
│      ~/.looplia/contentItem/cli-.../summary.json,   │
│      JSON.stringify(result.data)                    │
│    )                                                │
│                                                     │
│ 2. Generate meaningful ID from detected source:     │
│    source = result.data.detectedSource              │
│             (e.g., "article")                       │
│    date = "2024-12-08"                              │
│    topic = extract from headline (e.g., "climate")  │
│    meaningfulId = "article-2024-12-08-climate-..."  │
│                                                     │
│ 3. If ID changed, relocate folder:                  │
│    renameSync(                                      │
│      ~/.looplia/contentItem/cli-.../,               │
│      ~/.looplia/contentItem/article-2024-12-08-.../ │
│    )                                                │
│                                                     │
│ 4. Update contentId in summary.json                 │
│                                                     │
│ 5. Return {                                         │
│      success: true,                                 │
│      data: ContentSummary (with meaningful contentId),│
│      usage: { inputTokens, outputTokens, costUsd }  │
│    }                                                │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ CLI Output Formatting                               │
├─────────────────────────────────────────────────────┤
│ 1. Check format arg (default: "json")               │
│                                                     │
│ 2. If format="json":                                │
│    output = JSON.stringify(result.data, null, 2)   │
│                                                     │
│ 3. If format="markdown":                            │
│    output = formatKitAsMarkdown(result.data)        │
│    (transforms JSON to readable markdown)           │
│                                                     │
│ 4. Check output arg                                 │
│                                                     │
│ 5. If outputPath:                                   │
│    writeFileSync(outputPath, output)                │
│    Display: "Summary written to: {outputPath}"      │
│                                                     │
│ 6. Else (default):                                  │
│    console.log(output)                              │
│    (display to stdout)                              │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ User sees output                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ {                                                   │
│   "contentId": "article-2024-12-08-climate-...",   │
│   "headline": "Climate Change: What We Know",       │
│   "tldr": "Recent research shows...",               │
│   "bullets": ["Point 1", "Point 2", ...],          │
│   ...                                               │
│   "detectedSource": "article"                       │
│ }                                                   │
│                                                     │
│ (Plus filesystem state in ~/.looplia/)              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Key Transitions

1. **CLI → Workspace**: Content written to filesystem
2. **Workspace → SDK**: Agent reads files via `Read` tool
3. **SDK → Subagent**: Skill tool spawns content-analyzer
4. **Subagent → Skills**: Invokes media-reviewer and content-documenter
5. **Skills → JSON**: Produces structured output
6. **JSON → Workspace**: Summary persisted to summary.json
7. **Workspace → CLI**: Provider returns result
8. **CLI → User**: Formatted output

---

## End-to-End Data Flow: Kit Command

### Complete Writing Kit Generation

```
looplia kit --file article.txt --topics "ai,safety" --tone expert
     │
     ├─ Phase 1: Prepare Workspace (same as summarize)
     │  ├─ Parse args
     │  ├─ Create ContentItem from file
     │  ├─ ensureWorkspace()
     │  └─ writeContentItem()
     │
     ├─ Phase 2: Load/Prepare User Profile
     │  ├─ Try reading ~/.looplia/user-profile.json
     │  ├─ Override with CLI args:
     │  │  - --topics "ai,safety" → user.topics = [{topic: "ai", interestLevel: 3}, ...]
     │  │  - --tone expert → user.style.tone = "expert"
     │  │  - --word-count 2000 → user.style.targetWordCount = 2000
     │  └─ Write to ~/.looplia/user-profile.json
     │
     └─ Phase 3: Build Writing Kit (sequential SDK calls)
        ├─ Step 1: Summarize Content
        │  └─ (Same as summarize command)
        │     → ContentSummary (15 fields)
        │
        ├─ Step 2: Generate Ideas
        │  ├─ Provider: createClaudeProviders().idea
        │  ├─ Input: ContentSummary + UserProfile
        │  ├─ SDK call (v0.3 approach - not yet agentic):
        │  │   Sends full hardcoded prompt with summary details
        │  └─ Output: WritingIdeas {
        │       hooks: [{text, type}, ...],
        │       angles: [{title, description, relevanceScore}, ...],
        │       questions: [{question, type}, ...]
        │     }
        │
        ├─ Step 3: Generate Outline
        │  ├─ Provider: createClaudeProviders().outline
        │  ├─ Input: ContentSummary + WritingIdeas + UserProfile
        │  ├─ SDK call:
        │  │   Sends full prompt with summary & ideas details
        │  └─ Output: OutlineSection[] {
        │       heading, notes, estimatedWords
        │     }
        │
        └─ Step 4: Assemble WritingKit
           └─ Combine: ContentSummary + WritingIdeas + Outline
              → WritingKit {
                  contentId, source, summary, ideas, suggestedOutline, meta
                }

Output: JSON or Markdown format
```

**Note:** v0.3.1 enhances step 1 (summarize) with full agentic flow. Steps 2-3 will be enhanced in v0.4 to use CLAUDE.md-based instruction sets.

---

## Responsibility Mapping: Agent ↔ Subagent ↔ Skill

### For Summarize Command

```
┌─────────────────────────────────────────────────────────────┐
│ MAIN AGENT (via minimal prompt)                             │
│ ────────────────────────────────────────────────────────────│
│ RESPONSIBILITY:                                             │
│  • Read CLAUDE.md instructions                              │
│  • Route to appropriate subagent (content-analyzer)         │
│  • Wait for subagent result                                 │
│  • Return ContentSummary JSON                               │
│                                                             │
│ ACTIONS:                                                    │
│  • Read: contentItem/{id}/content.md                        │
│  • Invoke: content-analyzer subagent via Skill tool        │
│  • Read: contentItem/{id}/summary.json (result)             │
│  • Return: JSON matching SUMMARY_OUTPUT_SCHEMA              │
│                                                             │
│ INPUT: Minimal prompt                                       │
│        "Summarize content: contentItem/{id}"               │
│                                                             │
│ OUTPUT: ContentSummary (15 fields)                          │
└──────────────────┬───────────────────────────────────────────┘
                   │ Invokes
         ┌─────────┴───────────┐
         │                     │
         ▼                     │
┌──────────────────────┐       │
│ SUBAGENT:            │       │
│ content-analyzer     │       │
├──────────────────────┤       │
│ RESPONSIBILITY:      │       │
│  • Detect source type │      │
│  • Analyze content   │       │
│  • Invoke skills     │       │
│  • Produce summary   │       │
│                      │       │
│ ACTIONS:             │       │
│  • Read content.md   │       │
│  • Analyze to detect:│       │
│    - Podcast signals?│       │
│    - Article format? │       │
│    - Transcript marks│       │
│  • Invoke skills:    │       │
│    - media-reviewer  │       │
│    - content-doc     │       │
│  • Write summary.json│       │
│                      │       │
│ INPUT: content.md    │       │
│ OUTPUT: summary.json │       │
│ (15 fields +         │       │
│  detectedSource)     │       │
└──────┬───────────┬───┘       │
       │           │           │
       ▼           ▼           │
┌────────────┐  ┌──────────────┐
│ SKILL:     │  │ SKILL:       │
│ media-     │  │ content-     │
│ reviewer   │  │ documenter   │
├────────────┤  ├──────────────┤
│ RESPONSI.. │  │ RESPONSI...  │
│  • 9-step  │  │  • Format    │
│    analysis│  │    all 15    │
│           │  │    fields    │
│ ACTION:   │  │             │
│  • Think  │  │ ACTION:     │
│    deeply │  │  • Produce  │
│  • (not   │  │    JSON     │
│    output)│  │  • Validate │
│           │  │    min len  │
│ INPUT: n/a│  │  • Include  │
│ OUTPUT:   │  │    quotes   │
│ (implicit)│  │    with [t] │
└────────────┘  │             │
                │ INPUT: (from│
                │ media-re..) │
                │             │
                │ OUTPUT:     │
                │ 15-field    │
                │ JSON        │
                └──────────────┘
```

### For Kit Command (Full Pipeline)

```
┌──────────────────────────────────────────────────────────────┐
│ MAIN AGENT (via CLI trigger)                                 │
│ ───────────────────────────────────────────────────────────── │
│ RESPONSIBILITY:                                              │
│  • Read user profile                                         │
│  • Orchestrate pipeline:                                     │
│    1. Summarize content                                      │
│    2. Generate ideas (future: agentic)                       │
│    3. Create outline (future: agentic)                       │
│    4. Assemble WritingKit                                    │
│                                                              │
│ IMPLEMENTED AS: buildWritingKit() in core service layer      │
│                 (not yet via agentic agent)                  │
│                                                              │
│ INPUT: ContentItem + UserProfile                             │
│ OUTPUT: WritingKit (summary + ideas + outline)               │
└───────────────────────────────────────────────────────────────┘
         │           │           │
         ▼           ▼           ▼
      ┌────────┐ ┌────────┐ ┌────────┐
      │Summary │ │Ideas   │ │Outline │
      │Provider│ │Provider│ │Provider│
      └────────┘ └────────┘ └────────┘
         │           │           │
      (See above) (v0.3 - not yet agentic)
```

**Key insight:** v0.3.1 enhances summarization to be fully agentic. Steps 2-3 will be enhanced in v0.4 to follow same agent-reads-CLAUDE.md pattern.

### Responsibility by Component

| Component | Summarize | Ideas | Outline |
|-----------|-----------|-------|---------|
| **Main Agent** | Routes to content-analyzer subagent | Direct SDK call (hardcoded prompt) | Direct SDK call (hardcoded prompt) |
| **Subagent** | Analyzes content, invokes skills | (None yet) | (None yet) |
| **Skill** | media-reviewer (9-step), content-documenter (15 fields) | (None) | (None) |
| **Provider** | Returns ContentSummary | Returns WritingIdeas | Returns OutlineSection[] |
| **CLI** | Displays summary JSON/Markdown | Embedded in kit | Embedded in kit |

---

## Design Rationale: Why This Architecture

### Problem: v0.3 Lost Context

Version 0.3 called three separate SDK sessions:

```typescript
// v0.3 - Three independent calls
const summary = await summarizer.summarize(content);    // Call 1
const ideas = await ideaGenerator.generateIdeas(summary); // Call 2
const outline = await outlineGenerator.generateOutline(summary, ideas); // Call 3
```

**Issues:**
1. **Lost Context**: Each call is independent; agent can't reason about previous results
2. **Hardcoded Prompts**: 200+ lines of English prompts in TypeScript
3. **Plugin Files Unused**: README.md, SKILL.md files deployed but never read
4. **Limited Output**: Only requested 7 of 15 summary fields
5. **No Source Detection**: No way to generate meaningful IDs
6. **Workflow Fixed**: No flexibility to change task flow without code

### Solution: Single Agent Session (v0.3.1)

**New approach:**
```
CLI prompt: "Summarize content: contentItem/{id}"
        ↓
Agent reads: CLAUDE.md (full instructions)
        ↓
Agent reads: contentItem/{id}/content.md (content)
        ↓
Agent thinks: "According to CLAUDE.md, I should use content-analyzer"
        ↓
Agent invokes: content-analyzer subagent
        ↓
Subagent invokes: media-reviewer skill + content-documenter skill
        ↓
Skills produce: All 15 summary fields
        ↓
Agent returns: Complete ContentSummary JSON
```

**Benefits:**
1. ✅ **Maintained Context**: Single session preserves all analysis
2. ✅ **Markdown as Source of Truth**: CLAUDE.md defines behavior
3. ✅ **Plugin Files Active**: Agent reads and uses markdown files
4. ✅ **Complete Output**: All 15 fields populated
5. ✅ **Source Detection**: Generates meaningful IDs (podcast-2024-12-08-...)
6. ✅ **Flexible Workflow**: Edit CLAUDE.md to change task sequence
7. ✅ **Customizable**: No code rebuild needed for instruction changes

### Architectural Decisions

#### Decision 1: File-Based State Management

**Why not in-memory context transfer?**
- ✅ Workspace is auditable (can inspect all outputs)
- ✅ Between-command continuity (kit reads summary from previous run)
- ✅ Portable (backup ~/.looplia/ to preserve analysis)
- ✅ Debuggable (sdk-debug.log shows full execution)
- ✅ Shareable (can pass contentItem/{id}/ to others)

#### Decision 2: Plugin Files as Active Runtime

**Why deploy CLAUDE.md instead of hardcoding prompts?**
- ✅ Customizable without code rebuild
- ✅ Version-controlled (plugin updates tracked in git)
- ✅ Readable (markdown is human-friendly)
- ✅ Collaborative (non-engineers can edit instructions)
- ✅ Plugin ecosystem ready (future: plugins for different use cases)

#### Decision 3: Subagents vs. Inline Processing

**Why spawn content-analyzer instead of inline analysis?**
- ✅ Semantic separation (content analysis is distinct task)
- ✅ Reusable (content-analyzer can be used by multiple parents)
- ✅ Testable (subagent can be tested independently)
- ✅ Scalable (future: multiple subagents in parallel)
- ✅ Debuggable (subagent gets own session, own logs)

#### Decision 4: Skills for Specific Expertise

**Why break media-reviewer and content-documenter into separate skills?**
- ✅ **Separation of concerns**: Analysis (implicit) vs. Structure (explicit)
- ✅ **Reusable**: Other agents can use media-reviewer
- ✅ **Composable**: Can mix/match skills in different workflows
- ✅ **Testable**: Each skill can be validated independently
- ✅ **Versionable**: Can have media-reviewer v1, v2, etc.

#### Decision 5: Minimal Prompts

**Why not send full instructions in prompt?**
- ✅ Keeps prompt concise (5 words vs. 200 lines)
- ✅ Instructions in CLAUDE.md can be lengthy & detailed
- ✅ Agent can reason about instructions (read & adapt)
- ✅ Reduces token usage (instructions cached in workspace)
- ✅ Makes flow visible (can see what prompt was sent)

---

## Implementation Details

### Code Organization

```
packages/
├── core/
│   ├── src/
│   │   ├── domain/           # TypeScript types
│   │   ├── services/         # buildWritingKit orchestration
│   │   ├── adapters/         # Mock providers for testing
│   │   └── validation/       # Zod schemas
│   └── test/                 # Domain tests
│
└── provider/
    └── src/
        └── claude-agent-sdk/
            ├── index.ts      # createClaudeProviders()
            ├── summarizer.ts # (v0.3.1 - agentic)
            ├── idea-generator.ts # (v0.3 - workflow)
            ├── outline-generator.ts # (v0.3 - workflow)
            ├── workspace.ts  # File management
            ├── content-io.ts # Content serialization
            ├── utils/
            │   ├── query-wrapper.ts # executeAgenticQuery()
            │   ├── error-mapper.ts
            │   ├── schema-converter.ts
            │   └── prompts.ts (deprecated)
            └── config.ts     # SDK configuration
```

### Type Safety

All operations use TypeScript types from `packages/core`:

```typescript
// ContentItem (input)
export type ContentItem = {
  id: string;
  title: string;
  rawText: string;
  source: Source;
  url: string;
  publishedAt?: string;
  metadata: ContentMetadata;
};

// ContentSummary (output from summarize)
export type ContentSummary = {
  contentId: string;
  headline: string;
  tldr: string;
  bullets: string[];
  tags: string[];
  sentiment: "positive" | "neutral" | "negative";
  category: string;
  score: SummaryScore;
  overview: string;
  keyThemes: string[];
  detailedAnalysis: string;
  narrativeFlow: string;
  coreIdeas: CoreIdea[];
  importantQuotes: Quote[];
  context: string;
  relatedConcepts: string[];
  detectedSource?: "podcast" | "transcript" | "article" | "youtube" | "twitter" | "text" | "other";
};

// WritingKit (output from kit command)
export type WritingKit = {
  contentId: string;
  source: Source;
  summary: ContentSummary;
  ideas: WritingIdeas;
  suggestedOutline: OutlineSection[];
  meta: {
    relevanceToUser: number;
    estimatedReadingTimeMinutes: number;
  };
};
```

### Error Handling

**Validation errors** (fail fast):
```typescript
const validation = validateContentItem(content);
if (!validation.success) {
  console.error(`Error: ${validation.error.message}`);
  process.exit(1);
}
```

**SDK execution errors** (map & retry):
```typescript
const result = await executeAgenticQuery<ContentSummary>(...);
if (!result.success) {
  // Mapped error types: validation_error, network_error, rate_limit, unknown
  console.error(`Error: ${result.error.message}`);
  process.exit(1);
}
```

**File system errors** (graceful fallback):
```typescript
try {
  const profile = await readUserProfile(workspace);
  // Use profile
} catch {
  // No profile found, create from CLI args
  profile = createUserProfile(parseTopics(topicsArg), ...);
}
```

### Testing

**Unit tests:** Individual components
```typescript
// test/domain/validation.test.ts
test("ContentSummary validation accepts valid summary", () => {
  const summary = { /* valid data */ };
  const result = validateContentSummary(summary);
  expect(result.success).toBe(true);
});
```

**E2E tests:** Full CLI flow
```typescript
// test/e2e/cli.test.ts
test("should generate meaningful content ID with detected source", async () => {
  const { stdout } = await executeCommand("summarize", "--file", testFile);
  const match = stdout.match(/^[a-z]+-/);
  expect(match).toBeTruthy(); // ID starts with source type
});
```

**Mock providers:** For testing without API key
```typescript
const summarizer = createMockSummarizer();
const result = await summarizer.summarize(content);
// Returns hardcoded mock summary
```

---

## Future Roadmap

### v0.4: Complete Agentic Architecture

**Goal:** Make ideas and outline generation fully agentic (like summarization)

**Changes:**
1. Update `CLAUDE.md` with ideas and outline task definitions
2. Create `idea-generator` subagent (agentic) to replace workflow provider
3. Create `outline-generator` subagent (agentic)
4. Single SDK call for complete pipeline (summarize → ideas → outline)
5. Ideas and outline steps read CLAUDE.md and invoke skills

**Benefit:** Zero TypeScript code changes to alter workflow; edit markdown only

### v0.5+: Plugin Ecosystem

**Goal:** Support multiple plugins (looplia-coder, looplia-researcher, etc.)

**Vision:**
```
plugins/
├── looplia-writer/      # Content → writing kit (current)
├── looplia-coder/       # Spec → code
├── looplia-researcher/  # Topic → research report
└── [community plugins]
```

**CLI:**
```bash
looplia --plugin looplia-coder init-workspace
looplia --plugin looplia-coder spec-to-code --file spec.md
```

---

## Conclusion

Looplia-core v0.3.1 represents a paradigm shift from **provider-centric** (multiple SDK calls with hardcoded prompts) to **agent-centric** (single session with agent reading markdown instructions).

**The innovation:** By making workspace files the runtime environment and markdown the source of truth for behavior, looplia enables:
- Customization without code changes
- Complex agentic workflows with full context
- Plugin-based extensibility
- File-based auditability and reproducibility

This architecture demonstrates how AI agents can orchestrate their own tasks, invoke specialized tools (skills), and coordinate multi-step workflows—all driven by natural language instructions in markdown files.

