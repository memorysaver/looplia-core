# Looplia-Core Documentation

> **Version:** 0.6.0
> **Last Updated:** December 2025

This directory contains the core documentation for Looplia-Core, a Claude Agent SDK-based agentic workflow platform.

---

## Core Documents (Latest)

These are the current, authoritative documents for the v0.6.0 architecture:

| Document | Purpose | Audience |
|----------|---------|----------|
| [DESIGN-0.6.0.md](./DESIGN-0.6.0.md) | **Steps-based workflow schema**, deterministic subagent invocation, GitHub Actions-inspired syntax | Developers, Architects |
| [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) | **Context injection flow** when running workflows (ASCII diagram) | Developers, Architects |
| [AGENTIC_CONCEPT-0.5.md](./AGENTIC_CONCEPT-0.5.md) | Agent system design: Two-plugin model, workflow-executor skill, commands | Architects, System Designers |
| [TEST_PLAN-0.5.md](./TEST_PLAN-0.5.md) | Test architecture with real API testing, log verification, bun link workflow | QA, Developers |
| [GLOSSARY.md](./GLOSSARY.md) | Ubiquitous language reference (domain terms + TypeScript types) | All team members |
| [PR_CHECKLIST.md](./PR_CHECKLIST.md) | **PR checklist** for docs, CI/CD alignment, version consistency | Contributors, Claude Code |
| [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) | Claude Code plugin system reference | Developers |
| [SUBAGENTS.md](./SUBAGENTS.md) | Anthropic official Subagents documentation (reference) | Developers |
| [AGENT-SKILLS.md](./AGENT-SKILLS.md) | Anthropic official Agent Skills documentation (reference) | Developers |

---

## What's New in v0.6.0

### Steps-Based Workflow Schema

v0.6.0 introduces a GitHub Actions-inspired workflow schema for **deterministic subagent invocation**:

| v0.5.x | v0.6.0 | Rationale |
|--------|--------|-----------|
| `outputs:` (object) | `steps:` (array) | Explicit ordering |
| `agent:` | `run:` | Action-oriented verb |
| `requires:` | `needs:` | GitHub Actions familiarity |
| Implicit paths | `${{ }}` syntax | Explicit variable substitution |

### Critical Subagent Mapping

When `run: agents/{name}` is specified, the Task tool MUST use `subagent_type: "{name}"`:

```
run: agents/content-analyzer  →  subagent_type: "content-analyzer"
run: agents/idea-generator    →  subagent_type: "idea-generator"
```

**FORBIDDEN:** `subagent_type: "general-purpose"` for workflow steps.

### Two-Plugin Architecture

v0.5.2+ separates the single plugin into **two plugins**:

| Plugin | Purpose | Contents |
|--------|---------|----------|
| **looplia-core** | Infrastructure | Workflow engine, validation, `/run` command |
| **looplia-writer** | Domain | Writing-kit workflow, content analysis agents |

### Sandbox Folder Architecture

Each workflow execution creates an isolated sandbox:

```
~/.looplia/sandbox/{sandbox-id}/
├── inputs/
│   └── content.md        # Input content (copied from --file)
├── outputs/
│   ├── summary.json      # Stage 1 output
│   ├── ideas.json        # Stage 2 output
│   └── writing-kit.json  # Stage 3 output (final)
├── logs/
│   └── query-*.log       # Session logs
└── validation.json       # Validation state tracking
```

**Sandbox ID format:** `{slug}-{YYYY-MM-DD}-{random4chars}` (e.g., `my-article-2025-12-18-xk7m`)

### Slash Commands

New commands exposed via Claude Code plugin system:

| Command | Description |
|---------|-------------|
| `/run <workflow-id> --file <path>` | Execute a workflow on content (creates sandbox) |
| `/run <workflow-id> --sandbox-id <id>` | Resume existing sandbox |
| `/build-workflow <name>` | Scaffold a new workflow definition |
| `/list-workflows` | List available workflows |

### Claude Code Plugin Alignment

- Proper plugin manifest (`.claude-plugin/plugin.json`)
- Commands in `commands/` directory
- Hooks for lifecycle logging and validation
- Workflows as a Looplia extension

---

## Document Overview

### DESIGN-0.5.2.md

The v0.5.2 architecture document covering:

- **Two-Plugin Architecture** - looplia-core (infrastructure) + looplia-writer (domain)
- **Slash Commands** - `/run`, `/build-workflow`, `/list-workflows`
- **workflow-executor Skill** - Core skill that interprets workflow.md files
- **Plugin Manifest Updates** - Proper plugin.json for both plugins
- **Installation Flow** - How `looplia init` installs both plugins
- **Workflow Files Solution** - How workflows fit as a Looplia extension

### AGENTIC_CONCEPT-0.5.md

The v0.5.2 agent system design document covering:

- **Plugin Separation** - Infrastructure vs domain concerns
- **Workflow-as-Markdown** - YAML frontmatter + markdown instructions in single file
- **Custom Subagents** - Task tool with custom `subagent_type`
- **Skills Auto-Loading** - `skills:` frontmatter field in agent definitions
- **Validation-Driven Completion** - `validation.json` with deterministic script validation

