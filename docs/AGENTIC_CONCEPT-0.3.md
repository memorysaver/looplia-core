# Looplia-Core: Agent System Design

> Claude Agent SDK-Based Agentic Architecture with Pipeline-as-Configuration
>
> **Version:** 0.3
> **Date:** 2025-12-12
> **Related:** [GLOSSARY.md](./GLOSSARY.md) | [CHANGELOG.md](../CHANGELOG.md)

This document describes the core agent system design of Looplia-Core, focusing on the Claude Agent SDK runtime model and Pipeline-as-Configuration pattern. It uses ubiquitous language defined in GLOSSARY.md.

---

## Table of Contents

1. [Introduction: The SDK-Based Agent Runtime](#1-introduction-the-sdk-based-agent-runtime)
2. [Workspace: The Agent's Runtime Environment](#2-workspace-the-agents-runtime-environment)
3. [Pipeline-as-Configuration](#3-pipeline-as-configuration)
4. [The Execution Cycle](#4-the-execution-cycle)
5. [The Call Stack Concept](#5-the-call-stack-concept)
6. [Skills: Filesystem-Based Capabilities](#6-skills-filesystem-based-capabilities)
7. [Agent-to-Agent Communication](#7-agent-to-agent-communication)
8. [Smart Continuation: Manifest-Based State Tracking](#8-smart-continuation-manifest-based-state-tracking)
9. [Reference: Anthropic Official Documentation](#reference-anthropic-official-documentation)

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

**Pipeline-as-Configuration** (v0.5.0)

Workflows are defined declaratively in YAML files. The agent reads pipeline definitions to understand the dependency graph and executes steps accordingly.

**Workspace as Runtime**

The agent operates within a **Workspace** (`~/.looplia/`) with full filesystem access. The Workspace provides:
- Instructions via **CLAUDE.md**
- Personalization via **UserProfile**
- Pipeline definitions via **pipelines/*.yaml**
- Session state via **contentItem** folder and **session.json**
- Capabilities via **Skills** and **Subagents**

**File-Based State**

All agent state persists as files. There is no in-memory handoff between agents. This enables:
- **Smart Continuation**: Resume interrupted work via session manifest
- **Auditability**: Inspect all intermediate outputs
- **Debugging**: Review agent decisions via logs

**Natural Language Behavior**

Agent behavior is defined in markdown files, not code:
- **CLAUDE.md**: Main Agent instructions
- **.claude/agents/*.md**: Subagent definitions (SDK convention)
- **.claude/skills/*/SKILL.md**: Skill definitions (SDK convention)
- **pipelines/*.yaml**: Pipeline definitions

### SDK Tools

The Claude Agent SDK provides tools that agents use to interact with the Workspace:

| Tool | Purpose |
|------|---------|
| **Read** | Read file contents |
| **Write** | Write file contents |
| **Glob** | Pattern match files |
| **Task** | Spawn Subagent |
| **Skill** | Invoke Skill |
| **StructuredOutput** | Return typed result |

---

## 2. Workspace: The Agent's Runtime Environment

### Structure Overview

The **Workspace** is the agent's runtime environment - a persistent filesystem where all agent operations occur.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKSPACE STRUCTURE (v0.5.0)                             │
│                    ~/.looplia/                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ~/.looplia/                          ← Agent's cwd (current working dir)   │
│  │                                                                          │
│  ├── CLAUDE.md                        ← Main Agent Instructions             │
│  │                                      The "brain" - defines behavior      │
│  │                                                                          │
│  ├── user-profile.json                ← UserProfile                         │
│  │                                      Personalization: topics, style      │
│  │                                                                          │
│  ├── pipelines/                       ← Pipeline Definitions (v0.5.0)       │
│  │   └── writing-kit.yaml               Declarative workflow configuration  │
│  │                                                                          │
│  ├── contentItem/                     ← Session Storage                     │
│  │   └── {Session-ID}/                  One folder per Session              │
│  │       ├── session.json               SessionManifest (v0.5.0)            │
│  │       ├── content.md                 ContentItem (input)                 │
│  │       ├── summary.json               ContentSummary                      │
│  │       ├── ideas.json                 WritingIdeas                        │
│  │       ├── outline.json               OutlineSection[]                    │
│  │       └── writing-kit.json           WritingKit (final output)           │
│  │                                                                          │
│  └── .claude/                         ← SDK Convention Directory            │
│      ├── agents/                        Subagent definitions                │
│      │   ├── content-analyzer.md                                            │
│      │   ├── idea-generator.md                                              │
│      │   └── writing-kit-builder.md                                         │
│      │                                                                      │
│      └── skills/                        Skill definitions                   │
│          ├── media-reviewer/SKILL.md                                        │
│          ├── content-documenter/SKILL.md                                    │
│          ├── user-profile-reader/SKILL.md                                   │
│          ├── writing-enhancer/SKILL.md                                      │
│          └── id-generator/SKILL.md                                          │
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
| `CLAUDE.md` | Main Agent behavior |
| `user-profile.json` | User personalization |
| `pipelines/` | Workflow definitions |
| `contentItem/` | Session data (input/output) |
| `.claude/agents/` | Subagent definitions (SDK convention) |
| `.claude/skills/` | Skill definitions (SDK convention) |

### Session Lifecycle

1. **Creation**: CLI creates Session folder with `content.md` and `session.json`
2. **Execution**: Agents read pipeline, check manifest, execute pending steps
3. **Completion**: Final `writing-kit.json` represents output, manifest updated
4. **Continuation**: Resume via `--session-id` flag, agent reads manifest

---

## 3. Pipeline-as-Configuration

### Overview (v0.5.0)

**Pipeline-as-Configuration** is a declarative approach where workflows are defined in YAML files rather than hardcoded in TypeScript. The agent reads the pipeline definition to understand:

- What outputs need to be produced
- Which agent handles each output
- Dependencies between outputs
- Which output is the final artifact

### Pipeline Definition Format

```yaml
# ~/.looplia/pipelines/writing-kit.yaml
name: writing-kit
description: Transform content into a structured writing kit

outputs:
  summary:
    artifact: summary.json
    agent: content-analyzer

  ideas:
    artifact: ideas.json
    agent: idea-generator
    requires: [summary]

  writing-kit:
    artifact: writing-kit.json
    agent: writing-kit-builder
    requires: [ideas]
    final: true
```

### Pipeline Properties

| Property | Description |
|----------|-------------|
| `name` | Unique pipeline identifier |
| `description` | Human-readable description |
| `outputs` | Map of output names to configurations |
| `outputs.*.artifact` | File name for the output |
| `outputs.*.agent` | Subagent responsible for producing output |
| `outputs.*.requires` | Dependencies (other outputs) |
| `outputs.*.final` | Marks the final output artifact |

### Agent-Driven Execution

The agent reads the pipeline definition and:

1. **Parses Dependencies**: Builds a dependency graph from `requires` fields
2. **Checks Session State**: Reads `session.json` to find completed steps
3. **Determines Work**: Identifies which outputs still need to be produced
4. **Executes Sequentially**: Invokes subagents in dependency order
5. **Updates Manifest**: Marks steps as "done" after successful completion

### Benefits

| Benefit | Description |
|---------|-------------|
| **Declarative** | Workflows defined in YAML, not code |
| **Flexible** | Easy to modify pipelines without code changes |
| **Transparent** | Agent reasoning visible in prompt |
| **Extensible** | Add new pipelines by adding YAML files |

---

## 4. The Execution Cycle

### Overview

The agentic execution cycle flows from CLI through multiple layers and back.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE AGENTIC EXECUTION CYCLE                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ [1] CLI LAYER                                                               │
│                                                                             │
│     User invokes command:                                                   │
│         looplia run --file article.md                                       │
│                                                                             │
│     CLI actions:                                                            │
│     ├─ Parse arguments → KitConfig                                          │
│     ├─ SessionManager.prepare() → Create Session, write ContentItem         │
│     ├─ CommandRegistry.getCommand("kit") → CommandDefinition<WritingKit>    │
│     └─ promptTemplate(PromptContext) → Minimal prompt string                │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  Prompt: "Build WritingKit for session:
                                   │           contentItem/{Session-ID}"
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [2] PROVIDER LAYER                                                          │
│                                                                             │
│     AgentExecutor.executeStreaming(prompt, outputSchema, ExecutorOptions)   │
│                                                                             │
│     Claude Agent SDK query() configuration:                                 │
│     ├─ cwd: Workspace path (~/.looplia/)                                    │
│     ├─ allowedTools: [Read, Write, Glob, Task, Skill, StructuredOutput]     │
│     ├─ settingSources: ["user", "project"]                                  │
│     └─ prompt: Minimal task description                                     │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  SDK Session Created
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [3] MAIN AGENT (Orchestrator)                                               │
│                                                                             │
│     Autonomous actions:                                                     │
│     ├─ Read CLAUDE.md → Understand task instructions                        │
│     ├─ Read pipelines/writing-kit.yaml → Understand workflow                │
│     ├─ Read contentItem/{id}/session.json → Check completed steps           │
│     └─ Smart Continuation → Decide which Subagents to invoke                │
│                                                                             │
│     Available tools: Read, Write, Glob, Task, Skill, StructuredOutput       │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  Task tool invocations
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [4] SUBAGENT LAYER                                                          │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ content-analyzer Subagent                                           │ │
│     │ ├─ Reads: contentItem/{id}/content.md                               │ │
│     │ ├─ Invokes: media-reviewer Skill, content-documenter Skill          │ │
│     │ └─ Writes: contentItem/{id}/summary.json                            │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ idea-generator Subagent                                             │ │
│     │ ├─ Reads: summary.json, user-profile.json                           │ │
│     │ └─ Writes: contentItem/{id}/ideas.json                              │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ writing-kit-builder Subagent                                        │ │
│     │ ├─ Reads: summary.json, ideas.json, user-profile.json               │ │
│     │ └─ Writes: outline.json, writing-kit.json                           │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  After each Subagent: Update session.json
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [5] SKILL LAYER                                                             │
│                                                                             │
│     Skills are invoked by Subagents when specialized expertise is needed:   │
│     ├─ media-reviewer: 9-step deep content analysis                         │
│     ├─ content-documenter: Structure all ContentSummary fields              │
│     ├─ user-profile-reader: Calculate relevance scores                      │
│     ├─ writing-enhancer: Apply style personalization                        │
│     └─ id-generator: Generate Session-IDs                                   │
│                                                                             │
│     Skills execute inline within the Subagent's session.                    │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  Results written to Workspace
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [6] RETURN TO MAIN AGENT                                                    │
│                                                                             │
│     After all Subagents complete:                                           │
│     ├─ Read contentItem/{id}/writing-kit.json                               │
│     └─ StructuredOutput → CommandResult<WritingKit>                         │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  CompleteEvent<WritingKit>
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [7] BACK TO CLI                                                             │
│                                                                             │
│     During execution:                                                       │
│     └─ StreamingEvent flow (ToolStartEvent, ProgressEvent, UsageEvent)      │
│                                                                             │
│     On completion:                                                          │
│     ├─ CompleteEvent<WritingKit> received                                   │
│     ├─ Renderer formats output                                              │
│     └─ Display WritingKit to user                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| CLI | Parse arguments, create Session, send minimal prompt, render result |
| Provider | Execute SDK query, transform StreamingEvents |
| Main Agent | Read pipeline, check manifest, invoke Subagents, return result |
| Subagent | Perform specialized workflow, invoke Skills, write outputs |
| Skill | Execute focused task, return results to invoking agent |

---

## 5. The Call Stack Concept

### Hierarchical Execution Model

The agent system executes as a call stack where each level has its own session context.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AGENT CALL STACK                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stack Frame 0: CLI Process                                          │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Entry Point: looplia run --file article.md                      │ │    │
│  │ │ Creates: Session, ContentItem in Workspace                      │ │    │
│  │ │ Calls: AgentExecutor.executeStreaming()                         │ │    │
│  │ └──────────────────────────┬──────────────────────────────────────┘ │    │
│  └───────────────────────────┬┴────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stack Frame 1: Main Agent Session                                   │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Context: cwd = ~/.looplia/                                      │ │    │
│  │ │ Reads: CLAUDE.md, pipelines/writing-kit.yaml, session.json      │ │    │
│  │ │ Tools: Read, Write, Glob, Task, Skill, StructuredOutput         │ │    │
│  │ │ Calls: Task tool → Spawns Subagent                              │ │    │
│  │ └──────────────────────────┬──────────────────────────────────────┘ │    │
│  └───────────────────────────┬┴────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stack Frame 2: Subagent Session (content-analyzer)                  │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Context: Inherited Workspace from Main Agent                    │ │    │
│  │ │ Reads: contentItem/{id}/content.md                              │ │    │
│  │ │ Tools: Read, Write, Skill                                       │ │    │
│  │ │ Calls: Skill tool → Invokes Skill                               │ │    │
│  │ └──────────────────────────┬──────────────────────────────────────┘ │    │
│  └───────────────────────────┬┴────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stack Frame 3: Skill Execution (media-reviewer)                     │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Context: Inline within Subagent session                         │ │    │
│  │ │ Instructions: Loaded from SKILL.md                              │ │    │
│  │ │ Returns: Analysis results (implicit, within session)            │ │    │
│  │ └──────────────────────────┬──────────────────────────────────────┘ │    │
│  └───────────────────────────┬┴────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Stack Unwind: Skill → Subagent → Main Agent → CLI                   │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ Frame 3: Skill completes → Returns to Subagent                  │ │    │
│  │ │ Frame 2: Subagent writes summary.json → Returns to Main Agent   │ │    │
│  │ │ Frame 1: Main Agent updates session.json → Invokes next Subagent│ │    │
│  │ │          ... repeats for idea-generator, writing-kit-builder    │ │    │
│  │ │ Frame 1: Main Agent reads writing-kit.json → StructuredOutput   │ │    │
│  │ │ Frame 0: CLI receives CompleteEvent → Renders to user           │ │    │
│  │ └─────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Call Stack Properties

| Property | Description |
|----------|-------------|
| **Synchronous** | Each frame waits for child frames to complete |
| **Context Inheritance** | Workspace and tools flow down the stack |
| **File-Based Communication** | Results passed via Workspace files, not memory |
| **Typed Return** | StructuredOutput returns typed result to CLI |

### Frame Characteristics

| Frame | Session | Tools | Communication |
|-------|---------|-------|---------------|
| CLI | None (process) | N/A | Arguments in, JSON out |
| Main Agent | Dedicated | Full toolset | CLAUDE.md + pipeline instructions |
| Subagent | Separate | Limited toolset | Task tool invocation |
| Skill | Inline | None (instructions only) | Skill tool invocation |

---

## 6. Skills: Filesystem-Based Capabilities

### What are Skills?

**Skills** are focused capabilities that agents invoke for specialized expertise. Based on the Claude Agent SDK specification:

- Skills are **filesystem artifacts** (`SKILL.md` files)
- Skills are **loaded via settingSources** configuration
- Skills are **model-invoked** (Claude autonomously chooses when to use)
- Skills execute **inline** within the invoking agent's session

### Skill vs Subagent

| Aspect | Skill | Subagent |
|--------|-------|----------|
| **Invoked by** | Subagent (or Main Agent) | Main Agent only |
| **Tool used** | Skill tool | Task tool |
| **Session** | Inline (same session) | Separate session |
| **Definition file** | `.claude/skills/*/SKILL.md` | `.claude/agents/*.md` |
| **Scope** | Single focused task | Multi-step workflow |
| **Discovery** | Auto-discovered at startup | Explicitly named in Task |
| **Tool access** | None (instructions only) | Read, Write, Skill |

### Skill Locations

Skills are discovered from filesystem locations (SDK convention):

```
Project Skills (shared via git):
  .claude/skills/*/SKILL.md

User Skills (personal):
  ~/.claude/skills/*/SKILL.md

Looplia Workspace Skills:
  ~/.looplia/.claude/skills/*/SKILL.md
```

### Skill Discovery Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SKILL DISCOVERY FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

[1] CLI: looplia init
    │
    └─ Deploys plugins/looplia-writer/ to ~/.looplia/
       └─ Skills copied to ~/.looplia/.claude/skills/
          ├─ media-reviewer/SKILL.md
          ├─ content-documenter/SKILL.md
          └─ ... other skills

[2] SDK Session Created with settingSources: ["project"]
    │
    └─ SDK scans .claude/skills/ directories
       └─ Skill metadata loaded (descriptions for matching)

[3] Agent Running
    │
    └─ Agent decides to invoke Skill based on task
       └─ "I need to analyze this content deeply"
          └─ Matches media-reviewer description
             └─ Skill tool invoked

[4] Skill Execution
    │
    └─ SKILL.md content loaded as instructions
       └─ Agent follows instructions inline
          └─ Results implicit within session
```

### Current Skills

| Skill | Purpose | Invoked By |
|-------|---------|------------|
| **media-reviewer** | 9-step deep content analysis | content-analyzer |
| **content-documenter** | Structure all 15 ContentSummary fields | content-analyzer |
| **user-profile-reader** | Calculate relevance scores | idea-generator |
| **writing-enhancer** | Apply style personalization | writing-kit-builder |
| **id-generator** | Generate Session-IDs | Main Agent |

### SKILL.md Structure

Skills are defined with YAML frontmatter and Markdown instructions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SKILL.md Structure                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ---                                                                         │
│ name: skill-name                   ← Unique identifier                      │
│ description: |                     ← Used for auto-matching                 │
│   When to invoke this skill and what it does.                               │
│   This text helps Claude decide when to use it.                             │
│ ---                                                                         │
│                                                                             │
│ # Skill Title                                                               │
│                                                                             │
│ Detailed instructions for the skill...                                      │
│                                                                             │
│ ## Steps                                                                    │
│ 1. First step                                                               │
│ 2. Second step                                                              │
│                                                                             │
│ ## Output                                                                   │
│ What this skill produces...                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Agent-to-Agent Communication

### File-Based Communication Pattern

Agents communicate exclusively through the Workspace filesystem. There is no in-memory data transfer.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FILE-BASED AGENT COMMUNICATION                          │
└─────────────────────────────────────────────────────────────────────────────┘

Main Agent                          Workspace                         Subagent
    │                                   │                                │
    │                                   │                                │
    │ ──── Read session.json ──────────►│                                │
    │◄──── { steps: {} } ───────────────│                                │
    │                                   │                                │
    │ ──── Task("content-analyzer") ───►│                                │
    │      "Analyze contentItem/{id}"   │                                │
    │                                   │                                │
    │                                   │◄──── Read content.md ──────────│
    │                                   │      (ContentItem)             │
    │                                   │                                │
    │                                   │      [Skill: media-reviewer]   │
    │                                   │      [Skill: content-documenter]
    │                                   │                                │
    │                                   │◄──── Write summary.json ───────│
    │                                   │      (ContentSummary)          │
    │                                   │                                │
    │◄──── AgentOutputTool result ──────│                                │
    │      "Analysis complete"          │                                │
    │                                   │                                │
    │ ──── Update session.json ────────►│                                │
    │      steps.summary = "done"       │                                │
    │                                   │                                │
    │ ──── Task("idea-generator") ─────►│                                │
    │                                   │                                │
    │                                   │◄──── Read summary.json ────────│
    │                                   │◄──── Read user-profile.json ───│
    │                                   │                                │
    │                                   │◄──── Write ideas.json ─────────│
    │                                   │      (WritingIdeas)            │
    │                                   │                                │
    │◄──── AgentOutputTool result ──────│                                │
    │                                   │                                │
    │ ──── Update session.json ────────►│                                │
    │      steps.ideas = "done"         │                                │
    │                                   │                                │
    │ ──── Task("writing-kit-builder") ►│                                │
    │                                   │                                │
    │                                   │◄──── Read summary.json ────────│
    │                                   │◄──── Read ideas.json ──────────│
    │                                   │                                │
    │                                   │◄──── Write writing-kit.json ───│
    │                                   │      (WritingKit)              │
    │                                   │                                │
    │◄──── AgentOutputTool result ──────│                                │
    │                                   │                                │
    │ ──── Update session.json ────────►│                                │
    │      steps["writing-kit"] = "done"│                                │
    │                                   │                                │
    │ ──── Read writing-kit.json ──────►│                                │
    │◄──── WritingKit JSON ─────────────│                                │
    │                                   │                                │
    │ ──── StructuredOutput ───────────►│                                │
    │      CommandResult<WritingKit>    │                                │
    │                                   │                                │
```

### Communication Principles

| Principle | Description |
|-----------|-------------|
| **No In-Memory Handoff** | All data passes through files |
| **Workspace is Truth** | Files represent authoritative state |
| **Manifest Tracks Progress** | session.json records completed steps |
| **JSON for Structure** | Typed data in `.json` files with schemas |
| **Flat Organization** | All Session files at same level |

### File I/O Sequence

| Step | Agent | Reads | Writes |
|------|-------|-------|--------|
| 1 | Main Agent | CLAUDE.md, pipelines/*.yaml | - |
| 2 | Main Agent | session.json | - |
| 3 | content-analyzer | content.md | summary.json |
| 3a | Main Agent | - | session.json (steps.summary = "done") |
| 4 | idea-generator | summary.json, user-profile.json | ideas.json |
| 4a | Main Agent | - | session.json (steps.ideas = "done") |
| 5 | writing-kit-builder | summary.json, ideas.json | outline.json, writing-kit.json |
| 5a | Main Agent | - | session.json (steps["writing-kit"] = "done") |
| 6 | Main Agent | writing-kit.json | - (StructuredOutput) |

---

## 8. Smart Continuation: Manifest-Based State Tracking

### The Pattern (v0.5.0)

**Smart Continuation** uses a **SessionManifest** (`session.json`) to track step completion. The agent reads the manifest to determine what work remains, rather than relying solely on file existence.

### Session Manifest Structure

```json
{
  "version": 1,
  "contentId": "article-2025-12-12-abc123",
  "pipeline": "writing-kit",
  "desiredOutput": "writing-kit",
  "updatedAt": "2025-12-12T10:30:00Z",
  "steps": {
    "summary": "done",
    "ideas": "done"
  }
}
```

### Manifest Properties

| Property | Description |
|----------|-------------|
| `version` | Schema version (always 1) |
| `contentId` | Session identifier |
| `pipeline` | Which pipeline definition to use |
| `desiredOutput` | Target artifact name |
| `updatedAt` | ISO timestamp of last update |
| `steps` | Map of step name → "done" status |

### Decision Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SMART CONTINUATION DECISION PROCESS                       │
└─────────────────────────────────────────────────────────────────────────────┘

Prompt: "Build WritingKit for session: contentItem/{Session-ID}"

┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: Read Session Manifest                                               │
│                                                                             │
│   Agent Action: Read contentItem/{Session-ID}/session.json                  │
│   Result: { steps: { summary: "done", ideas: "done" } }                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 2: Check Artifact Existence                                            │
│                                                                             │
│   For each step marked "done" in manifest:                                  │
│   ├─ Verify artifact file exists (summary.json, ideas.json)                 │
│   └─ Step is truly complete only if BOTH conditions met                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3: Decision Tree                                                       │
│                                                                             │
│   Manifest State          │  Agent Decision                                 │
│   ────────────────────────┼────────────────────────────────────────────────│
│   steps: {}               │  Run all Subagents from pipeline                │
│   ────────────────────────┼────────────────────────────────────────────────│
│   steps: {summary:"done"} │  Skip content-analyzer                          │
│   + summary.json exists   │  Run idea-generator, writing-kit-builder        │
│   ────────────────────────┼────────────────────────────────────────────────│
│   steps: {summary:"done", │  Skip content-analyzer, idea-generator          │
│           ideas:"done"}   │  Run writing-kit-builder only                   │
│   + both files exist      │                                                 │
│   ────────────────────────┼────────────────────────────────────────────────│
│   steps: {all "done"}     │  Skip all Subagents                             │
│   + all files exist       │  Read and return writing-kit.json directly      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 4: Execute and Update                                                  │
│                                                                             │
│   After each Subagent completes:                                            │
│   ├─ Verify artifact was written                                            │
│   ├─ Update session.json: steps[name] = "done"                              │
│   └─ Proceed to next step in pipeline                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fresh Session vs Resume

**Fresh Session (`--file`):**

```
looplia run --file article.md

CLI:
├─ Creates new Session with unique Session-ID
├─ Writes content.md from file
├─ Creates session.json with empty steps: {}
└─ Sends prompt to agent

Agent:
├─ Read session.json: { steps: {} }
├─ No steps completed
└─ Runs full workflow: content-analyzer → idea-generator → writing-kit-builder
   (updating session.json after each step)
```

**Resume Session (`--session-id`):**

```
looplia run --session-id article-2025-12-12-abc123

CLI:
└─ Sends prompt with existing Session-ID

Agent:
├─ Read session.json: { steps: { summary: "done", ideas: "done", "writing-kit": "done" } }
├─ All steps marked done AND all files exist
└─ Reads writing-kit.json directly → Returns via StructuredOutput
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Resilience** | Interrupted work can be resumed |
| **Efficiency** | Completed steps are not repeated |
| **Cost Savings** | Avoids re-running expensive analysis |
| **Debuggability** | Manifest provides clear state audit trail |
| **Flexibility** | Agent adapts to current state |
| **Integrity** | Dual check (manifest + file) prevents stale state |

### Agent Reasoning Example

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Agent's Internal Reasoning                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ "I've been asked to build a WritingKit for session contentItem/abc123.      │
│  Let me read the pipeline definition and session manifest..."               │
│                                                                             │
│ [Read pipelines/writing-kit.yaml]                                           │
│ → Pipeline has 3 outputs: summary, ideas, writing-kit                       │
│ → Dependencies: ideas requires summary, writing-kit requires ideas          │
│                                                                             │
│ [Read contentItem/abc123/session.json]                                      │
│ → Result: { steps: { summary: "done" }, ... }                               │
│                                                                             │
│ [Glob contentItem/abc123/*.json]                                            │
│ → Result: ["session.json", "summary.json"]                                  │
│                                                                             │
│ "I see summary is marked done AND summary.json exists. This means:          │
│  - content-analyzer has completed (skip)                                    │
│  - idea-generator needs to run (ideas not in steps)                         │
│  - writing-kit-builder needs to run (writing-kit not in steps)              │
│                                                                             │
│  I'll invoke idea-generator first, update the manifest, then                │
│  writing-kit-builder."                                                      │
│                                                                             │
│ [Task: idea-generator]                                                      │
│ → ideas.json created                                                        │
│                                                                             │
│ [Update session.json: steps.ideas = "done"]                                 │
│                                                                             │
│ [Task: writing-kit-builder]                                                 │
│ → writing-kit.json created                                                  │
│                                                                             │
│ [Update session.json: steps["writing-kit"] = "done"]                        │
│                                                                             │
│ "All steps complete. Let me read the final result and return it."           │
│                                                                             │
│ [Read contentItem/abc123/writing-kit.json]                                  │
│ [StructuredOutput: WritingKit]                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-References

- **Ubiquitous Language**: See [GLOSSARY.md](./GLOSSARY.md) for term definitions
- **Version History**: See [CHANGELOG.md](../CHANGELOG.md) for release notes
- **Test Plan**: See [TEST_PLAN-0.3.md](./TEST_PLAN-0.3.md) for testing architecture
- **Original Concept**: See [AGENTIC_CONCEPT-0.1.md](./AGENTIC_CONCEPT-0.1.md) for problem/solution background

---

## Reference: Anthropic Official Documentation

This section references the official Anthropic documentation that serves as the foundation for Looplia-Core's agent system design. See [AGENT-SKILLS.md](./AGENT-SKILLS.md) for the complete reference.

### Core Concepts from Anthropic SDK

**Why Skills Matter**

> Skills are reusable, filesystem-based resources that provide Claude with domain-specific expertise: workflows, context, and best practices that transform general-purpose agents into specialists.

**Progressive Disclosure Architecture**

Skills leverage a three-level loading system that optimizes context usage:

| Level | When Loaded | Token Cost | Content |
|-------|-------------|------------|---------|
| **Level 1: Metadata** | Always (at startup) | ~100 tokens per Skill | `name` and `description` from YAML frontmatter |
| **Level 2: Instructions** | When Skill is triggered | Under 5k tokens | SKILL.md body with instructions and guidance |
| **Level 3+: Resources** | As needed | Effectively unlimited | Bundled files executed via bash without loading into context |

**Filesystem-Based Architecture**

> Claude operates in a virtual machine with filesystem access, allowing Skills to exist as directories containing instructions, executable code, and reference materials, organized like an onboarding guide you'd create for a new team member.

**SDK Configuration for Skills**

To enable Skills in the Claude Agent SDK:

1. Include `"Skill"` in `allowedTools` configuration
2. Configure `settingSources: ["user", "project"]` to load Skills from filesystem
3. Skills are automatically discovered from:
   - Project: `.claude/skills/*/SKILL.md`
   - User: `~/.claude/skills/*/SKILL.md`

**Skill vs Subagent (from Anthropic SDK)**

| Aspect | Skill | Subagent |
|--------|-------|----------|
| Definition | Filesystem artifact (`SKILL.md`) | Can be programmatic or filesystem |
| Invocation | Model-invoked (autonomous) | Explicit via Task tool |
| Session | Inline (same session) | Separate session |
| Tool Access | None (instructions only) | Configurable toolset |

### Applying to Looplia-Core

Looplia-Core implements these Anthropic patterns:

1. **Workspace as VM**: `~/.looplia/` serves as the agent's virtual machine with full filesystem access
2. **Skills in `.claude/skills/`**: Deployed via `init` command to workspace (SDK convention)
3. **settingSources**: Provider configures `["project"]` to enable Skill discovery
4. **Progressive Disclosure**: Skills loaded only when needed, minimizing context usage
5. **File-Based Communication**: Agents communicate through Workspace files, not memory
6. **Pipeline-as-Configuration**: Workflows defined in YAML, executed by agent

### Official Documentation Links

The complete Anthropic documentation is preserved in [AGENT-SKILLS.md](./AGENT-SKILLS.md), covering:

- Agent Skills Overview and Architecture
- Three-Level Progressive Loading
- Skill Structure and YAML Frontmatter
- SDK Integration (TypeScript and Python)
- Skill Locations and Discovery
- Tool Restrictions and Security Considerations
- Troubleshooting Guide

---

*This document describes the core agent system design for Looplia-Core v0.5.0.*
