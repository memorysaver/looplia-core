# Looplia-Core: Agent System Design

> Claude Agent SDK-Based Agentic Architecture with Two-Plugin Model
>
> **Version:** 0.5
> **Date:** 2025-12-18
> **Related:** [GLOSSARY.md](./GLOSSARY.md) | [DESIGN-0.5.2.md](./DESIGN-0.5.2.md) | [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md)

This document describes the core agent system design of Looplia-Core v0.5.2, focusing on the two-plugin architecture, slash commands, workflow-executor skill, and Claude Code plugin alignment.

---

## Table of Contents

1. [Introduction: Two-Plugin Architecture](#1-introduction-two-plugin-architecture)
2. [Plugin System Alignment](#2-plugin-system-alignment)
3. [Workspace: The Agent's Runtime Environment](#3-workspace-the-agents-runtime-environment)
4. [Slash Commands as Entry Points](#4-slash-commands-as-entry-points)
5. [The workflow-executor Skill](#5-the-workflow-executor-skill)
6. [Custom Subagents](#6-custom-subagents)
7. [Skills Auto-Loading](#7-skills-auto-loading)
8. [Validation-Driven Completion](#8-validation-driven-completion)
9. [The Execution Cycle](#9-the-execution-cycle)
10. [Smart Continuation](#10-smart-continuation)

---

## 1. Introduction: Two-Plugin Architecture

### The v0.5.2 Paradigm

Looplia-Core v0.5.2 separates the system into **two plugins** following Claude Code's plugin model:

| Plugin | Type | Purpose |
|--------|------|---------|
| **looplia-core** | Infrastructure | Workflow engine, validation, slash commands |
| **looplia-writer** | Domain | Writing-kit workflow, content analysis agents |

### Why Two Plugins?

**Separation of Concerns**

The workflow engine (HOW to run workflows) is distinct from domain logic (WHAT workflows do). This enables:

- Core infrastructure reusable across domains
- Domain plugins installable independently
- Clear boundaries between concerns

**Extensibility**

Future domain plugins can leverage the core:

```
looplia-core (infrastructure)
    ├── looplia-writer (writing domain)
    ├── looplia-research (research domain) - future
    ├── looplia-code (code review domain) - future
    └── ...
```

### Core Principles

**Plugin-Based Architecture**

All Looplia functionality is delivered through Claude Code plugins:
- Infrastructure via `looplia-core`
- Domains via `looplia-writer`, etc.
- Standard plugin structure (commands, agents, skills, hooks)

**Commands as Entry Points**

Users interact via slash commands, not direct CLI calls:
- `/run writing-kit --file article.md`
- `/list-workflows`
- `/build-workflow my-workflow`

**Workflows as Looplia Extension**

The `workflows/` directory extends the Claude Code plugin model:
- Not part of standard Claude Code plugin spec
- Processed by `workflow-executor` skill
- Enables declarative workflow definitions

**Validation-Driven Completion**

A workflow step is complete when its output PASSES VALIDATION, not when it's simply written. This provides deterministic quality assurance via the `workflow-validator` skill.

---

## 2. Plugin System Alignment

### Claude Code Plugin Structure

Standard Claude Code plugins have:

```
plugin/
├── .claude-plugin/
│   └── plugin.json       # Plugin manifest
├── commands/             # Slash commands
│   └── *.md
├── agents/               # Subagent definitions
│   └── *.md
├── skills/               # Agent skills
│   └── */SKILL.md
└── hooks/                # Event handlers
    └── hooks.json
```

### Looplia Extension

Looplia adds `workflows/` as an extension:

```
plugin/
├── ...standard Claude Code structure...
└── workflows/            # Looplia extension
    └── *.md              # Workflow-as-Markdown files
```

### looplia-core Plugin

```
plugins/looplia-core/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── run.md            # /run <workflow-id> --file <path>
│   ├── build-workflow.md # /build-workflow <name>
│   └── list-workflows.md # /list-workflows
├── skills/
│   ├── workflow-executor/
│   │   └── SKILL.md      # Workflow interpretation
│   └── workflow-validator/
│       ├── SKILL.md      # Output validation
│       └── scripts/validate.ts
├── hooks/
│   └── hooks.json        # Lifecycle logging
└── CLAUDE.md             # Generic workflow interpreter
```

### looplia-writer Plugin

```
plugins/looplia-writer/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── content-analyzer.md
│   ├── idea-generator.md
│   └── writing-kit-builder.md
├── skills/
│   ├── media-reviewer/SKILL.md
│   ├── content-documenter/SKILL.md
│   ├── id-generator/SKILL.md
│   ├── user-profile-reader/SKILL.md
│   └── writing-enhancer/SKILL.md
├── workflows/
│   └── writing-kit.md    # Writing workflow definition
└── README.md
```

### Dependency Model

```
looplia-writer (domain)
        │
        │ depends on
        ▼
looplia-core (infrastructure)
        │
        │ uses
        ▼
Claude Code Plugin System
```

---

## 3. Workspace: The Agent's Runtime Environment

### Structure Overview

After `looplia init`, the workspace contains files from both plugins:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKSPACE STRUCTURE (v0.5.2)                              │
│                    ~/.looplia/                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ~/.looplia/                          ← Agent's cwd (current working dir)   │
│  │                                                                          │
│  ├── CLAUDE.md                        ← From looplia-core                   │
│  │                                      Generic Workflow Interpreter        │
│  │                                                                          │
│  ├── user-profile.json                ← UserProfile                         │
│  │                                      Personalization: topics, style      │
│  │                                                                          │
│  ├── commands/                        ← From looplia-core                   │
│  │   ├── run.md                         /run slash command                  │
│  │   ├── build-workflow.md              /build-workflow slash command       │
│  │   └── list-workflows.md              /list-workflows slash command       │
│  │                                                                          │
│  ├── workflows/                       ← From looplia-writer                 │
│  │   └── writing-kit.md                 Workflow-as-Markdown definition     │
│  │                                                                          │
│  ├── hooks/                           ← From looplia-core                   │
│  │   └── hooks.json                     Lifecycle event handlers            │
│  │                                                                          │
│  ├── contentItem/                     ← Session Storage                     │
│  │   └── {Session-ID}/                  One folder per Session              │
│  │       ├── content.md                 ContentItem (input)                 │
│  │       ├── validation.json            Validation state                    │
│  │       ├── summary.json               Stage 1 output                      │
│  │       ├── ideas.json                 Stage 2 output                      │
│  │       └── writing-kit.json           Stage 3 output (final)              │
│  │                                                                          │
│  └── .claude/                         ← SDK Convention Directory            │
│      ├── agents/                        From looplia-writer                 │
│      │   ├── content-analyzer.md                                            │
│      │   ├── idea-generator.md                                              │
│      │   └── writing-kit-builder.md                                         │
│      │                                                                      │
│      └── skills/                        From both plugins                   │
│          ├── workflow-executor/         looplia-core                        │
│          ├── workflow-validator/        looplia-core                        │
│          ├── media-reviewer/            looplia-writer                      │
│          ├── content-documenter/        looplia-writer                      │
│          ├── user-profile-reader/       looplia-writer                      │
│          └── writing-enhancer/          looplia-writer                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### File Ownership

| Location | Source Plugin | Purpose |
|----------|---------------|---------|
| `CLAUDE.md` | looplia-core | Generic workflow interpreter |
| `commands/` | looplia-core | Slash commands |
| `hooks/` | looplia-core | Lifecycle event handlers |
| `.claude/skills/workflow-*` | looplia-core | Execution/validation skills |
| `workflows/` | looplia-writer | Workflow definitions |
| `.claude/agents/` | looplia-writer | Domain-specific agents |
| `.claude/skills/{domain}` | looplia-writer | Domain-specific skills |

### Design Principles

**Flat Session Structure**

All Session files reside at the same level within `contentItem/{Session-ID}/`. No nested subfolders.

**JSON for Typed Data**

Intermediate outputs use JSON format with schemas defined in the core package.

**Commands at Root**

Slash commands are in `commands/` at workspace root (not in `.claude/`) following Claude Code convention.

---

## 4. Slash Commands as Entry Points

### Overview

v0.5.2 introduces **slash commands** as the primary way to interact with workflows. Commands are defined in `commands/*.md` and invoked via `/command-name`.

### Command Structure

```markdown
---
description: Short description shown in /help
---

# Command Title

## Usage
/command-name <arg1> [--flag value]

## Description
What this command does...

## Implementation
How the agent should execute this command...
```

### Available Commands

| Command | Description |
|---------|-------------|
| `/run <workflow-id> --file <path>` | Execute a workflow on content |
| `/build-workflow <name>` | Scaffold a new workflow.md file |
| `/list-workflows` | List available workflows |

### /run Command

The primary entry point for workflow execution:

```markdown
---
description: Run a Looplia workflow on content
---

# Run Workflow

Execute a workflow from `workflows/` on provided content.

## Usage
/run <workflow-id> --file <path>
/run <workflow-id> --session-id <id>

## Execution
1. Validate workflow exists in workflows/
2. Initialize session (new or resume)
3. Use workflow-executor skill
4. Validate outputs with workflow-validator
5. Return final artifact
```

### Unified Execution Model: CLI Wraps /run

The CLI `looplia run` is a **thin wrapper** that injects the `/run` command:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED EXECUTION MODEL                                  │
└─────────────────────────────────────────────────────────────────────────────┘

User: looplia run writing-kit --file article.md
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLI Layer (Thin Wrapper ~50 lines)                                           │
│                                                                             │
│ 1. Parse args → workflow-id, file path, options                             │
│ 2. Ensure workspace initialized                                             │
│ 3. Build prompt: "/run writing-kit --file /path/to/article.md"              │
│ 4. Invoke Claude Agent SDK with the prompt                                  │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Agent receives: "/run writing-kit --file /path/to/article.md"               │
│                                                                             │
│ Same as if user typed /run directly in Claude Code                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight**: Both entry points converge to the same `/run` command execution:

| Entry Point | Flow |
|-------------|------|
| Slash Command | `/run` → Agent → workflow-executor skill |
| CLI | CLI injects `/run` → Agent → workflow-executor skill |

**Single Execution Path**: All workflow logic resides in the `workflow-executor` skill, not duplicated in CLI.

---

## 5. The workflow-executor Skill

### Overview

The **workflow-executor** skill is the core of looplia-core. It interprets workflow.md files and orchestrates execution.

### Skill Definition

```markdown
---
name: workflow-executor
description: |
  Execute workflow-as-markdown definitions. Parses YAML frontmatter,
  resolves output dependencies, invokes subagents, and tracks validation state.
---

# Workflow Executor Skill

Execute workflows defined in `workflows/*.md` files.

## Capabilities

1. **Parse Workflow Definition**
   - Read YAML frontmatter for outputs, agents, dependencies
   - Extract markdown body for custom instructions

2. **Resolve Dependencies**
   - Build execution order using topological sort
   - Respect `requires` fields in output definitions

3. **Execute Outputs**
   - Invoke subagents via Task tool for each output
   - Pass session context and previous artifacts

4. **Track State**
   - Read/update `contentItem/{id}/validation.json`
   - Mark outputs as validated after passing checks

5. **Resume Capability**
   - Skip outputs that are already validated
   - Continue from last incomplete output
```

### Execution Protocol

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW-EXECUTOR PROTOCOL                                │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Load Workflow
├─ Read workflows/{workflow-id}.md
├─ Parse YAML frontmatter → outputs, agents, validation criteria
└─ Parse markdown body → custom instructions

Step 2: Initialize State
├─ Read contentItem/{id}/validation.json
└─ Check which outputs have validated: true

Step 3: Execute Loop
For each output in dependency order:
  IF validated AND artifact exists:
    Skip (already complete)
  ELSE:
    ├─ Invoke subagent via Task tool
    ├─ Use workflow-validator skill to validate
    ├─ IF passed: Update validation.json
    └─ IF failed: Retry or report

Step 4: Return Final
├─ When output with final: true passes
├─ Read its artifact
└─ Return as result
```

### Dependency Resolution

The skill computes topological order from `requires` fields:

```
Input:
  summary: { requires: [] }
  ideas: { requires: [summary] }
  writing-kit: { requires: [summary, ideas], final: true }

Computed order: [summary, ideas, writing-kit]
```

---

## 6. Custom Subagents

### Overview

**Custom Subagents** are specialized agents defined in `.claude/agents/*.md` that handle specific workflow steps. The workflow-executor invokes them via the **Task tool** with a custom `subagent_type`.

### Subagent Definition

```yaml
---
name: content-analyzer
description: Deep content analysis using media-reviewer skill
model: haiku
tools: Read, Write, Skill
skills: media-reviewer, content-documenter
---

# Content Analyzer Agent

Analyze content to extract themes, quotes, and insights.

## Task

1. Read content from `contentItem/{id}/content.md`
2. Use **media-reviewer** skill for analysis
3. Use **content-documenter** skill for structured output
4. Write output to: `contentItem/{id}/summary.json`
```

### Frontmatter Fields

| Field | Description |
|-------|-------------|
| `name` | Unique identifier (matches `subagent_type` in Task tool) |
| `description` | What this agent does |
| `model` | LLM model to use (e.g., haiku, sonnet) |
| `tools` | Tools available to this agent |
| `skills` | **Auto-loaded skills** (comma-separated list) |

### Task Tool Invocation

```json
{
  "name": "Task",
  "input": {
    "subagent_type": "content-analyzer",
    "description": "Generate summary artifact",
    "prompt": "Analyze content at contentItem/{id}/content.md"
  }
}
```

### Current Agents (looplia-writer)

| Agent | Purpose | Skills |
|-------|---------|--------|
| content-analyzer | Deep content analysis | media-reviewer, content-documenter |
| idea-generator | Generate writing ideas | user-profile-reader |
| writing-kit-builder | Assemble final kit | user-profile-reader |

---

## 7. Skills Auto-Loading

### Overview

**Skills Auto-Loading** allows subagents to automatically load specified skills when they start. Configured via the `skills:` frontmatter field.

### Configuration

```yaml
---
name: content-analyzer
skills: media-reviewer, content-documenter  # ← Auto-loaded!
---
```

### Progressive Disclosure

Skills follow Anthropic's three-level progressive disclosure:

| Level | When Loaded | Token Cost | Content |
|-------|-------------|------------|---------|
| **Level 1** | At startup | ~100 tokens | `name` and `description` from YAML |
| **Level 2** | When triggered | < 5k tokens | SKILL.md body with instructions |
| **Level 3** | As needed | 0 tokens | Scripts run outside LLM context |

### Skill Types in v0.5.2

| Skill | Source | Purpose |
|-------|--------|---------|
| workflow-executor | looplia-core | Interpret workflow.md files |
| workflow-validator | looplia-core | Validate output artifacts |
| media-reviewer | looplia-writer | Analyze media content |
| content-documenter | looplia-writer | Generate structured outputs |
| user-profile-reader | looplia-writer | Load user preferences |
| writing-enhancer | looplia-writer | Enhance content quality |

### Skill vs Subagent

| Aspect | Skill | Subagent |
|--------|-------|----------|
| **Invoked by** | Any agent (auto or manual) | Main Agent via Task tool |
| **Session** | Inline (same session) | Separate session |
| **Definition** | `.claude/skills/*/SKILL.md` | `.claude/agents/*.md` |
| **Scope** | Single focused task | Multi-step workflow |

---

## 8. Validation-Driven Completion

### Overview

**Validation-Driven Completion** means a workflow step is complete when its output PASSES VALIDATION, not when it's simply written to disk.

### validation.json Structure

```json
{
  "workflow": "writing-kit",
  "outputs": {
    "summary": {
      "artifact": "summary.json",
      "criteria": {
        "required_fields": ["contentId", "headline", ...],
        "min_quotes": 3,
        "min_key_points": 5
      },
      "validated": false
    },
    "ideas": { ... },
    "writing-kit": { ... }
  }
}
```

### workflow-validator Skill

Located in looplia-core, this skill validates artifacts using a deterministic script:

```
.claude/skills/workflow-validator/
├── SKILL.md                    # Instructions
└── scripts/
    └── validate.ts             # Deterministic validation
```

### Validation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VALIDATION FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

[1] Subagent writes artifact (e.g., summary.json)
                        │
                        ▼
[2] Workflow-executor invokes workflow-validator skill
                        │
                        └─ Agent reads SKILL.md instructions
                        │
                        ▼
[3] Agent runs validation script via Bash
                        │
                        │  bun scripts/validate.ts summary.json '{criteria}'
                        │
                        ▼
[4] Script returns JSON result (0 tokens consumed)
                        │
                        │  { "passed": true, "checks": [...] }
                        │
                        ▼
[5] Workflow-executor processes result
                        │
                        ├─ If passed: Update validation.json, continue
                        │
                        └─ If failed: Retry subagent or report
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Deterministic** | Script-based validation, no LLM variability |
| **Token-Efficient** | Validation runs outside LLM context (0 tokens) |
| **Detailed Feedback** | Specific check results guide retries |
| **Auditable** | validation.json provides clear state trail |

---

## 9. The Execution Cycle

### Overview

The v0.5.2 execution cycle has a **unified entry point** where both CLI and slash commands converge to the same `/run` command execution:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   THE AGENTIC EXECUTION CYCLE (v0.5.2)                       │
│                         UNIFIED EXECUTION MODEL                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ [1] ENTRY POINT - Unified via /run command                                   │
│                                                                             │
│     ┌─────────────────────────────────┐  ┌─────────────────────────────────┐│
│     │ Entry A: Slash Command          │  │ Entry B: CLI (Thin Wrapper)     ││
│     │                                 │  │                                 ││
│     │ /run writing-kit --file a.md    │  │ looplia run writing-kit         ││
│     │           │                     │  │ --file article.md               ││
│     │           │                     │  │           │                     ││
│     │           │                     │  │           ▼                     ││
│     │           │                     │  │ Build: "/run writing-kit        ││
│     │           │                     │  │         --file /abs/path/a.md"  ││
│     │           │                     │  │           │                     ││
│     └───────────┼─────────────────────┘  └───────────┼─────────────────────┘│
│                 │                                    │                      │
│                 └──────────────┬─────────────────────┘                      │
│                                │                                            │
│                                ▼                                            │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ Agent receives: "/run writing-kit --file /path/to/article.md"       │ │
│     │ ► Reads commands/run.md                                             │ │
│     │ ► Executes using workflow-executor skill                            │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [2] MAIN AGENT                                                               │
│                                                                             │
│     Reads CLAUDE.md (generic interpreter)                                   │
│     Uses workflow-executor skill:                                           │
│     ├─ Parse workflows/writing-kit.md                                       │
│     ├─ Read/create validation.json                                          │
│     └─ Execute outputs in dependency order                                  │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  Task tool invocations
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [3] SUBAGENT LAYER                                                           │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ Stage 1: content-analyzer                                           │ │
│     │ ├─ Auto-loaded skills: media-reviewer, content-documenter           │ │
│     │ └─ Writes: contentItem/{id}/summary.json                            │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                              ↓ validate with workflow-validator              │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ Stage 2: idea-generator                                             │ │
│     │ ├─ Auto-loaded skills: user-profile-reader                          │ │
│     │ └─ Writes: contentItem/{id}/ideas.json                              │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                              ↓ validate with workflow-validator              │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │ Stage 3: writing-kit-builder                                        │ │
│     │ ├─ Auto-loaded skills: user-profile-reader                          │ │
│     │ └─ Writes: writing-kit.json (final)                                 │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                              ↓ validate with workflow-validator              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │  All outputs validated
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [4] RETURN                                                                   │
│                                                                             │
│     ├─ All outputs.*.validated = true                                       │
│     ├─ Read contentItem/{id}/writing-kit.json                               │
│     └─ Return as structured output                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **CLI** (Thin Wrapper) | Parse args, build `/run` prompt, invoke SDK |
| **Slash Command** (`/run`) | Entry point for workflow execution |
| **Main Agent** | Read commands/run.md, use workflow-executor skill |
| **workflow-executor** | ALL workflow logic: parse workflow.md, session creation, validation.json, dependency resolution, subagent orchestration |
| **Subagent** | Perform specialized task with auto-loaded skills |
| **workflow-validator** | Validate artifacts deterministically |

### Why Unified Execution?

| Benefit | Description |
|---------|-------------|
| **Single Execution Path** | All workflow logic in workflow-executor skill |
| **Thin CLI** | ~50 lines instead of ~500 lines |
| **No Duplication** | Session creation, validation logic in one place |
| **Same Behavior** | CLI and slash command produce identical results |
| **Easier Maintenance** | Fix bugs in one place, not two |

---

## 10. Smart Continuation

### The Pattern

**Smart Continuation** uses `validation.json` to track output completion. The workflow-executor skill reads validation state to determine what work remains.

### Decision Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SMART CONTINUATION DECISION PROCESS                       │
└─────────────────────────────────────────────────────────────────────────────┘

Validation State                │  Workflow-Executor Decision
────────────────────────────────┼────────────────────────────────────────────
All outputs validated: false    │  Run all subagents from workflow
────────────────────────────────┼────────────────────────────────────────────
summary.validated: true         │  Skip content-analyzer
+ summary.json exists           │  Run idea-generator, writing-kit-builder
────────────────────────────────┼────────────────────────────────────────────
All outputs validated: true     │  Skip all subagents
+ all artifacts exist           │  Read and return writing-kit.json
```

### Fresh vs Resume

**Fresh Session:**
```
/run writing-kit --file article.md

├─ Creates new session
├─ Generates validation.json (all validated: false)
└─ Runs full workflow
```

**Resume Session:**
```
/run writing-kit --session-id article-2025-12-18-abc123

├─ Loads existing session
├─ Reads validation.json
└─ Continues from next pending output
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Resilience** | Interrupted work can be resumed |
| **Efficiency** | Validated outputs are not repeated |
| **Cost Savings** | Avoids re-running expensive analysis |
| **Debuggability** | validation.json provides clear state |

---

## Cross-References

- **Architecture Design**: See [DESIGN-0.5.2.md](./DESIGN-0.5.2.md) for implementation details
- **Claude Code Plugins**: See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) for plugin reference
- **Ubiquitous Language**: See [GLOSSARY.md](./GLOSSARY.md) for term definitions
- **Previous Version**: See [AGENTIC_CONCEPT-0.4.md](./AGENTIC_CONCEPT-0.4.md) for comparison

---

*This document describes the core agent system design for Looplia-Core v0.5.2.*
