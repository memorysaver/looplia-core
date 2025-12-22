# Agentic Concept: Skills-First Architecture

> **Version:** 1.0 (covers v0.6.1 + v0.6.2)
> **Date:** December 2025
> **Related:** [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) | [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) | [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [Bootstrap & Workspace](#3-bootstrap--workspace)
4. [CLI to Agent Flow](#4-cli-to-agent-flow)
5. [Skills-First Architecture](#5-skills-first-architecture)
6. [Workflow Definition](#6-workflow-definition)
7. [Execution Call Stack](#7-execution-call-stack)
8. [Validation & Hooks](#8-validation--hooks)
9. [Workflow Builder](#9-workflow-builder)
10. [Cross-References](#10-cross-references)

---

## 1. Introduction

### The Skills-First Paradigm

Looplia v0.6.1 introduces a **breaking change**: the transition from agent-centric to **skills-first architecture**. Instead of defining multiple specialized agents, workflows now declare which **skill** to execute and provide a natural language **mission** describing what to accomplish.

**Key insight:** Claude already has immense reasoning capability. Rather than constrain it with rigid agent definitions, we give it domain expertise (skills) and goals (missions), letting it determine the best approach.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **AI-First** | Design for Claude's capabilities, not around human developer limitations |
| **Progressive Disclosure** | CLAUDE.md → Commands → Skills → Workflows (layered context) |
| **Universal Orchestrator** | One skill-executor handles ALL workflow steps |
| **Schema-in-Skill** | Skills define their output schemas, not core TypeScript types |

### Version Progression

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.5.x | Agent System | Two-plugin model, agent definitions |
| **v0.6.0** | Steps-Based Workflows | `run: agents/X` syntax, validation.json |
| **v0.6.1** | **Skills-First** | Universal skill-executor, `skill:` + `mission:` |
| **v0.6.2** | **Per-Step Orchestration** | One step → one skill-executor → multiple skills |

---

## 2. Architecture Overview

### Two-Plugin Model

Looplia operates as two Claude Code plugins working in concert:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ~/.looplia (Workspace)                             │
├─────────────────────────────────┬───────────────────────────────────────────┤
│                                 │                                           │
│  looplia-core (Infrastructure)  │  looplia-writer (Domain Plugin)           │
│  ───────────────────────────────│───────────────────────────────────────────│
│                                 │                                           │
│  • CLAUDE.md (entry point)      │  • workflows/writing-kit.md               │
│  • commands/run.md              │  • skills/media-reviewer/                 │
│  • commands/build.md            │  • skills/idea-synthesis/                 │
│  • skills/workflow-executor/    │  • skills/writing-kit-assembler/          │
│  • skills/workflow-validator/   │  • user-profile.json                      │
│  • hooks/hooks.json             │                                           │
│                                 │                                           │
│  Provides: Execution Engine     │  Provides: Domain Logic                   │
│                                 │                                           │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

### Component Relationships

```
┌────────────┐     ┌────────────┐     ┌─────────────────┐     ┌───────────────┐
│    CLI     │────▶│   Claude   │────▶│  workflow-      │────▶│  skill-       │
│  (thin)    │     │   Agent    │     │  executor       │     │  executor     │
└────────────┘     └────────────┘     └─────────────────┘     └───────────────┘
      │                  │                    │                      │
      │                  │                    │                      │
      ▼                  ▼                    ▼                      ▼
   Sandbox          CLAUDE.md            Workflow             Domain Skills
   Creation         Loading              Definition           (mission-driven)
```

---

## 3. Bootstrap & Workspace

### Initialization Flow

When you run `looplia init`, the system:

1. Creates `~/.looplia/` workspace directory
2. Merges plugin files from `plugins/looplia-core/` and `plugins/looplia-writer/`
3. Sets up sandbox structure for isolated execution

```bash
$ looplia init
✓ Created ~/.looplia/
✓ Merged looplia-core files (commands, skills, hooks)
✓ Merged looplia-writer files (workflows, skills, user-profile)
```

### Workspace Structure

```
~/.looplia/
├── CLAUDE.md                    ← Entry point (auto-loaded by Claude)
├── commands/
│   ├── run.md                   ← /run command definition
│   └── build.md                 ← /build command definition
├── workflows/
│   └── writing-kit.md           ← Workflow definitions
├── .claude/
│   ├── settings.json            ← Claude Code configuration
│   └── skills/
│       ├── workflow-executor/   ← Core orchestration skill
│       ├── workflow-validator/  ← Validation skill
│       ├── media-reviewer/      ← Domain skill (looplia-writer)
│       ├── idea-synthesis/      ← Domain skill (looplia-writer)
│       └── ...
├── hooks/
│   └── hooks.json               ← Hook configuration
├── scripts/
│   └── hooks/
│       ├── post-write-validate.sh
│       ├── stop-guard.sh
│       └── compact-inject-state.sh
├── sandbox/                     ← Execution isolation
│   └── {content-id}/
│       ├── inputs/
│       ├── outputs/
│       ├── logs/
│       └── validation.json
└── user-profile.json            ← User preferences
```

### File Ownership

| Plugin | Owns | Purpose |
|--------|------|---------|
| **looplia-core** | CLAUDE.md, commands/*, workflow-executor, hooks/ | Execution infrastructure |
| **looplia-writer** | workflows/*, domain skills, user-profile.json | Content creation domain |

### CLAUDE.md: The Entry Point

`CLAUDE.md` is auto-loaded when Claude starts a session in the workspace. It provides:

- Available slash commands (`/run`, `/build`)
- Workspace structure overview
- Core skill references
- Tool usage rules (no subagents for file operations)

This is the **first layer of context injection** in the progressive disclosure model.

### Progressive Disclosure: File-to-File Flow

Each layer adds context incrementally, avoiding duplication:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROGRESSIVE DISCLOSURE ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────────┘

CLAUDE.md (~100 lines)
├── Identity: "You are a looplia workflow engine"
├── Commands: /run → Skill("workflow-executor"), /build → 3-skill pipeline
├── Tool rules: "No subagents for file operations"
└── Points to: commands/ and skills/
         │
         ▼
commands/run.md (~50 lines)
├── Usage: /run <workflow> --file <path>
├── Execution: "Use Skill('workflow-executor')"
└── Points to: workflow-executor SKILL.md for details
         │
         ▼
skills/workflow-executor/SKILL.md (~350 lines)
├── Full orchestration protocol
├── Per-step Task(skill-executor) invocation
├── Validation state management
└── Error handling and retries
         │
         ▼
skill-executor (inline subagent)
├── Receives: skill name + mission
├── Loads: skills/{name}/SKILL.md
└── Executes: mission-driven task
```

**Key Principle:** Each file contains ONLY its layer's logic, never duplicating lower layers.

| Layer | Responsibility | Size |
|-------|----------------|------|
| CLAUDE.md | Route commands to skills | ~100 lines |
| commands/*.md | Document usage, point to skills | ~50 lines |
| skills/*/SKILL.md | Implement domain logic | 100-400 lines |

**Anti-Pattern:** Putting orchestration logic in CLAUDE.md (duplicates workflow-executor).

---

## 4. CLI to Agent Flow

### Thin Wrapper Pattern

The CLI is intentionally minimal. It:
1. Creates sandbox structure
2. Copies input files
3. Builds a prompt
4. Delegates to Claude via the SDK

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CLI TO AGENT: THIN WRAPPER PATTERN                      │
└─────────────────────────────────────────────────────────────────────────────┘

$ looplia run writing-kit --file article.md
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLI Layer (apps/cli/src/commands/run.ts)                                     │
│                                                                              │
│  1. Generate contentId: article-2025-12-18-xk7m                              │
│  2. Create sandbox: ~/.looplia/sandbox/{contentId}/                          │
│  3. Copy: article.md → sandbox/{id}/inputs/content.md                        │
│  4. Build prompt: "/run writing-kit --sandbox-id {contentId}"                │
│  5. Call Claude Agent SDK                                                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Claude Agent (via SDK)                                                       │
│                                                                              │
│  • Auto-loads CLAUDE.md                                                      │
│  • Receives prompt: "/run writing-kit --sandbox-id article-2025-12-18-xk7m"  │
│  • Executes workflow using skill-executor subagent                           │
│  • Returns final artifact                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Available Commands

| Command | Purpose | Implementation |
|---------|---------|----------------|
| `/run <workflow> --sandbox-id <id>` | Execute workflow | workflow-executor skill |
| `/build <description>` | Generate new workflow | 3-skill pipeline |
| `/list-workflows` | Show available workflows | Direct file listing |

### SDK Adapter Layer

The `packages/provider/` package wraps the Claude Agent SDK:

```typescript
// Simplified SDK invocation
const result = await runClaudeAgent({
  workspace: LOOPLIA_WORKSPACE,
  prompt: `/run writing-kit --sandbox-id ${contentId}`,
  model: "haiku",
});
```

The SDK handles:
- Context injection (CLAUDE.md → Commands → Skills)
- Tool availability (Read, Write, Skill, Task, Bash)
- Subagent spawning via Task tool

---

## 5. Skills-First Architecture

### The Paradigm Shift

**Before (v0.6.0):** Workflows specified which agent to run.
```yaml
steps:
  - id: summary
    run: agents/content-analyzer    # ← Agent-centric
```

**After (v0.6.1):** Workflows specify skill + mission.
```yaml
steps:
  - id: summary
    skill: media-reviewer           # ← Skills-first
    mission: "Analyze the input content and extract key insights"
```

### Universal Skill-Executor

Instead of multiple specialized agents, **ONE subagent type** handles all workflow steps:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UNIVERSAL SKILL-EXECUTOR                              │
└─────────────────────────────────────────────────────────────────────────────┘

workflow-executor orchestrates steps by spawning skill-executor for each:

  Task tool call:
  {
    "subagent_type": "skill-executor",      ← SAME for ALL steps
    "prompt": "Execute media-reviewer skill with mission: ..."
  }

                    ┌─────────────────────────────────────────┐
                    │          skill-executor                  │
                    │                                          │
                    │  • Receives: skill name + mission        │
                    │  • Loads: skills/{name}/SKILL.md         │
                    │  • Reads: inputs from sandbox            │
                    │  • Executes: mission-driven analysis     │
                    │  • Writes: output to sandbox/outputs/    │
                    │                                          │
                    └─────────────────────────────────────────┘
```

### Skill Definition Format

Each skill is defined in a `SKILL.md` file:

```markdown
# Media Reviewer Skill

## Purpose
Analyze media content (articles, videos, podcasts) and extract structured insights.

## Inputs
- `inputs/content.md` - The source content to analyze

## Output Schema
Write to `outputs/summary.json`:
```json
{
  "contentId": "string",
  "title": "string",
  "sourceType": "article|video|podcast",
  "coreIdeas": ["string"],
  "quotes": [{"text": "string", "speaker": "string"}],
  "insights": ["string"]
}
```

## Execution Steps
1. Read the input content
2. Identify source type and extract metadata
3. Extract key quotes with attribution
4. Synthesize core ideas and insights
5. Write structured output following schema
```

### Schema-in-Skill (v0.6.2)

A key insight: **Skills define their own output schemas in SKILL.md, not in core TypeScript types.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SCHEMA-IN-SKILL ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

BEFORE (v0.6.1):                          AFTER (v0.6.2):
┌─────────────────────────┐              ┌─────────────────────────┐
│ @looplia-core/core      │              │ @looplia-core/core      │
│                         │              │ (GENERIC ONLY)          │
│ - ContentSummary    ────┼───┐          │                         │
│ - WritingIdeas      ────┼───┼─DELETE   │ - ContentItem           │
│ - WritingKit        ────┼───┘          │ - WorkflowDefinition    │
│                         │              │ - UserProfile           │
└─────────────────────────┘              └─────────────────────────┘
          │                                        │
          │                                        │
          ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    skills/{name}/SKILL.md                                    │
│                    └── Output schema as JSON example                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Core stays generic and minimal
- Plugins define their own domain schemas
- No TypeScript type coupling between core and domain
- Workflows validate against SKILL.md schemas

### Mission-Driven Execution

The `mission:` field provides natural language guidance:

```yaml
steps:
  - id: ideas
    skill: idea-synthesis
    mission: |
      Using the content summary and user profile, generate
      creative writing angles. Focus on hooks that would
      resonate with the user's preferred writing style.
```

This lets Claude adapt its approach while staying within skill guardrails.

### Per-Step Orchestration (v0.6.2)

A critical architectural principle: **One workflow step triggers exactly one skill-executor call, which may invoke multiple skills to accomplish the step's mission.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PER-STEP ORCHESTRATION PRINCIPLE                          │
└─────────────────────────────────────────────────────────────────────────────┘

Workflow Definition (writing-kit.md):
┌─────────────────────────────────────────────────────────────────────────────┐
│  steps:                                                                      │
│    - id: summary         ──────► Task(skill-executor) #1                    │
│    - id: ideas           ──────► Task(skill-executor) #2                    │
│    - id: writing-kit     ──────► Task(skill-executor) #3                    │
└─────────────────────────────────────────────────────────────────────────────┘

Each Task(skill-executor) call:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Task({                                                                      │
│    "subagent_type": "skill-executor",                                        │
│    "description": "Execute step: summary",                                   │
│    "prompt": "Execute skill 'media-reviewer' for step 'summary'.\n           │
│               Mission: Deep analysis of content...\n                         │
│               Input: sandbox/.../inputs/content.md\n                         │
│               Output: sandbox/.../outputs/summary.json"                      │
│  })                                                                          │
│                                                                              │
│  skill-executor receives this and may:                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Skill("media-reviewer")  ← Primary skill for this step               │ │
│  │ • Skill("user-profile-reader")  ← Supporting skill if needed           │ │
│  │ • Write output to sandbox/outputs/summary.json                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Rules:**

| Rule | Description |
|------|-------------|
| **One Step = One Task** | Each workflow step triggers exactly one `Task(skill-executor)` call |
| **Never Batch Steps** | Never call skill-executor once for the entire workflow |
| **Multiple Skills OK** | skill-executor can invoke multiple skills via `Skill` tool |
| **Mission Defines Goal** | The `mission:` field tells skill-executor what to accomplish |
| **Output Required** | Each step must write its output to the specified path |

**Why This Matters:**

1. **Isolation**: Each step runs in its own subagent context
2. **Validation**: Hooks can validate each step's output independently
3. **Retry**: Failed steps can be retried without re-running the entire workflow
4. **Logging**: Each Task call is logged separately for debugging
5. **Resumability**: Workflow can resume from any validated checkpoint

### Skill Description Best Practices

Skills should have descriptions that enable accurate triggering:

```yaml
# Good: Specific trigger phrases, looplia-specific terminology
description: |
  This skill should be used when the user wants to execute a looplia workflow,
  run workflow steps, or process a workflow.md file. Use when someone says
  "run the looplia workflow", "execute this looplia pipeline", "/run writing-kit",
  or "start the looplia automation".

# Bad: Too terse, no trigger phrases
description: Execute workflow steps, invoke skills, manage state
```

**Description Guidelines:**

1. Use third person: "This skill should be used when..."
2. Include specific trigger phrases users would say
3. Reference "looplia workflow" (not just "workflow")
4. Explain the skill's role in the architecture
5. Target 50-100 words for optimal triggering

---

## 6. Workflow Definition

### v0.6.1 Schema

Workflows use YAML frontmatter with the skills-first format:

```yaml
---
id: writing-kit
name: Writing Kit Generator
description: Transform content into actionable writing materials
version: "1.0"

steps:
  - id: summary
    skill: media-reviewer
    mission: "Analyze the input content and extract key insights, quotes, and core ideas"
    output: outputs/summary.json

  - id: ideas
    skill: idea-synthesis
    mission: "Generate writing angles based on summary and user profile preferences"
    output: outputs/ideas.json
    needs: [summary]

  - id: writing-kit
    skill: writing-kit-assembler
    mission: "Combine summary and ideas into a comprehensive writing kit"
    output: outputs/writing-kit.json
    needs: [summary, ideas]
    final: true
---

# Writing Kit Workflow

This workflow transforms source content into a structured writing kit...
```

### Key Schema Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique step identifier |
| `skill` | Yes | Which skill to load for this step |
| `mission` | Yes | Natural language goal for the skill |
| `output` | Yes | Path to write output (relative to sandbox) |
| `needs` | No | Array of step IDs this depends on |
| `final` | No | Marks the final output step |

### Variable Substitution

Workflows can reference sandbox paths:

```yaml
mission: |
  Read the content from ${inputs.content} and the summary from ${outputs.summary}.
  Generate ideas that build on the core themes identified.
```

### Dependency Resolution

The workflow-executor performs topological sort on `needs`:

```
                    summary
                       │
                       ▼
                     ideas
                       │
                       ▼
                  writing-kit (final)
```

Steps execute in order: `summary → ideas → writing-kit`

---

## 7. Execution Call Stack

### Complete Execution Trace

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    WORKFLOW EXECUTION CALL STACK                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

$ looplia run writing-kit --file article.md
│
├─► [CLI] Generate contentId: article-2025-12-18-xk7m
├─► [CLI] Create sandbox: ~/.looplia/sandbox/{contentId}/
├─► [CLI] Copy article.md → sandbox/{id}/inputs/content.md
├─► [CLI] Call Claude Agent SDK
│
│   ┌───────────────────────────────────────────────────────────────────────────┐
│   │ CLAUDE AGENT SESSION                                                       │
│   │                                                                            │
│   │  ┌─ CONTEXT INJECTION ─────────────────────────────────────────────────┐  │
│   │  │ 1. Auto-load ~/.looplia/CLAUDE.md                                   │  │
│   │  │ 2. Receive prompt: "/run writing-kit --sandbox-id {contentId}"      │  │
│   │  │ 3. Read commands/run.md (slash command definition)                  │  │
│   │  └─────────────────────────────────────────────────────────────────────┘  │
│   │                                    │                                       │
│   │                                    ▼                                       │
│   │  ┌─ WORKFLOW-EXECUTOR SKILL ───────────────────────────────────────────┐  │
│   │  │ 4. Use Skill tool: workflow-executor                                │  │
│   │  │ 5. Read workflows/writing-kit.md                                    │  │
│   │  │ 6. Parse YAML frontmatter → steps[]                                 │  │
│   │  │ 7. Generate validation.json (all steps: validated=false)            │  │
│   │  │ 8. Topological sort: [summary, ideas, writing-kit]                  │  │
│   │  └─────────────────────────────────────────────────────────────────────┘  │
│   │                                    │                                       │
│   │                                    ▼                                       │
│   │  ┌─ STEP EXECUTION LOOP ───────────────────────────────────────────────┐  │
│   │  │                                                                      │  │
│   │  │  ┌─ STEP 1: summary ──────────────────────────────────────────────┐ │  │
│   │  │  │                                                                 │ │  │
│   │  │  │  Task tool call:                                                │ │  │
│   │  │  │  {                                                              │ │  │
│   │  │  │    "subagent_type": "skill-executor",                           │ │  │
│   │  │  │    "prompt": "Execute media-reviewer skill..."                  │ │  │
│   │  │  │  }                                                              │ │  │
│   │  │  │                                                                 │ │  │
│   │  │  │  ┌─ SKILL-EXECUTOR SUBAGENT ─────────────────────────────────┐  │ │  │
│   │  │  │  │ • Load skills/media-reviewer/SKILL.md                     │  │ │  │
│   │  │  │  │ • Read inputs/content.md                                  │  │ │  │
│   │  │  │  │ • Execute mission: analyze and extract                    │  │ │  │
│   │  │  │  │ • Write outputs/summary.json                              │  │ │  │
│   │  │  │  └───────────────────────────────────────────────────────────┘  │ │  │
│   │  │  │                                │                                │ │  │
│   │  │  │  ┌─ HOOK: PostToolUse:Write ───┴───────────────────────────┐    │ │  │
│   │  │  │  │ post-write-validate.sh → validates JSON → updates state │    │ │  │
│   │  │  │  └─────────────────────────────────────────────────────────┘    │ │  │
│   │  │  │                                                                 │ │  │
│   │  │  └─────────────────────────────────────────────────────────────────┘ │  │
│   │  │                                                                      │  │
│   │  │  ┌─ STEP 2: ideas ────────────────────────────────────────────────┐ │  │
│   │  │  │ (Same pattern: skill-executor → idea-synthesis → output)       │ │  │
│   │  │  └─────────────────────────────────────────────────────────────────┘ │  │
│   │  │                                                                      │  │
│   │  │  ┌─ STEP 3: writing-kit (final) ──────────────────────────────────┐ │  │
│   │  │  │ (Same pattern: skill-executor → writing-kit-assembler → output)│ │  │
│   │  │  └─────────────────────────────────────────────────────────────────┘ │  │
│   │  │                                                                      │  │
│   │  └──────────────────────────────────────────────────────────────────────┘  │
│   │                                    │                                       │
│   │                                    ▼                                       │
│   │  ┌─ COMPLETION ────────────────────────────────────────────────────────┐  │
│   │  │ 9. All steps validated → return final artifact                      │  │
│   │  │                                                                      │  │
│   │  │  ┌─ HOOK: Stop ────────────────────────────────────────────────┐    │  │
│   │  │  │ stop-guard.sh → checks all validated → allows completion    │    │  │
│   │  │  └─────────────────────────────────────────────────────────────┘    │  │
│   │  └──────────────────────────────────────────────────────────────────────┘  │
│   │                                                                            │
│   └────────────────────────────────────────────────────────────────────────────┘
│
└─► [CLI] Receive result, display to user
```

For detailed context injection flow, see [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md).

---

## 8. Validation & Hooks

### Hook System Overview

Hooks provide **deterministic guardrails** that run outside the LLM context:

| Hook Event | Script | Purpose |
|------------|--------|---------|
| `SessionStart` | `echo` | Log session start |
| `PostToolUse:Write` | `post-write-validate.sh` | Validate artifact JSON |
| `Stop` | `stop-guard.sh` | Block early completion |
| `SessionStart:compact` | `compact-inject-state.sh` | Re-inject state |

### Hook Configuration

```json
// hooks/hooks.json
{
  "hooks": [
    { "event": "SessionStart", "command": "echo '>>> Looplia session started'" },
    { "event": "PostToolUse", "matcher": "Write", "command": "post-write-validate.sh" },
    { "event": "Stop", "command": "stop-guard.sh" },
    { "event": "SessionStart", "matcher": "compact", "command": "compact-inject-state.sh" }
  ]
}
```

### Validation State Machine

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    validation.json                           │
                    │  {                                                           │
                    │    "workflow": "writing-kit",                                 │
                    │    "steps": {                                                 │
                    │      "summary": { "validated": true },    ◄─── Updated by    │
                    │      "ideas": { "validated": true },      ◄─── post-write-   │
                    │      "writing-kit": { "validated": false }◄─── validate.sh   │
                    │    }                                                         │
                    │  }                                                           │
                    └──────────────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
                    ▼                                                   ▼
        ┌───────────────────────┐                       ┌───────────────────────┐
        │   stop-guard.sh       │                       │ compact-inject-state  │
        │   reads to check      │                       │ reads to re-inject    │
        │   completion status   │                       │ progress state        │
        └───────────────────────┘                       └───────────────────────┘
                    │                                                   │
                    ▼                                                   ▼
        ┌───────────────────────┐                       ┌───────────────────────┐
        │ IF pending:           │                       │ Outputs to Claude:    │
        │ {"decision":"block"}  │                       │ "summary: ✓ validated"│
        │                       │                       │ "ideas: ⏳ pending"   │
        │ ELSE: allow stop      │                       │                       │
        └───────────────────────┘                       └───────────────────────┘
```

### Protection Scenarios

**Invalid JSON:** Hook blocks write, Claude retries.
**Early Stop:** Hook returns `{"decision":"block"}`, Claude continues.
**Context Compaction:** Hook re-injects state, Claude resumes correctly.

For detailed hook implementation, see [HOOK_VALIDATOR.md](./HOOK_VALIDATOR.md).

---

## 9. Workflow Builder

### The /build Command

The `/build` command generates new workflows from natural language descriptions:

```bash
$ looplia build "Create a workflow that summarizes podcasts and generates social media posts"
```

### Three-Skill Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW BUILDER: /build COMMAND                          │
└─────────────────────────────────────────────────────────────────────────────┘

User: "/build Create a podcast-to-social workflow"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SKILL 1: plugin-registry-scanner                                             │
│                                                                              │
│  • Scan all installed plugins                                                │
│  • List available skills with capabilities                                   │
│  • Output: skills-registry.json                                              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SKILL 2: skill-capability-matcher                                            │
│                                                                              │
│  • Match user request to available skills                                    │
│  • Identify required skills for the workflow                                 │
│  • Output: matched-skills.json                                               │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SKILL 3: workflow-schema-composer                                            │
│                                                                              │
│  • Compose workflow YAML from matched skills                                 │
│  • Add missions, dependencies, outputs                                       │
│  • Output: workflows/{new-workflow}.md                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌───────────────────┐
                         │  New workflow     │
                         │  ready to /run    │
                         └───────────────────┘
```

### Context-Based Communication

Skills communicate through files in the sandbox, not function calls:

```
sandbox/{build-id}/
├── inputs/
│   └── request.txt           ← User's description
├── outputs/
│   ├── skills-registry.json  ← Skill 1 output → Skill 2 input
│   ├── matched-skills.json   ← Skill 2 output → Skill 3 input
│   └── workflow.md           ← Final generated workflow
└── validation.json
```

---

## 10. Cross-References

### Related Documents

| Document | Focus |
|----------|-------|
| [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) | Skills-first architecture details |
| [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) | Schema-in-Skill architecture |
| [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) | Detailed context flow diagram |
| [HOOK_VALIDATOR.md](./HOOK_VALIDATOR.md) | Hook system implementation |
| [GLOSSARY.md](./GLOSSARY.md) | Ubiquitous language definitions |
| [archive/AGENTIC_CONCEPT-0.5.md](./archive/AGENTIC_CONCEPT-0.5.md) | Historical agent-centric design |

### Migration: v0.6.0 → v0.6.1

| Aspect | v0.6.0 | v0.6.1 |
|--------|--------|--------|
| Step execution | `run: agents/{name}` | `skill:` + `mission:` |
| Subagent type | Multiple (per agent) | Universal `skill-executor` |
| Agent definitions | `.claude/agents/{name}.md` | Deleted (legacy) |
| Domain types | In core TypeScript | In SKILL.md as JSON schema |

### Key Takeaways

1. **Skills replace agents** as the primary unit of domain logic
2. **Missions provide flexibility** while skills provide guardrails
3. **One skill-executor** handles all workflow steps
4. **Schemas live in skills**, keeping core generic
5. **Hooks enforce validation** outside LLM context
6. **File-based communication** enables loose coupling

---

*This document provides a concise overview of Looplia's skills-first architecture (v0.6.1/v0.6.2). For implementation details, consult the referenced design documents.*
