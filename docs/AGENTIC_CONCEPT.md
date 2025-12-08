# Looplia-Core: Agentic Architecture & Design (v0.3.2)

## Executive Summary

Looplia-core implements a **true agentic architecture** where:

1. **One CLI command = One prompt = One agent session**
2. **Main agent is a simple orchestrator** - it reads instructions and invokes subagents
3. **Subagents are autonomous specialists** - they make their own decisions using skills
4. **All behavior is defined in markdown** - edit `/plugins` to tune results without coding

**Core Innovation:** The CLI sends a minimal prompt to the Claude Agent SDK. The main agent reads `CLAUDE.md` for instructions, checks workspace state, and autonomously orchestrates subagents to complete the task. Each subagent invokes skills as needed and writes outputs to the workspace. The system is **fully autonomous** - humans only provide the initial trigger and tune the plugin files.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THE AGENTIC FLOW                                                           │
│                                                                             │
│  CLI Command ──► ONE Prompt ──► Main Agent ──► Subagents (autonomous)       │
│       │                             │                │                      │
│       │                             │                └──► Skills (invoke)   │
│       │                             │                                       │
│       │                             └──► Reads CLAUDE.md for instructions   │
│       │                                  Checks session state (files)       │
│       │                                  Decides which subagents to call    │
│       │                                                                     │
│       └──► User provides: content file, preferences                         │
│            System handles: analysis, ideas, outline, assembly               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [The Core Concept](#the-core-concept)
2. [Architecture Overview](#architecture-overview)
3. [CLI Command → One Prompt](#cli-command--one-prompt)
4. [Main Agent as Orchestrator](#main-agent-as-orchestrator)
5. [Subagents: Autonomous Specialists](#subagents-autonomous-specialists)
6. [Skills: Reusable Expertise](#skills-reusable-expertise)
7. [Smart Continuation: Agent-Controlled Flow](#smart-continuation-agent-controlled-flow)
8. [Workspace: File-Based State](#workspace-file-based-state)
9. [Plugin System: Tune Without Coding](#plugin-system-tune-without-coding)
10. [End-to-End: Kit Command Flow](#end-to-end-kit-command-flow)
11. [End-to-End: Summarize Command Flow](#end-to-end-summarize-command-flow)
12. [Design Rationale](#design-rationale)
13. [Implementation Reference](#implementation-reference)

---

## The Core Concept

### The Problem with Traditional Approaches

**Traditional (v0.2):** Multiple SDK calls, each independent:
```typescript
// Three separate API calls - context lost between each
const summary = await summarizer.summarize(content);    // Call 1
const ideas = await ideaGenerator.generate(summary);    // Call 2
const outline = await outlineGenerator.generate(summary, ideas); // Call 3
const kit = assemble(summary, ideas, outline);
```

**Problems:**
- Context lost between calls
- Hardcoded prompts in TypeScript (200+ lines each)
- Agent cannot reason about the workflow
- Plugin files exist but are never read
- Changes require code rebuild

### The Agentic Solution (v0.3.2)

**One command = One prompt = One session:**

```
looplia kit --file article.md
       │
       └──► ONE prompt to SDK: "Build WritingKit for session: contentItem/{id}"
                    │
                    └──► Main agent autonomously:
                         ├─ Reads CLAUDE.md (full instructions)
                         ├─ Checks session state (what files exist?)
                         ├─ Invokes content-analyzer subagent (if needed)
                         ├─ Invokes idea-generator subagent (if needed)
                         ├─ Invokes writing-kit-builder subagent (if needed)
                         └─ Returns complete WritingKit JSON
```

**Benefits:**
- Single session maintains full context
- Agent reasons about what work is needed
- Instructions in markdown (editable without code)
- Plugin files actively read and used
- Autonomous decision-making

---

## Architecture Overview

### Conceptual Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLI LAYER (TypeScript - Minimal Logic)                                      │
│ ├─ looplia kit --file article.md                                            │
│ ├─ looplia kit --session-id abc123                                          │
│ └─ looplia summarize --file article.md                                      │
│                                                                             │
│ Responsibility: Parse args, write content to workspace, send ONE prompt     │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ Minimal prompt + workspace path
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ AGENT SDK LAYER (Single Session)                                            │
│ ├─ Main Agent reads CLAUDE.md                                               │
│ ├─ Main Agent checks session state (existing files)                         │
│ ├─ Main Agent invokes subagents via Task tool                               │
│ ├─ Subagents invoke skills as needed                                        │
│ └─ Main Agent returns structured JSON output                                │
│                                                                             │
│ Responsibility: Orchestrate autonomous work, make decisions, produce output │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ Read/Write files
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ WORKSPACE LAYER (Persistent Filesystem)                                     │
│ ~/.looplia/                                                                 │
│ ├─ CLAUDE.md (main agent instructions from plugin)                          │
│ ├─ user-profile.json (personalization preferences)                          │
│ ├─ contentItem/{session-id}/ (all session files - flat structure)           │
│ │   ├─ content.md (input)                                                   │
│ │   ├─ summary.json (from content-analyzer)                                 │
│ │   ├─ ideas.json (from idea-generator)                                     │
│ │   ├─ outline.json (from writing-kit-builder)                              │
│ │   └─ writing-kit.json (final output)                                      │
│ └─ .claude/                                                                 │
│     ├─ agents/ (subagent definitions)                                       │
│     └─ skills/ (specialized capabilities)                                   │
│                                                                             │
│ Responsibility: Persist state, enable continuation, provide auditability    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Characteristics

| Aspect | Traditional (v0.2) | Agentic (v0.3.2) |
|--------|-------------------|------------------|
| SDK calls per command | 3+ separate calls | 1 single session |
| Logic location | TypeScript code | Markdown files (CLAUDE.md, agents/*.md) |
| Context | Lost between calls | Maintained in session |
| Orchestration | Hardcoded in TypeScript | Agent decides autonomously |
| Customization | Code rebuild needed | Edit markdown, restart |
| State management | In-memory transfer | Filesystem (workspace) |
| Flow control | Hardcoded sequence | Agent-controlled (smart continuation) |

---

## CLI Command → One Prompt

### The Mapping Principle

**Every CLI command maps to exactly ONE prompt.** The prompt is minimal - it tells the agent what to accomplish, not how to do it.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLI COMMAND                    │  PROMPT TO SDK                            │
├─────────────────────────────────┼───────────────────────────────────────────┤
│ looplia kit --file article.md   │ "Build WritingKit for session:            │
│                                 │  contentItem/{session-id}"                │
├─────────────────────────────────┼───────────────────────────────────────────┤
│ looplia kit --session-id abc123 │ "Build WritingKit for session:            │
│                                 │  contentItem/abc123"                      │
├─────────────────────────────────┼───────────────────────────────────────────┤
│ looplia summarize --file x.md   │ "Summarize content:                       │
│                                 │  contentItem/{session-id}"                │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

### What the CLI Does (Minimal)

```typescript
// apps/cli/src/commands/kit.ts - Simplified view

export async function runKitCommand(args: string[]): Promise<void> {
  // 1. Parse arguments
  const filePath = getArg(parsed, "file", "f");
  const sessionId = getArg(parsed, "session-id");

  // 2. Ensure workspace exists
  const workspace = await ensureWorkspace();

  // 3. If --file: Create new session with content.md
  if (filePath) {
    const content = createContentItemFromFile(filePath, rawText);
    const newSessionId = await writeContentItem(content, workspace);
  }

  // 4. Create provider and send ONE prompt
  const provider = createClaudeWritingKitProvider({ workspace });
  const result = await provider.buildKit(content, user);
  //                    ↑
  //                    ONE SDK call with minimal prompt
  //                    Agent handles everything else autonomously

  // 5. Output result
  console.log(JSON.stringify(result.data, null, 2));
}
```

### What the CLI Does NOT Do

- ❌ No workflow orchestration logic
- ❌ No "if summary exists, skip to ideas"
- ❌ No hardcoded prompts (200+ lines)
- ❌ No multiple SDK calls
- ❌ No business logic decisions

**The agent makes all decisions.** The CLI just triggers and displays.

---

## Main Agent as Orchestrator

### The Simple Orchestrator Pattern

The main agent's job is simple:
1. Read instructions from CLAUDE.md
2. Check what work is already done (session state)
3. Invoke subagents for remaining work
4. Return the final result

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAIN AGENT - Simple Orchestrator                                           │
│                                                                             │
│  Prompt: "Build WritingKit for session: contentItem/{session-id}"           │
│                                                                             │
│  1. Read CLAUDE.md → Understand full task instructions                      │
│                                                                             │
│  2. Check session folder for existing files:                                │
│     ├─ Glob contentItem/{id}/*.json                                         │
│     └─ Decide which subagents to invoke                                     │
│                                                                             │
│  3. IF summary.json missing:                                                │
│     ├─ Invoke content-analyzer subagent (Task tool)                         │
│     └─ Wait for completion (AgentOutputTool)                                │
│                                                                             │
│  4. IF ideas.json missing:                                                  │
│     ├─ Invoke idea-generator subagent (Task tool)                           │
│     └─ Wait for completion (AgentOutputTool)                                │
│                                                                             │
│  5. IF writing-kit.json missing:                                            │
│     ├─ Invoke writing-kit-builder subagent (Task tool)                      │
│     └─ Wait for completion (AgentOutputTool)                                │
│                                                                             │
│  6. Return:                                                                 │
│     ├─ Read writing-kit.json                                                │
│     └─ Return via StructuredOutput tool                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Simple is Better

The main agent has **no business logic**:
- It doesn't know how to analyze content (content-analyzer does)
- It doesn't know how to generate ideas (idea-generator does)
- It doesn't know how to create outlines (writing-kit-builder does)

It only knows:
- What the task is (from prompt)
- How to check progress (read files)
- Which subagent to call next (from CLAUDE.md instructions)
- When to stop (all files exist)

**This separation makes the system:**
- Easier to debug (each component isolated)
- Easier to test (subagents testable independently)
- Easier to customize (edit subagent markdown)
- More reliable (simple orchestrator = fewer bugs)

---

## Subagents: Autonomous Specialists

### The Three Subagents

Each subagent is an **autonomous specialist** with its own expertise:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SUBAGENT: content-analyzer                                                 │
│  File: .claude/agents/content-analyzer.md                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  EXPERTISE: Deep content analysis                                           │
│                                                                             │
│  READS:                                                                     │
│    • contentItem/{id}/content.md (source content)                           │
│                                                                             │
│  INVOKES SKILLS:                                                            │
│    • media-reviewer (9-step deep analysis)                                  │
│    • content-documenter (structure all 15 fields)                           │
│                                                                             │
│  WRITES:                                                                    │
│    • contentItem/{id}/summary.json                                          │
│                                                                             │
│  AUTONOMOUS DECISIONS:                                                      │
│    • Detects source type (podcast, article, transcript, etc.)               │
│    • Identifies narrative structure                                         │
│    • Extracts quotes with timestamps                                        │
│    • Calculates relevance score                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SUBAGENT: idea-generator                                                   │
│  File: .claude/agents/idea-generator.md                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  EXPERTISE: Creative writing ideation                                       │
│                                                                             │
│  READS:                                                                     │
│    • contentItem/{id}/summary.json (from content-analyzer)                  │
│    • user-profile.json (personalization)                                    │
│                                                                             │
│  WRITES:                                                                    │
│    • contentItem/{id}/ideas.json                                            │
│                                                                             │
│  AUTONOMOUS DECISIONS:                                                      │
│    • Generates 5 hooks (emotional, curiosity, controversy, statistic, story)│
│    • Develops 5 unique angles with relevance scores                         │
│    • Creates 5 thought-provoking questions                                  │
│    • Personalizes based on user's tone preference                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SUBAGENT: writing-kit-builder                                              │
│  File: .claude/agents/writing-kit-builder.md                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  EXPERTISE: Outline creation and kit assembly                               │
│                                                                             │
│  READS:                                                                     │
│    • contentItem/{id}/summary.json                                          │
│    • contentItem/{id}/ideas.json                                            │
│    • user-profile.json (target word count)                                  │
│                                                                             │
│  WRITES:                                                                    │
│    • contentItem/{id}/outline.json                                          │
│    • contentItem/{id}/writing-kit.json (final assembled output)             │
│                                                                             │
│  AUTONOMOUS DECISIONS:                                                      │
│    • Creates section structure based on content themes                      │
│    • Distributes word count across sections                                 │
│    • Selects best hooks and angles for outline                              │
│    • Calculates reading time estimate                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Subagent Definition Format

Each subagent is defined in a markdown file with frontmatter:

```markdown
---
name: content-analyzer
description: Deep content analysis using media-reviewer and content-documenter skills
model: haiku
tools: Read, Write, Skill
---

# Content Analyzer Agent

Analyze content deeply to understand structure, themes, and narrative flow.

## Input

Read content from: `contentItem/{id}/content.md`

## Task

1. **Detect Source Type** - Analyze content characteristics:
   - Podcast: Timestamps, speaker markers, dialogue format
   - Article: Headline, sections, byline
   - Transcript: Speaker labels, time codes
   - etc.

2. **Use media-reviewer skill** for 9-step deep analysis

3. **Use content-documenter skill** to structure all 15 summary fields

## Output

Write to: `contentItem/{id}/summary.json`

Return the complete ContentSummary JSON.
```

### Subagent Autonomy

Subagents make their own decisions:
- **What skills to invoke** (based on content type)
- **How to interpret content** (using their expertise)
- **What to emphasize** (based on user profile)
- **How to structure output** (following their training)

The main agent doesn't tell them HOW to do their job - only WHAT to produce.

---

## Skills: Reusable Expertise

### What is a Skill?

A skill is a **focused capability** that subagents invoke for specific expertise:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SKILL: media-reviewer                                                      │
│  File: .claude/skills/media-reviewer/SKILL.md                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  PURPOSE: Deep 9-step content analysis                                      │
│                                                                             │
│  9-STEP PROCESS:                                                            │
│    1. Read Everything - Ingest all content completely                       │
│    2. Understand Context - Type, creator, audience                          │
│    3. Identify Structure - Sections, flow patterns                          │
│    4. Extract Core Ideas - Main concepts, arguments                         │
│    5. Track Narrative Flow - How content builds over time                   │
│    6. Find Key Moments - Turning points, climaxes                           │
│    7. Extract Quotes - Verbatim with [HH:MM:SS] timestamps                  │
│    8. Identify Themes - Recurring patterns                                  │
│    9. Documentary Angle - Analytical perspective                            │
│                                                                             │
│  OUTPUT: Implicit (feeds into content-documenter)                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SKILL: content-documenter                                                  │
│  File: .claude/skills/content-documenter/SKILL.md                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  PURPOSE: Structure analysis into 15 summary fields                         │
│                                                                             │
│  PRODUCES:                                                                  │
│    • headline, tldr, bullets, tags                                          │
│    • sentiment, category, score                                             │
│    • overview, keyThemes, detailedAnalysis                                  │
│    • narrativeFlow, coreIdeas, importantQuotes                              │
│    • context, relatedConcepts, detectedSource                               │
│                                                                             │
│  QUALITY RULES:                                                             │
│    • Headlines: 10-200 chars, compelling hooks                              │
│    • Quotes: Verbatim with timestamps if available                          │
│    • All fields must be non-empty                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Skill vs Subagent

| Aspect | Skill | Subagent |
|--------|-------|----------|
| Invoked by | Subagent | Main agent |
| Scope | Single focused task | Multi-step workflow |
| Output | Implicit or single file | Multiple files |
| Session | Runs within subagent | Separate session |
| Example | media-reviewer (analyze) | content-analyzer (coordinate) |

---

## Smart Continuation: Agent-Controlled Flow

### The Key Innovation

**The agent decides what work is needed** - not hardcoded TypeScript logic.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SMART CONTINUATION - Agent Checks Session State                            │
│                                                                             │
│  Prompt: "Build WritingKit for session: contentItem/abc123"                 │
│                                                                             │
│  Agent's First Action:                                                      │
│    "Let me check which files already exist in contentItem/abc123/"          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Session: contentItem/abc123/                                        │    │
│  │                                                                     │    │
│  │ Files Found:          Agent's Decision:                             │    │
│  │ ─────────────────────────────────────────────────────────────────── │    │
│  │ content.md only       → Run full workflow (3 subagents)             │    │
│  │ + summary.json        → Skip content-analyzer, run 2 subagents      │    │
│  │ + ideas.json          → Skip content-analyzer + idea-generator      │    │
│  │ + writing-kit.json    → Return existing kit directly                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Agent Response (from debug log):                                           │
│    "Perfect! All the necessary files already exist.                         │
│     Let me read the writing-kit.json file and return it as structured       │
│     output."                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Agent-Controlled?

**Traditional approach (hardcoded):**
```typescript
// BAD: Logic in TypeScript
if (!existsSync('summary.json')) {
  await runSummarizer();
}
if (!existsSync('ideas.json')) {
  await runIdeaGenerator();
}
// ... more hardcoded logic
```

**Agentic approach (v0.3.2):**
```
Prompt includes instructions:
  "Check which files already exist in contentItem/{id}/
   - summary.json → If exists, skip content-analyzer
   - ideas.json → If exists, skip idea-generator
   - writing-kit.json → If exists, return it directly"

Agent makes the decision at runtime.
```

**Benefits of agent-controlled flow:**
- Flexible: Agent can adapt to unexpected situations
- Debuggable: Agent explains its decisions in logs
- Tunable: Change behavior by editing CLAUDE.md
- Consistent: Same logic regardless of entry point

### --file vs --session-id

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  --file behavior (Fresh Session)                                            │
│                                                                             │
│  looplia kit --file article.md                                              │
│       │                                                                     │
│       └──► CLI creates NEW session with NEW session-id                      │
│            └──► Starts from scratch (even if same file processed before)    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  --session-id behavior (Continue Session)                                   │
│                                                                             │
│  looplia kit --session-id abc123                                            │
│       │                                                                     │
│       └──► Agent reads contentItem/abc123/ and detects existing files       │
│            ├─► Skips already-completed steps                                │
│            └──► Continues from where it left off                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Workspace: File-Based State

### Flat Folder Structure

All files for a session live at the same level (no subfolders):

```
~/.looplia/
├── CLAUDE.md                    # Main agent instructions (from plugin)
├── user-profile.json            # User preferences
└── contentItem/
    └── {session-id}/
        ├── content.md           # Source content (input)
        ├── summary.json         # From content-analyzer subagent
        ├── ideas.json           # From idea-generator subagent
        ├── outline.json         # From writing-kit-builder subagent
        ├── writing-kit.json     # Final assembled output
        └── sdk-debug.log        # Execution trace for debugging
```

### File I/O Sequence

| Step | Agent | Reads | Writes |
|------|-------|-------|--------|
| 1 | Main | CLAUDE.md, session folder (check state) | - |
| 2 | content-analyzer | content.md | summary.json |
| 3 | idea-generator | summary.json, user-profile.json | ideas.json |
| 4 | writing-kit-builder | summary.json, ideas.json | outline.json, writing-kit.json |
| 5 | Main | writing-kit.json | - (returns via StructuredOutput) |

### Why File-Based?

- **Auditability**: All intermediate outputs visible in `~/.looplia/`
- **Debugging**: Can inspect what each subagent produced
- **Continuation**: Resume interrupted sessions
- **Portability**: Backup/share entire sessions
- **Agent reasoning**: Agent can read and reason about previous results

---

## Plugin System: Tune Without Coding

### The Plugin = The Brain

The plugin directory contains all behavior definitions:

```
plugins/looplia-writer/
├── README.md                    # → Deployed as CLAUDE.md (main agent brain)
├── agents/
│   ├── content-analyzer.md      # Subagent: content analysis
│   ├── idea-generator.md        # Subagent: writing ideas
│   └── writing-kit-builder.md   # Subagent: outline + assembly
└── skills/
    ├── media-reviewer/SKILL.md  # Skill: 9-step deep analysis
    ├── content-documenter/SKILL.md # Skill: structure 15 fields
    ├── user-profile-reader/SKILL.md # Skill: relevance scoring
    └── writing-enhancer/SKILL.md # Skill: style personalization
```

### Customization Without Code

**Want better headlines?**
→ Edit `skills/content-documenter/SKILL.md`:
```markdown
## Headline Requirements
- Must be 10-100 characters (was 10-200)
- Must include a number or surprising fact
- Must create curiosity gap
```

**Want different hook types?**
→ Edit `agents/idea-generator.md`:
```markdown
## Hook Types
Generate 5 hooks of these types:
- Contrarian (challenge conventional wisdom)
- Personal story (relatable experience)
- Future prediction (what's coming)
- Expert quote (authority backing)
- Question (engage reader)
```

**Want different outline structure?**
→ Edit `agents/writing-kit-builder.md`:
```markdown
## Outline Structure
Create outline with these sections:
- Hook (10% of word count)
- Problem (20%)
- Solution (40%)
- Proof (20%)
- Call to Action (10%)
```

### No Code Rebuild Needed

1. Edit markdown files in `plugins/looplia-writer/`
2. Run `looplia bootstrap` to deploy changes
3. Run `looplia kit --file ...` with new behavior

**This is the agentic advantage**: Behavior is defined in natural language, not code.

---

## End-to-End: Kit Command Flow

### Complete Sequence Diagram

```
User Terminal
     │
     │ looplia kit --file article.md --topics "ai,safety" --tone expert
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLI: runKitCommand()                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Parse arguments                                                          │
│ 2. ensureWorkspace() → ~/.looplia/                                          │
│ 3. writeContentItem() → contentItem/{session-id}/content.md                 │
│ 4. Load/merge user profile with CLI args                                    │
│ 5. createClaudeWritingKitProvider()                                         │
│ 6. provider.buildKit(content, user) ← ONE SDK CALL                          │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ Minimal prompt:
                               │ "Build WritingKit for session: contentItem/{id}"
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ MAIN AGENT SESSION                                                          │
│ cwd: ~/.looplia/                                                            │
│ tools: Read, Write, Glob, Task, AgentOutputTool, StructuredOutput           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Agent: "I'll help you build the WritingKit for the session.                 │
│         Let me start by checking which files already exist."                │
│                                                                             │
│ → Glob contentItem/{id}/*.json                                              │
│ → Result: ["content.md"] (only content exists)                              │
│                                                                             │
│ Agent: "Only content.md exists. I need to run all three subagents."         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SUBAGENT: content-analyzer                                              │ │
│ │ Invoked via: Task tool                                                  │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ 1. Reads contentItem/{id}/content.md                                    │ │
│ │ 2. Detects source type: "article"                                       │ │
│ │ 3. Invokes media-reviewer skill (9-step analysis)                       │ │
│ │ 4. Invokes content-documenter skill (15 fields)                         │ │
│ │ 5. Writes contentItem/{id}/summary.json                                 │ │
│ │ 6. Returns: "Summary created successfully"                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Agent: "Content analysis complete. Now generating ideas."                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SUBAGENT: idea-generator                                                │ │
│ │ Invoked via: Task tool                                                  │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ 1. Reads contentItem/{id}/summary.json                                  │ │
│ │ 2. Reads user-profile.json (tone: expert, topics: ai, safety)           │ │
│ │ 3. Generates 5 hooks (emotional, curiosity, controversy, stat, story)   │ │
│ │ 4. Develops 5 angles with relevance scores                              │ │
│ │ 5. Creates 5 thought-provoking questions                                │ │
│ │ 6. Writes contentItem/{id}/ideas.json                                   │ │
│ │ 7. Returns: "Ideas generated successfully"                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Agent: "Ideas generated. Now creating outline and assembling kit."          │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SUBAGENT: writing-kit-builder                                           │ │
│ │ Invoked via: Task tool                                                  │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ 1. Reads contentItem/{id}/summary.json                                  │ │
│ │ 2. Reads contentItem/{id}/ideas.json                                    │ │
│ │ 3. Reads user-profile.json (targetWordCount: 1000)                      │ │
│ │ 4. Creates outline with word count distribution                         │ │
│ │ 5. Assembles complete WritingKit                                        │ │
│ │ 6. Writes contentItem/{id}/outline.json                                 │ │
│ │ 7. Writes contentItem/{id}/writing-kit.json                             │ │
│ │ 8. Returns: "WritingKit assembled successfully"                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Agent: "All subagents complete. Returning the WritingKit."                  │
│                                                                             │
│ → Read contentItem/{id}/writing-kit.json                                    │
│ → Return via StructuredOutput tool                                          │
│                                                                             │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ WritingKit JSON
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLI: Output to user                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ {                                                                           │
│   "contentId": "test-ai-healthcare",                                        │
│   "source": { "id": "...", "label": "...", "url": "..." },                  │
│   "summary": {                                                              │
│     "headline": "AI is Revolutionizing Healthcare...",                      │
│     "tldr": "Artificial intelligence is transforming...",                   │
│     "bullets": [...],                                                       │
│     "tags": ["artificial intelligence", "healthcare", ...],                 │
│     ...15 fields total                                                      │
│   },                                                                        │
│   "ideas": {                                                                │
│     "hooks": [5 hooks],                                                     │
│     "angles": [5 angles with relevance scores],                             │
│     "questions": [5 questions]                                              │
│   },                                                                        │
│   "suggestedOutline": [7 sections with word estimates],                     │
│   "meta": { "relevanceToUser": 0.85, "estimatedReadingTimeMinutes": 8 }     │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Transitions

1. **CLI → SDK**: One prompt triggers entire workflow
2. **Main Agent → CLAUDE.md**: Agent reads instructions
3. **Main Agent → Session**: Agent checks existing files
4. **Main Agent → Subagents**: Task tool spawns specialists
5. **Subagents → Skills**: Invoke for specific expertise
6. **Subagents → Workspace**: Write outputs as files
7. **Main Agent → Output**: Return via StructuredOutput

---

## End-to-End: Summarize Command Flow

### Simplified Flow (Single Subagent)

```
looplia summarize --file article.md
     │
     └──► ONE prompt: "Summarize content: contentItem/{id}"
               │
               └──► Main Agent:
                    ├─ Read CLAUDE.md
                    ├─ Invoke content-analyzer subagent
                    │   ├─ Read content.md
                    │   ├─ Use media-reviewer skill
                    │   ├─ Use content-documenter skill
                    │   └─ Write summary.json
                    ├─ Read summary.json
                    └─ Return ContentSummary JSON
```

The summarize command uses the same pattern but only needs one subagent.

---

## Design Rationale

### Why One Prompt Per Command?

**Problem**: Multiple SDK calls lose context
```
Call 1: "Summarize this" → Summary
Call 2: "Generate ideas from [summary text pasted]" → Ideas
Call 3: "Create outline from [summary + ideas pasted]" → Outline
```
Each call is independent. Agent can't reason about the workflow.

**Solution**: One call, agent orchestrates
```
Call 1: "Build WritingKit for session X"
        Agent reads files, invokes subagents, maintains context
```

### Why Main Agent as Simple Orchestrator?

**Problem**: Complex orchestrator = complex bugs
```typescript
// BAD: Business logic in orchestrator
if (contentType === 'podcast') {
  summary = await podcastAnalyzer.analyze(content);
} else if (contentType === 'article') {
  summary = await articleAnalyzer.analyze(content);
}
// More conditions, more bugs
```

**Solution**: Simple orchestrator, smart subagents
```
Main Agent: "Invoke content-analyzer for contentItem/{id}"
content-analyzer: (autonomously detects type and handles appropriately)
```

### Why Agent-Controlled Flow?

**Problem**: Hardcoded flow is inflexible
```typescript
// BAD: Can't change order without code change
await summarize();
await generateIdeas();
await createOutline();
```

**Solution**: Agent reads instructions and decides
```markdown
# CLAUDE.md
Check existing files. Only run what's needed.
If summary exists, skip to ideas.
If ideas exist, skip to outline.
```

### Why File-Based State?

**Problem**: In-memory state is invisible
- Can't debug what happened
- Can't resume after failure
- Can't audit agent decisions

**Solution**: Everything in files
- `summary.json` shows exactly what analyzer produced
- `sdk-debug.log` shows agent's reasoning
- Can resume with `--session-id` after any failure

### Why Plugin-Based Customization?

**Problem**: Code changes are expensive
- Requires developer
- Requires rebuild
- Requires deployment

**Solution**: Markdown changes are cheap
- Anyone can edit
- No rebuild needed
- Just run `looplia bootstrap`

---

## Implementation Reference

### Code Organization

```
packages/
├── core/
│   ├── src/
│   │   ├── domain/           # TypeScript types
│   │   ├── services/         # buildWritingKit (deprecated path)
│   │   ├── adapters/mock/    # Mock providers for testing
│   │   └── validation/       # Zod schemas
│   └── test/
│
├── provider/
│   └── src/claude-agent-sdk/
│       ├── writing-kit-provider.ts  # NEW: Single-call kit builder
│       ├── summarizer.ts            # Single-call summarizer
│       ├── workspace.ts             # File management
│       ├── content-io.ts            # Content serialization
│       └── config.ts
│
└── apps/cli/
    └── src/commands/
        ├── kit.ts           # Uses WritingKitProvider
        ├── summarize.ts     # Uses ClaudeSummarizer
        └── bootstrap.ts     # Deploys plugin to workspace

plugins/looplia-writer/
├── README.md                # → CLAUDE.md
├── agents/
│   ├── content-analyzer.md
│   ├── idea-generator.md
│   └── writing-kit-builder.md
└── skills/
    ├── media-reviewer/SKILL.md
    ├── content-documenter/SKILL.md
    ├── user-profile-reader/SKILL.md
    └── writing-enhancer/SKILL.md
```

### Key Types

```typescript
// WritingKit (final output)
type WritingKit = {
  contentId: string;
  source: { id: string; label: string; url: string };
  summary: ContentSummary;      // 15 fields
  ideas: WritingIdeas;          // hooks, angles, questions
  suggestedOutline: OutlineSection[];
  meta: {
    relevanceToUser: number;
    estimatedReadingTimeMinutes: number;
  };
};

// Provider interface
type WritingKitProvider = {
  buildKit(content: ContentItem, user: UserProfile): Promise<ProviderResult<WritingKit>>;
};
```

### Testing

**With mock provider (no API key):**
```bash
looplia kit --file article.md --mock
```

**With real API:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
looplia kit --file article.md
```

**Smart continuation test:**
```bash
# First run (creates all files)
looplia kit --file article.md
# Output: ✓ New session created: test-article

# Second run (skips completed steps)
looplia kit --session-id test-article
# Agent: "All necessary files already exist. Returning existing kit."
```

---

## Conclusion

Looplia-core v0.3.2 implements a **true agentic architecture** where:

1. **One CLI command = One prompt = One agent session**
2. **Main agent is a simple orchestrator** that reads CLAUDE.md and invokes subagents
3. **Subagents are autonomous specialists** that make their own decisions
4. **Smart continuation** is agent-controlled, not hardcoded
5. **All behavior is defined in markdown** - edit plugins to tune without coding

**The key insight**: By making the agent responsible for workflow decisions (not TypeScript code), looplia enables:
- Customization through natural language (edit markdown)
- Autonomous problem-solving (agent adapts to situations)
- Debuggable reasoning (agent explains decisions in logs)
- Resumable workflows (file-based state)

This architecture demonstrates how AI agents can orchestrate complex tasks autonomously, with humans providing only the initial trigger and tuning the instructions.