### DESIGN-0.5.1.md

The workflow-as-markdown architecture document covering:

- **Workflow.md Format** - YAML frontmatter structure with outputs, agents, validation criteria
- **Validation Skill System** - workflow-validator skill with deterministic scripts
- **Generic Workflow Interpreter** - CLAUDE.md that executes ANY workflow
- **CLI Command Updates** - `looplia run <workflow-id> --file <path>`

### GLOSSARY.md

Ubiquitous language reference organized into categories covering domain concepts, architecture layers, command framework, agent system, streaming events, and more.

### CLAUDE_PLUGINS.md

Reference document for Claude Code plugin system including plugin structure, commands, agents, skills, and hooks.

### SUBAGENTS.md

Reference document containing the official Anthropic documentation for Subagents.

### AGENT-SKILLS.md

Reference document containing the official Anthropic documentation for Agent Skills.

---

## Historical Documents

Previous versions are preserved for reference:

| Document | Version | Notes |
|----------|---------|-------|
| [DESIGN-0.5.2.md](./DESIGN-0.5.2.md) | v0.5.2 | Two-plugin architecture, slash commands |
| [DESIGN-0.5.1.md](./DESIGN-0.5.1.md) | v0.5.1 | Workflow-as-Markdown, single plugin |
| [AGENTIC_CONCEPT-0.4.md](./AGENTIC_CONCEPT-0.4.md) | v0.5.1 | Pre-two-plugin agent design |
| [AGENTIC_CONCEPT-0.3.md](./AGENTIC_CONCEPT-0.3.md) | v0.3 | Pipeline-as-Configuration (YAML), session.json |
| [TEST_PLAN-0.4.md](./TEST_PLAN-0.4.md) | v0.4 | Pre-real-API-testing plan |
| [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) | v0.4.0 | CommandDefinition abstraction, Clean Architecture |
| [AGENTIC_CONCEPT-0.2.md](./AGENTIC_CONCEPT-0.2.md) | v0.2 | Pre-pipeline agent design |

---

## Quick Links

### For New Contributors

1. Start with [GLOSSARY.md](./GLOSSARY.md) to understand the terminology
2. Read [DESIGN-0.5.2.md](./DESIGN-0.5.2.md) for the two-plugin architecture
3. Review [AGENTIC_CONCEPT-0.5.md](./AGENTIC_CONCEPT-0.5.md) for agent system design
4. **Before PRs:** Use [PR_CHECKLIST.md](./PR_CHECKLIST.md) to ensure docs and CI/CD are updated

### For Developers

