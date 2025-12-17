# Looplia-Core: Agent System Design

> Claude Agent SDK-Based Agentic Architecture with Workflow-as-Markdown
>
> **Version:** 0.4
> **Date:** 2025-12-17
> **Related:** [GLOSSARY.md](./GLOSSARY.md) | [DESIGN-0.5.1.md](./DESIGN-0.5.1.md) | [AGENT-SKILLS.md](./AGENT-SKILLS.md)

This document describes the core agent system design of Looplia-Core, focusing on the Workflow-as-Markdown pattern, custom subagents, skills auto-loading, and validation-driven completion.

---

## Table of Contents

1. [Introduction: The SDK-Based Agent Runtime](#1-introduction-the-sdk-based-agent-runtime)
2. [Workspace: The Agent's Runtime Environment](#2-workspace-the-agents-runtime-environment)
3. [Workflow-as-Markdown](#3-workflow-as-markdown)
4. [Custom Subagents](#4-custom-subagents)
5. [Skills Auto-Loading](#5-skills-auto-loading)
6. [Validation-Driven Completion](#6-validation-driven-completion)
7. [The Execution Cycle](#7-the-execution-cycle)
8. [The Call Stack Concept](#8-the-call-stack-concept)
9. [Smart Continuation](#9-smart-continuation)
10. [Reference: Anthropic Official Documentation](#reference-anthropic-official-documentation)

---

## 1. Introduction: The SDK-Based Agent Runtime

### The Paradigm Shift

Looplia-Core implements an **agentic runtime** where the **Claude Agent SDK** executes autonomous agents with full filesystem access. This differs fundamentally from traditional API-based approaches:

| Traditional API Calls | SDK-Based Agent Runtime |
|----------------------|-------------------------|
| Multiple independent requests | Single session with tools |
| Context lost between calls | Context maintained in session |
| Logic hardcoded in application | Logic in natural language (CLAUDE.md) |
| State passed as parameters | State persisted in Workspace |
| Application orchestrates | Agent orchestrates autonomously |

### Core Principles

**One Command = One Prompt**

Every CLI command maps to exactly ONE minimal prompt. The prompt tells the agent WHAT to accomplish, not HOW to do it. The agent autonomously orchestrates the workflow.

**Workflow-as-Markdown** (v0.4)

Workflows are defined in markdown files with YAML frontmatter. The frontmatter declares WHAT outputs to produce, while the markdown body provides HOW instructions. CLAUDE.md is a generic interpreter that can execute ANY workflow.

**Custom Subagents with Auto-Loading Skills**

Subagents are defined in `.claude/agents/*.md` with a `skills:` frontmatter field that auto-loads specified skills when the subagent starts. The main agent invokes subagents via the Task tool with custom `subagent_type`.

**Validation-Driven Completion**

A workflow step is complete when its output PASSES VALIDATION, not when it's marked "done". Validation criteria are defined in the workflow frontmatter and checked by a deterministic script.

**Workspace as Runtime**

The agent operates within a **Workspace** (`~/.looplia/`) with full filesystem access. The Workspace provides:
- Instructions via **CLAUDE.md** (generic interpreter)
- Personalization via **UserProfile**
- Workflow definitions via **workflows/*.md**
- Validation state via **validation.json**
- Capabilities via **Skills** and **Subagents**

**File-Based State**

All agent state persists as files. There is no in-memory handoff between agents. This enables:
- **Smart Continuation**: Resume interrupted work via validation state
- **Auditability**: Inspect all intermediate outputs
- **Debugging**: Review agent decisions via logs

### SDK Tools

The Claude Agent SDK provides tools that agents use to interact with the Workspace:

| Tool | Purpose |
|------|---------|
| **Read** | Read file contents |
| **Write** | Write file contents |
| **Glob** | Pattern match files |
| **Task** | Spawn Subagent with custom `subagent_type` |
| **Skill** | Invoke Skill (auto-loaded or manual) |
| **Bash** | Execute deterministic scripts |

---

## 2. Workspace: The Agent's Runtime Environment

### Structure Overview

The **Workspace** is the agent's runtime environment - a persistent filesystem where all agent operations occur.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKSPACE STRUCTURE (v0.4)                               │
│                    ~/.looplia/                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ~/.looplia/                          ← Agent's cwd (current working dir)   │
│  │                                                                          │
│  ├── CLAUDE.md                        ← Generic Workflow Interpreter        │
│  │                                      Executes ANY workflow definition    │
│  │                                                                          │
│  ├── user-profile.json                ← UserProfile                         │
│  │                                      Personalization: topics, style      │
│  │                                                                          │
│  ├── workflows/                       ← Workflow Definitions (v0.4)         │
│  │   └── writing-kit.md                 YAML frontmatter + markdown body    │
│  │                                                                          │
│  ├── contentItem/                     ← Session Storage                     │
│  │   └── {Session-ID}/                  One folder per Session              │
│  │       ├── content.md                 ContentItem (input)                 │
│  │       ├── validation.json            Validation state (v0.4)             │
│  │       ├── summary.json               Stage 1 output                      │
│  │       ├── ideas.json                 Stage 2 output                      │
│  │       └── writing-kit.json           Stage 3 output (final)              │
│  │                                                                          │
│  └── .claude/                         ← SDK Convention Directory            │
│      ├── agents/                        Subagent definitions                │
│      │   ├── content-analyzer.md        skills: media-reviewer, ...         │
│      │   ├── idea-generator.md          skills: user-profile-reader         │
│      │   └── writing-kit-builder.md     skills: user-profile-reader         │
│      │                                                                      │
│      └── skills/                        Skill definitions                   │
│          ├── media-reviewer/SKILL.md                                        │
│          ├── content-documenter/SKILL.md                                    │
│          ├── user-profile-reader/SKILL.md                                   │
│          └── workflow-validator/        Validation skill (v0.4)             │
│              ├── SKILL.md                                                   │
│              └── scripts/validate.ts                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design Principles

**Flat Session Structure**

All Session files reside at the same level within `contentItem/{Session-ID}/`. No nested subfolders. This simplifies agent file operations and enables straightforward Glob patterns.

**JSON for Typed Data**

Intermediate outputs use JSON format with schemas defined in the core package. This enables:
- Runtime validation via Zod schemas
- Type safety in domain entities
- Easy inspection and debugging

**Separation of Concerns**

| Location | Concern |
|----------|---------|
| `CLAUDE.md` | Generic workflow interpreter |
| `user-profile.json` | User personalization |
| `workflows/` | Workflow definitions (WHAT to do) |
| `contentItem/` | Session data (input/output/state) |
| `.claude/agents/` | Subagent definitions (HOW to do each step) |
| `.claude/skills/` | Skill definitions (reusable capabilities) |

---

## 3. Workflow-as-Markdown

### Overview

**Workflow-as-Markdown** combines YAML frontmatter (declarative definition) with markdown body (custom instructions) in a single file. This replaces the previous YAML-only pipeline definitions.

### Workflow File Structure

```markdown
---
name: writing-kit
description: Transform content into structured writing kit

outputs:
  summary:
    artifact: summary.json
    agent: content-analyzer
    validate:
      required_fields: [contentId, headline, tldr, bullets, ...]
      min_quotes: 3
      min_key_points: 5

  ideas:
    artifact: ideas.json
    agent: idea-generator
    requires: [summary]
    validate:
      required_fields: [contentId, hooks, angles, questions]
      has_hooks: true

  writing-kit:
    artifact: writing-kit.json
    agent: writing-kit-builder
    requires: [summary, ideas]
    final: true
    validate:
      required_fields: [contentId, source, summary, ideas, suggestedOutline, meta]
      min_outline_sections: 4
      has_hooks: true
---

# Writing Kit Workflow

## Purpose
Transform raw content into a comprehensive writing kit...

## Custom Instructions
- Read user-profile.json for personalization
- Calculate relevance scores based on user topics
- Generate 5 types of hooks: emotional, curiosity, controversy, statistic, story

## Output Schemas
[Schema documentation...]
```

### Frontmatter Properties

| Property | Description |
|----------|-------------|
| `name` | Unique workflow identifier |
| `description` | Human-readable description |
| `outputs` | Map of output names to configurations |
| `outputs.*.artifact` | Output filename (e.g., "summary.json") |
| `outputs.*.agent` | Subagent responsible for this output |
| `outputs.*.requires` | Dependencies (other outputs that must complete first) |
| `outputs.*.final` | Marks the final output artifact |
| `outputs.*.validate` | Validation criteria for this output |

### Validation Criteria

| Criterion | Description |
|-----------|-------------|
| `required_fields` | Array of field names that must exist |
| `min_quotes` | Minimum number of quotes |
| `min_key_points` | Minimum number of key points |
| `min_outline_sections` | Minimum outline sections |
| `has_hooks` | Requires non-empty hooks array |

### Benefits

| Benefit | Description |
|---------|-------------|
| **Single Source of Truth** | Definition and instructions in one file |
| **Self-Documenting** | Markdown body explains workflow behavior |
| **Validation-Driven** | Clear criteria for each output |
| **Extensible** | Add custom validation rules |

---

## 4. Custom Subagents

### Overview

**Custom Subagents** are specialized agents defined in `.claude/agents/*.md` that handle specific workflow steps. The main agent invokes them via the **Task tool** with a custom `subagent_type`.

### Subagent Definition

```yaml
---
name: content-analyzer
description: Deep content analysis using media-reviewer skill. Extracts themes, quotes, and insights.
model: haiku
tools: Read, Write, Skill
skills: media-reviewer, content-documenter
---

# Content Analyzer Agent

Analyze content deeply to understand structure, themes, and narrative flow.

## Task

1. Read content from `contentItem/{id}/content.md`
2. Use **media-reviewer** skill for analysis
3. Use **content-documenter** skill for structured output
4. Write output to: `contentItem/{id}/summary.json`

## Output

Write enriched ContentSummary JSON with:
- overview, keyThemes, detailedAnalysis
- narrativeFlow, coreIdeas, importantQuotes
- context, relatedConcepts
```

### Frontmatter Fields

| Field | Description |
|-------|-------------|
| `name` | Unique identifier (matches `subagent_type` in Task tool) |
| `description` | What this agent does |
| `model` | LLM model to use (e.g., haiku, sonnet) |
| `tools` | Tools available to this agent (Read, Write, Skill) |
| `skills` | **Auto-loaded skills** (comma-separated list) |

### Task Tool Invocation

The main agent invokes subagents using the Task tool with the agent's `name` as `subagent_type`:

```json
{
  "name": "Task",
  "input": {
    "subagent_type": "content-analyzer",
    "description": "Generate summary artifact",
    "prompt": "Analyze content at contentItem/{id}/content.md and write summary.json"
  }
}
```

### SDK Configuration

For custom subagents to be discovered, the SDK must be configured with:

```typescript
const result = query({
  prompt,
  options: {
    settingSources: ["project"],  // ← Discovers .claude/agents/
    allowedTools: ["Read", "Write", "Glob", "Task", "Skill"],
  },
});
```

---

## 5. Skills Auto-Loading

### Overview

**Skills Auto-Loading** allows subagents to automatically load specified skills when they start. This is configured via the `skills:` frontmatter field in agent definitions.

### Configuration

```yaml
---
name: content-analyzer
skills: media-reviewer, content-documenter  # ← Auto-loaded!
---
```

When the `content-analyzer` subagent starts, both `media-reviewer` and `content-documenter` skills are automatically loaded into its session.

### Progressive Disclosure

Skills follow Anthropic's three-level progressive disclosure model:

| Level | When Loaded | Token Cost | Content |
|-------|-------------|------------|---------|
| **Level 1: Metadata** | At startup | ~100 tokens | `name` and `description` from YAML frontmatter |
| **Level 2: Instructions** | When triggered | < 5k tokens | SKILL.md body with instructions |
| **Level 3: Scripts** | As needed | 0 tokens | Scripts run outside LLM context |

### Skill vs Subagent

| Aspect | Skill | Subagent |
|--------|-------|----------|
| **Invoked by** | Any agent (auto or manual) | Main Agent via Task tool |
| **Session** | Inline (same session) | Separate session |
| **Definition** | `.claude/skills/*/SKILL.md` | `.claude/agents/*.md` |
| **Scope** | Single focused task | Multi-step workflow |
| **Auto-loading** | Via `skills:` in agent frontmatter | Explicit via Task tool |

### Skill Discovery

Skills are discovered from filesystem locations when `settingSources: ["project"]`:

```
Project Skills (shared via git):
  .claude/skills/*/SKILL.md

Looplia Workspace Skills:
  ~/.looplia/.claude/skills/*/SKILL.md
```

---

## 6. Validation-Driven Completion

### Overview

**Validation-Driven Completion** means a workflow step is complete when its output PASSES VALIDATION, not when it's simply written to disk. This provides deterministic quality assurance.

### validation.json Structure

When CLI starts a workflow, it generates `validation.json` from the workflow frontmatter:

```json
{
  "workflow": "writing-kit",
  "outputs": {
    "summary": {
      "artifact": "summary.json",
      "criteria": {
        "required_fields": ["contentId", "headline", "tldr", "bullets", ...],
        "min_quotes": 3,
        "min_key_points": 5
      },
      "validated": false
    },
    "ideas": {
      "artifact": "ideas.json",
      "criteria": {
        "required_fields": ["contentId", "hooks", "angles", "questions"],
        "has_hooks": true
      },
      "validated": false
    },
    "writing-kit": {
      "artifact": "writing-kit.json",
      "criteria": {
        "required_fields": ["contentId", "source", "summary", "ideas", "suggestedOutline", "meta"],
        "min_outline_sections": 4,
        "has_hooks": true
      },
      "validated": false
    }
  }
}
```

### Workflow-Validator Skill

The **workflow-validator** skill validates artifacts using a deterministic script:

```
.claude/skills/workflow-validator/
├── SKILL.md                    # Instructions for using the skill
└── scripts/
    └── validate.ts             # Deterministic validation script
```

### Validation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VALIDATION FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

[1] Subagent writes artifact (e.g., summary.json)
    │
    ▼
[2] Main agent invokes workflow-validator skill
    │
    └─ Agent reads SKILL.md instructions
       │
       ▼
[3] Agent runs validation script via Bash
    │
    │  bun scripts/validate.ts summary.json '{"required_fields":...}'
    │
    ▼
[4] Script returns JSON result (0 tokens consumed)
    │
    │  { "passed": true, "checks": [...] }
    │
    ▼
[5] Agent processes result
    │
    ├─ If passed: Update validation.json → outputs.summary.validated = true
    │
    └─ If failed: Review failed checks, retry subagent with feedback
```

### Script Output Format

```json
{
  "passed": true,
  "checks": [
    { "name": "has_contentId", "passed": true, "message": "OK" },
    { "name": "has_headline", "passed": true, "message": "OK" },
    { "name": "min_quotes", "passed": true, "message": "Found 6 quotes (min: 3)" },
    { "name": "min_key_points", "passed": true, "message": "Found 7 key points (min: 5)" }
  ]
}
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Deterministic** | Script-based validation, no LLM variability |
| **Token-Efficient** | Validation runs outside LLM context (0 tokens) |
| **Detailed Feedback** | Specific check results guide retries |
| **Auditable** | validation.json provides clear state trail |

---

## 7. The Execution Cycle

### Overview

The agentic execution cycle flows from CLI through multiple layers and back, with validation after each subagent.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE AGENTIC EXECUTION CYCLE (v0.4)                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ [1] CLI LAYER                                                               │
│                                                                             │
│     User invokes command:                                                   │
│         looplia run writing-kit --file article.md                           │
│                                                                             │
│     CLI actions:                                                            │
│     ├─ Parse arguments → WorkflowConfig                                     │
│     ├─ Read workflows/writing-kit.md → Parse frontmatter + instructions     │
│     ├─ Create Session folder, write content.md                              │
│     ├─ Generate validation.json from frontmatter                            │
│     └─ Build prompt with workflow definition                                │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  Prompt: "Execute workflow 'writing-kit'
                                   │           for session: contentItem/{id}"
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [2] PROVIDER LAYER                                                          │
│                                                                             │
│     AgentExecutor.executeStreaming(prompt, outputSchema, ExecutorOptions)   │
│                                                                             │
│     Claude Agent SDK query() configuration:                                 │
│     ├─ cwd: Workspace path (~/.looplia/)                                    │
│     ├─ settingSources: ["project"]    ← Discover agents & skills            │
│     ├─ allowedTools: [Read, Write, Glob, Task, Skill]                       │
│     └─ prompt: Workflow execution instructions                              │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  SDK Session Created
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [3] MAIN AGENT (Generic Workflow Interpreter)                               │
│                                                                             │
│     Autonomous actions:                                                     │
│     ├─ Read CLAUDE.md → Understand interpreter instructions                 │
│     ├─ Read validation.json → Check which outputs need work                 │
│     └─ Execute outputs in dependency order via Task tool                    │
│                                                                             │
│     Available tools: Read, Write, Glob, Task, Skill                         │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  Task tool invocations
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [4] SUBAGENT LAYER (with auto-loaded skills)                                │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ Stage 1: content-analyzer                                           │ │
│     │ ├─ Auto-loaded skills: media-reviewer, content-documenter           │ │
│     │ ├─ Reads: contentItem/{id}/content.md                               │ │
│     │ └─ Writes: contentItem/{id}/summary.json                            │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                              ↓ validate with workflow-validator              │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ Stage 2: idea-generator                                             │ │
│     │ ├─ Auto-loaded skills: user-profile-reader                          │ │
│     │ ├─ Reads: summary.json, user-profile.json                           │ │
│     │ └─ Writes: contentItem/{id}/ideas.json                              │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                              ↓ validate with workflow-validator              │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ Stage 3: writing-kit-builder                                        │ │
│     │ ├─ Auto-loaded skills: user-profile-reader                          │ │
│     │ ├─ Reads: summary.json, ideas.json, user-profile.json               │ │
│     │ └─ Writes: outline.json, writing-kit.json                           │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                              ↓ validate with workflow-validator              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  All outputs validated
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [5] RETURN TO CLI                                                           │
│                                                                             │
│     Main Agent:                                                             │
│     ├─ All outputs.*.validated = true                                       │
│     ├─ Read contentItem/{id}/writing-kit.json                               │
│     └─ Return as structured output                                          │
│                                                                             │
│     CLI:                                                                    │
│     ├─ Receive CompleteEvent<WritingKit>                                    │
│     └─ Display result to user                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| CLI | Parse args, create session, generate validation.json, build prompt |
| Provider | Execute SDK query with settingSources, transform events |
| Main Agent | Read workflow, check validation state, invoke subagents, validate outputs |
| Subagent | Perform specialized task with auto-loaded skills, write artifact |
| Skill | Execute focused task inline within subagent session |

---

## 8. The Call Stack Concept

### Hierarchical Execution Model

The agent system executes as a call stack where each level has its own session context, with skills auto-loaded at the subagent level.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AGENT CALL STACK (v0.4)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stack Frame 0: CLI Process                                          │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Entry Point: looplia run writing-kit --file article.md          │ │    │
│  │ │ Creates: Session, validation.json from workflow frontmatter     │ │    │
│  │ │ Calls: AgentExecutor.executeStreaming()                         │ │    │
│  │ └──────────────────────────┬──────────────────────────────────────┘ │    │
│  └───────────────────────────┬┴────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stack Frame 1: Main Agent Session                                   │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Context: cwd = ~/.looplia/                                      │ │    │
│  │ │ Reads: CLAUDE.md (generic interpreter), validation.json         │ │    │
│  │ │ Tools: Read, Write, Glob, Task, Skill                           │ │    │
│  │ │ Calls: Task tool → Spawns Subagent with custom subagent_type    │ │    │
│  │ └──────────────────────────┬──────────────────────────────────────┘ │    │
│  └───────────────────────────┬┴────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stack Frame 2: Subagent Session (content-analyzer)                  │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Context: Inherited Workspace from Main Agent                    │ │    │
│  │ │ Auto-loaded Skills: media-reviewer, content-documenter          │ │    │
│  │ │ Tools: Read, Write, Skill                                       │ │    │
│  │ │ Reads: contentItem/{id}/content.md                              │ │    │
│  │ │ Writes: contentItem/{id}/summary.json                           │ │    │
│  │ └──────────────────────────┬──────────────────────────────────────┘ │    │
│  └───────────────────────────┬┴────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stack Frame 2.1: Skill Execution (media-reviewer) - INLINE          │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Context: Within content-analyzer session (auto-loaded)          │ │    │
│  │ │ Instructions: Loaded from SKILL.md                              │ │    │
│  │ │ Returns: Analysis results (implicit, within session)            │ │    │
│  │ └─────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Back to Main Agent: Validation                                      │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Uses: workflow-validator skill                                  │ │    │
│  │ │ Runs: bun scripts/validate.ts summary.json '{criteria}'         │ │    │
│  │ │ Result: { passed: true, checks: [...] }                         │ │    │
│  │ │ Updates: validation.json → outputs.summary.validated = true     │ │    │
│  │ │ Proceeds to: Stage 2 (idea-generator)                           │ │    │
│  │ └─────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Frame Characteristics

| Frame | Session | Tools | Skills |
|-------|---------|-------|--------|
| CLI | None (process) | N/A | N/A |
| Main Agent | Dedicated | Full toolset | Manual invocation |
| Subagent | Separate | Limited | **Auto-loaded from frontmatter** |
| Skill | Inline | None | Follows instructions |

---

## 9. Smart Continuation

### The Pattern

**Smart Continuation** uses `validation.json` to track output completion. The agent reads the validation state to determine what work remains.

### Validation State Structure

```json
{
  "workflow": "writing-kit",
  "outputs": {
    "summary": { "validated": true, "artifact": "summary.json", ... },
    "ideas": { "validated": true, "artifact": "ideas.json", ... },
    "writing-kit": { "validated": false, "artifact": "writing-kit.json", ... }
  }
}
```

### Decision Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SMART CONTINUATION DECISION PROCESS                       │
└─────────────────────────────────────────────────────────────────────────────┘

Prompt: "Execute workflow 'writing-kit' for session: contentItem/{id}"

┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: Read Validation State                                               │
│                                                                             │
│   Agent Action: Read contentItem/{id}/validation.json                       │
│   Result: { outputs: { summary: { validated: true }, ... } }                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 2: Check Artifact Existence                                            │
│                                                                             │
│   For each output with validated: true:                                     │
│   ├─ Verify artifact file exists                                            │
│   └─ Output is complete only if BOTH conditions met                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3: Decision Tree                                                       │
│                                                                             │
│   Validation State                │  Agent Decision                         │
│   ────────────────────────────────┼────────────────────────────────────────│
│   All outputs validated: false    │  Run all subagents from workflow        │
│   ────────────────────────────────┼────────────────────────────────────────│
│   summary.validated: true         │  Skip content-analyzer                  │
│   + summary.json exists           │  Run idea-generator, writing-kit-builder│
│   ────────────────────────────────┼────────────────────────────────────────│
│   All outputs validated: true     │  Skip all subagents                     │
│   + all artifacts exist           │  Read and return writing-kit.json       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fresh Session vs Resume

**Fresh Session (`--file`):**

```
looplia run writing-kit --file article.md

CLI:
├─ Creates new Session with unique Session-ID
├─ Writes content.md from file
├─ Generates validation.json from workflow frontmatter (all validated: false)
└─ Sends prompt to agent

Agent:
├─ Read validation.json: all outputs validated: false
└─ Runs full workflow: content-analyzer → idea-generator → writing-kit-builder
   (validating after each subagent)
```

**Resume Session (`--session-id`):**

```
looplia run writing-kit --session-id article-2025-12-17-abc123

CLI:
└─ Sends prompt with existing Session-ID

Agent:
├─ Read validation.json: some outputs already validated
├─ Skip validated outputs
└─ Continue from next pending output
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Resilience** | Interrupted work can be resumed |
| **Efficiency** | Validated outputs are not repeated |
| **Cost Savings** | Avoids re-running expensive analysis |
| **Debuggability** | validation.json provides clear state |
| **Integrity** | Dual check (validated flag + file exists) |

---

## Cross-References

- **Ubiquitous Language**: See [GLOSSARY.md](./GLOSSARY.md) for term definitions
- **Architecture Design**: See [DESIGN-0.5.1.md](./DESIGN-0.5.1.md) for implementation details
- **Agent Skills Reference**: See [AGENT-SKILLS.md](./AGENT-SKILLS.md) for Anthropic SDK patterns
- **Previous Version**: See [AGENTIC_CONCEPT-0.3.md](./AGENTIC_CONCEPT-0.3.md) for comparison

---

## Reference: Anthropic Official Documentation

### Core Concepts from Anthropic SDK

**Why Skills Matter**

> Skills are reusable, filesystem-based resources that provide Claude with domain-specific expertise: workflows, context, and best practices that transform general-purpose agents into specialists.

**Subagents with Custom Types**

The SDK supports custom subagent types via the Task tool:

```typescript
{
  "subagent_type": "content-analyzer",  // Custom name
  "prompt": "..."
}
```

**Skills Auto-Loading**

Subagents can auto-load skills via the `skills:` frontmatter field:

```yaml
---
name: content-analyzer
skills: media-reviewer, content-documenter
---
```

**SDK Configuration**

To enable custom subagents and skills:

1. Include `"Task"` and `"Skill"` in `allowedTools`
2. Configure `settingSources: ["project"]` to discover from filesystem
3. Agents are loaded from `.claude/agents/*.md`
4. Skills are loaded from `.claude/skills/*/SKILL.md`

### Official Documentation Links

- [Agent Skills Overview](/docs/en/agents-and-tools/agent-skills/overview)
- [Agent Skills in the SDK](/docs/en/agent-sdk/skills)
- [Subagents in the SDK](/docs/en/agent-sdk/subagents)

---

*This document describes the core agent system design for Looplia-Core v0.4 / v0.5.1.*