- **Context injection flow?** See [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) for ASCII diagram of what gets loaded
- **Workflow schema v0.6.0?** See [DESIGN-0.6.0.md § Workflow Schema](./DESIGN-0.6.0.md#3-workflow-schema-v060)
- **Subagent invocation?** See [DESIGN-0.6.0.md § Subagent Invocation Protocol](./DESIGN-0.6.0.md#4-subagent-invocation-protocol)
- Adding a workflow? See [DESIGN-0.5.2.md § Plugin 2: looplia-writer](./DESIGN-0.5.2.md#5-plugin-2-looplia-writer)
- Creating commands? See [DESIGN-0.5.2.md § Command Specifications](./DESIGN-0.5.2.md#8-command-specifications)
- Running tests? See [TEST_PLAN-0.5.md](./TEST_PLAN-0.5.md)
- Plugin system? See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md)

### For Architects

- **v0.6.0 schema design**: [DESIGN-0.6.0.md](./DESIGN-0.6.0.md) for steps-based workflow format
- Two-plugin architecture: [DESIGN-0.5.2.md § Two-Plugin Architecture](./DESIGN-0.5.2.md#3-two-plugin-architecture)
- Workflow files solution: [DESIGN-0.5.2.md § Workflow Files Solution](./DESIGN-0.5.2.md#6-workflow-files-solution)
- Validation-driven completion: [AGENTIC_CONCEPT-0.5.md](./AGENTIC_CONCEPT-0.5.md)

---

## Document Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT RELATIONSHIPS (v0.6.0)                       │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │  GLOSSARY.md │
                              │  (Terms)     │
                              └──────┬───────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐        ┌─────────────────┐        ┌───────────────┐
│ AGENTIC_        │        │ DESIGN-0.6.0.md │        │TEST_PLAN-0.5 │
│ CONCEPT-0.5     │        │ (Schema v0.6.0) │        │  (Testing)   │
│ (Agent Design)  │        └────────┬────────┘        └──────────────┘
└────────┬────────┘                 │
         │                          │
         │            ┌─────────────┴─────────────┐
         │            │                           │
         │            ▼                           ▼
         │  ┌───────────────────┐    ┌─────────────────────────────────────┐
         │  │ CONTEXT-INJECTION │    │  CLAUDE_PLUGINS.md                  │
         │  │ (Execution Flow)  │    │  SUBAGENTS.md │ AGENT-SKILLS.md     │
         │  └───────────────────┘    │       (SDK Reference)               │
         │                           └─────────────────────────────────────┘
         │                                        ▲
         └────────────────────────────────────────┘
```

- **GLOSSARY.md** defines terms used across all documents
- **AGENTIC_CONCEPT-0.5.md** documents the two-plugin agent design
- **DESIGN-0.6.0.md** documents the steps-based workflow schema
- **CONTEXT-INJECTION.md** illustrates what content is injected during workflow execution
- **CLAUDE_PLUGINS.md** provides Claude Code plugin reference
- **SUBAGENTS.md** / **AGENT-SKILLS.md** provide Anthropic SDK reference
- **TEST_PLAN-0.5.md** covers testing strategy

---

## Key v0.6.0 Concepts

### Steps-Based Workflow Schema

```yaml
# v0.6.0 Workflow Format (GitHub Actions-inspired)
steps:
  - id: summary
    run: agents/content-analyzer          # Agent to execute
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    validate:
      required_fields: [contentId, headline]

  - id: ideas
    run: agents/idea-generator
    needs: [summary]                      # Dependencies
    input: ${{ steps.summary.output }}    # Variable substitution
    output: ${{ sandbox }}/outputs/ideas.json
```

### Critical Subagent Mapping

```
Workflow YAML                      Task Tool Call
─────────────────────────────────  ──────────────────────────────────────
run: agents/content-analyzer   →   subagent_type: "content-analyzer"
run: agents/idea-generator     →   subagent_type: "idea-generator"
run: agents/writing-kit-builder→   subagent_type: "writing-kit-builder"

FORBIDDEN: subagent_type: "general-purpose" for workflow steps
```

### Two-Plugin Model

```
┌─────────────────────────────────┐    ┌─────────────────────────────────────┐
│        LOOPLIA-CORE              │    │         LOOPLIA-WRITER               │
│     (Infrastructure Plugin)      │    │        (Domain Plugin)               │
├─────────────────────────────────┤    ├─────────────────────────────────────┤
│ commands/                        │    │ agents/                              │
│   ├── run.md                     │    │   ├── content-analyzer.md            │
│   ├── build-workflow.md          │    │   ├── idea-generator.md              │
│   └── list-workflows.md          │    │   └── writing-kit-builder.md         │
├─────────────────────────────────┤    ├─────────────────────────────────────┤
│ skills/                          │    │ skills/                              │
│   ├── workflow-executor/         │    │   ├── media-reviewer/                │
│   └── workflow-validator/        │    │   └── ...                            │
├─────────────────────────────────┤    ├─────────────────────────────────────┤
│ hooks/                           │    │ workflows/                           │
│   └── hooks.json                 │    │   └── writing-kit.md                 │
├─────────────────────────────────┤    └─────────────────────────────────────┘
│ CLAUDE.md                        │
│   (Generic interpreter)          │
└─────────────────────────────────┘
```

### Sandbox Architecture

Each workflow run creates an isolated sandbox folder:

```
sandbox/{sandbox-id}/
├── inputs/content.md      # Copied from --file
├── outputs/*.json         # Generated artifacts
├── logs/*.log             # Session logs
└── validation.json        # Tracks validated: true/false per output
```

Benefits:
- **Isolation**: Each run is self-contained
- **Resumable**: Use `--sandbox-id` to continue from last validated step
- **Auditable**: Full logs preserved for debugging

### Workflow-as-Markdown (v0.6.0 Format)

Workflows are defined in `workflows/*.md` with YAML frontmatter:

```yaml
---
name: writing-kit
version: 1.0.0
description: Transform content into structured writing kit

steps:
  - id: summary
    run: agents/content-analyzer
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    validate:
      required_fields: [contentId, headline, tldr]

  - id: ideas
    run: agents/idea-generator
    needs: [summary]
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json

  - id: writing-kit
    run: agents/writing-kit-builder
    needs: [summary, ideas]
    input:
      - ${{ steps.summary.output }}
      - ${{ steps.ideas.output }}
    output: ${{ sandbox }}/outputs/writing-kit.json
    final: true
---
```

### Slash Commands

Execute workflows via Claude Code commands:

```
/run writing-kit --file article.md           # Create new sandbox
/run writing-kit --sandbox-id text-2025-12-18-abc1  # Resume existing
/list-workflows
/build-workflow my-new-workflow
```

### Validation-Driven Completion

Steps complete when `validation.json` shows `validated: true`:

```json
{
  "workflow": "writing-kit",
  "version": "1.0.0",
  "sandboxId": "article-2025-12-18-xk7m",
  "steps": {
    "summary": { "output": "outputs/summary.json", "validated": true },
    "ideas": { "output": "outputs/ideas.json", "validated": true },
    "writing-kit": { "output": "outputs/writing-kit.json", "validated": false }
  }
}
```

---

*This README provides navigation for Looplia-Core v0.6.0 documentation.*
