# Looplia-Core Documentation

> **Version:** 0.6.4
> **Last Updated:** December 2025

This directory contains the core documentation for Looplia-Core, a Claude Agent SDK-based agentic workflow platform.

---

## Core Documents (Latest)

These are the current, authoritative documents for the v0.6.3 architecture:

| Document | Purpose | Audience |
|----------|---------|----------|
| [AGENTIC_CONCEPT_1.0.md](./AGENTIC_CONCEPT_1.0.md) | **Skills-first architecture overview** - comprehensive guide to v0.6.1/v0.6.2 | All team members |
| [DESIGN-0.6.3.md](./DESIGN-0.6.3.md) | **Input-less workflows**, web-capable skills, named inputs | Developers, Architects |
| [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) | **Schema-in-Skill architecture**, plugin-first domain types | Developers, Architects |
| [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) | **Skills-first architecture**, universal skill-executor, `/build` command | Developers, Architects |
| [DESIGN-0.6.0.md](./DESIGN-0.6.0.md) | Steps-based workflow schema, deterministic subagent invocation | Developers, Architects |
| [CLEANUP-0.6.1.md](./CLEANUP-0.6.1.md) | Legacy code removal plan for v0.6.1 | Developers |
| [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) | **Context injection flow** when running workflows (ASCII diagram) | Developers, Architects |
| [GLOSSARY.md](./GLOSSARY.md) | Ubiquitous language reference (domain terms + TypeScript types) | All team members |
| [HOOK_VALIDATOR.md](./HOOK_VALIDATOR.md) | Hook system implementation details | Developers |
| [PR_CHECKLIST.md](./PR_CHECKLIST.md) | **PR checklist** for docs, CI/CD alignment, version consistency | Contributors, Claude Code |
| [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) | Claude Code plugin system reference | Developers |
| [SUBAGENTS.md](./SUBAGENTS.md) | Anthropic official Subagents documentation (reference) | Developers |
| [AGENT-SKILLS.md](./AGENT-SKILLS.md) | Anthropic official Agent Skills documentation (reference) | Developers |
| [AGENT-SDK.md](./AGENT-SDK.md) | Claude Agent SDK TypeScript reference (message types, tools, hooks) | Developers |

### Archived Documents

| Document | Purpose |
|----------|---------|
| [AGENTIC_CONCEPT-0.5.md](./archive/AGENTIC_CONCEPT-0.5.md) | Agent system design: Two-plugin model (historical) |
| [TEST_PLAN-0.6.md](./archive/TEST_PLAN-0.6.md) | Test architecture with real API testing (historical) |

---

## What's New in v0.6.4

### Interactive Build Wizard

v0.6.4 introduces an **Interactive Build Wizard** for creating workflows through a multi-turn TUI:

| Feature | Description |
|---------|-------------|
| **Tab-based navigation** | One question per tab with completion indicators |
| **AI-generated questions** | Dynamic clarification based on description ambiguity |
| **Client-side preview** | Workflow preview updates instantly without API calls |
| **Streaming TUI** | Tree-based display during workflow generation |

**New Components:**
- `TextInput`, `SelectInput`, `MultiSelectInput` - Reusable input primitives
- `TabBar`, `SectionView`, `ReviewPanel` - Wizard navigation components
- `preview-builder.ts` - Client-side workflow generation from answers
- `skill-analyzer.ts` - AI analysis integration

**Debug Logging:**
- `LOOPLIA_DEBUG=1` enables unified agent logging
- JSONL logs at `~/.looplia/logs/{context}/`

See [DESIGN-0.6.4.md](./DESIGN-0.6.4.md) for full specification.

---

## What's New in v0.6.3

### Web-Capable Skills & Input-Less Workflows

v0.6.3 enables workflows that start without user-provided input files:

| Feature | Description |
|---------|-------------|
| **Input-less workflows** | Workflows with `search` skill can start without `--file` |
| **WebSearch/WebFetch** | Skills can now perform web searches and fetch URLs |
| **Named inputs** | `--input name=value` syntax for multi-input workflows |

**Example input-less workflow:**
```yaml
steps:
  - id: search
    skill: search
    mission: "Find top HN stories about AI"
    output: ${{ sandbox }}/outputs/search-results.json
    # No input field - search skill fetches from web
```

See [DESIGN-0.6.3.md](./DESIGN-0.6.3.md) for full details.

---

## What's New in v0.6.2 (BREAKING CHANGE)

### Schema-in-Skill Architecture

v0.6.2 removes workflow-specific domain types from `packages/core`. Skills define their own output schemas in SKILL.md files.

| Before (v0.6.1) | After (v0.6.2) |
|-----------------|----------------|
| TypeScript types in `packages/core` | JSON schemas in SKILL.md |
| `ContentSummary`, `WritingIdeas` types | Skills own their output schemas |
| Core knows about all workflows | Core is workflow-agnostic |

**Key Principle:** Skills Define Schemas, Not TypeScript.

See [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) for full details.

---

## What's New in v0.6.1 (BREAKING CHANGE)

### Skills-First Architecture

v0.6.1 introduces **skills as first-class citizens** with a universal skill-executor:

| v0.6.0 | v0.6.1 | Rationale |
|--------|--------|-----------|
| `run: agents/X` | `skill:` + `mission:` | Skills are primary units |
| Per-agent subagent_type | Universal `skill-executor` | Single orchestrator |
| Thin wrapper agents | Direct skill invocation | Eliminate indirection |

### Universal Skill-Executor

ALL workflow steps now use ONE pattern:

```
skill: media-reviewer
mission: "Analyze content for themes and structure"
```

The `skill-executor` subagent handles ALL workflow step execution.

### New `/build` Command

AI-assisted workflow creation using 3 builder skills:

```
/build my-workflow "Transform podcast transcripts into blog posts"
```

**Builder Skills:**
- `plugin-registry-scanner` - Discover available skills
- `skill-capability-matcher` - Match requirements to skills
- `workflow-schema-composer` - Generate valid workflow YAML

See [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) for full details.

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

> **Note:** v0.6.0's `run: agents/X` syntax is deprecated in v0.6.1. Use `skill:` + `mission:` instead.

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

### DESIGN-0.6.2.md (Current)

The v0.6.2 architecture document covering:

- **Schema-in-Skill Architecture** - Skills define JSON schemas in SKILL.md
- **Domain Types Cleanup** - Remove workflow-specific types from core
- **Plugin-First Design** - looplia-writer as standard Claude Code plugin

### DESIGN-0.6.1.md (Current)

The v0.6.1 architecture document covering:

- **Skills-First Architecture** - Skills as first-class citizens
- **Universal Skill-Executor** - ONE subagent for ALL workflow steps
- **`/build` Command** - AI-assisted workflow creation with 3 builder skills
- **Skill Decomposition** - plugin-registry-scanner, skill-capability-matcher, workflow-schema-composer
- **Agent to Skill Migration** - Removing thin wrapper agents

### DESIGN-0.6.0.md

The v0.6.0 architecture document covering:

- **Steps-based Workflow Schema** - GitHub Actions-inspired syntax
- **Deterministic Subagent Invocation** - `run: agents/X` → `subagent_type: "X"`
- **Variable Substitution** - `${{ }}` syntax for paths

> **Note:** v0.6.0's `run: agents/X` syntax is deprecated. See DESIGN-0.6.1.md for skills-first approach.

### GLOSSARY.md

Ubiquitous language reference organized into categories covering domain concepts, architecture layers, command framework, agent system, streaming events, and more.

### CLAUDE_PLUGINS.md

Reference document for Claude Code plugin system including plugin structure, commands, agents, skills, and hooks.

### SUBAGENTS.md

Reference document containing the official Anthropic documentation for Subagents.

### AGENT-SKILLS.md

Reference document containing the official Anthropic documentation for Agent Skills.

### AGENT-SDK.md

Reference document containing the Claude Agent SDK TypeScript reference, including:
- SDK message types (`SDKAssistantMessage`, `SDKUserMessage`, etc.)
- Tool definitions (Task, Skill, Read, Write, etc.)
- Hook events (`PreToolUse`, `PostToolUse`, `SubagentStart`, etc.)
- Streaming event structures with `parent_tool_use_id` for hierarchical tracking

---

## Historical Documents

Previous versions are preserved in `/docs/archive/` for reference:

| Document | Version | Notes |
|----------|---------|-------|
| [DESIGN-0.5.2.md](./DESIGN-0.5.2.md) | v0.5.2 | Two-plugin architecture, slash commands |
| [DESIGN-0.5.1.md](./DESIGN-0.5.1.md) | v0.5.1 | Workflow-as-Markdown, single plugin |
| [AGENTIC_CONCEPT-0.5.md](./archive/AGENTIC_CONCEPT-0.5.md) | v0.5.2 | Two-plugin agent design |
| [AGENTIC_CONCEPT-0.4.md](./archive/AGENTIC_CONCEPT-0.4.md) | v0.5.1 | Pre-two-plugin agent design |
| [TEST_PLAN-0.6.md](./archive/TEST_PLAN-0.6.md) | v0.6.0 | Steps-based validation schema |
| [TEST_PLAN-0.4.md](./archive/TEST_PLAN-0.4.md) | v0.4 | Pre-real-API-testing plan |
| [DESIGN-0.4.0.md](./archive/DESIGN-0.4.0.md) | v0.4.0 | CommandDefinition abstraction, Clean Architecture |

---

## Quick Links

### For New Contributors

1. Start with [GLOSSARY.md](./GLOSSARY.md) to understand the terminology
2. Read [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) for the skills-first architecture
3. Review [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) for schema-in-skill architecture
4. **Before PRs:** Use [PR_CHECKLIST.md](./PR_CHECKLIST.md) to ensure docs and CI/CD are updated

### For Developers

- **Context injection flow?** See [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) for ASCII diagram of what gets loaded
- **Skills-first architecture?** See [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) for `skill:` + `mission:` syntax
- **Universal skill-executor?** See [DESIGN-0.6.1.md § Universal Skill-Executor](./DESIGN-0.6.1.md#10-universal-skill-executor-architecture)
- **Building workflows?** See [DESIGN-0.6.1.md § CLI Command](./DESIGN-0.6.1.md#5-cli-command) for `/build` command
- **Legacy code cleanup?** See [CLEANUP-0.6.1.md](./CLEANUP-0.6.1.md)
- Plugin system? See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md)

### For Architects

- **v0.6.2 schema design**: [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) for schema-in-skill architecture
- **v0.6.1 skills-first**: [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) for universal skill-executor pattern
- Two-plugin architecture: [DESIGN-0.5.2.md § Two-Plugin Architecture](./DESIGN-0.5.2.md#3-two-plugin-architecture)
- Validation-driven completion: [archive/AGENTIC_CONCEPT-0.5.md](./archive/AGENTIC_CONCEPT-0.5.md)

---

## Document Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT RELATIONSHIPS (v0.6.4)                       │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │  GLOSSARY.md │
                              │  (Terms)     │
                              └──────┬───────┘
                                     │
    ┌────────────────────────────────┼────────────────────────────────┐
    │                                │                                │
    ▼                                ▼                                ▼
┌─────────────────┐    ┌────────────────────────────┐    ┌───────────────────┐
│ DESIGN-0.6.2.md │───▶│     DESIGN-0.6.1.md        │───▶│  DESIGN-0.6.0.md  │
│ (Schema-in-Skill│    │   (Skills-First)           │    │  (Steps-Based)    │
│  Architecture)  │    │   + CLEANUP-0.6.1.md       │    │                   │
└─────────────────┘    └────────────┬───────────────┘    └───────────────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     │              │              │
                     ▼              ▼              ▼
           ┌─────────────┐  ┌────────────┐  ┌─────────────────────────────┐
           │ CONTEXT-    │  │ HOOK_      │  │  CLAUDE_PLUGINS.md          │
           │ INJECTION   │  │ VALIDATOR  │  │  SUBAGENTS.md               │
           │ (Flow)      │  │ (Hooks)    │  │  AGENT-SKILLS.md            │
           └─────────────┘  └────────────┘  │  AGENT-SDK.md               │
                                            │       (SDK Reference)       │
                                            └─────────────────────────────┘
```

**Version Progression:**
- v0.6.0 → v0.6.1 → v0.6.2 → v0.6.3 → **v0.6.4** (current)

**Key Documents:**
- **GLOSSARY.md** defines terms used across all documents
- **DESIGN-0.6.2.md** documents schema-in-skill architecture (skills define JSON schemas)
- **DESIGN-0.6.1.md** documents skills-first architecture with universal skill-executor
- **CLEANUP-0.6.1.md** documents legacy code removal plan
- **CONTEXT-INJECTION.md** illustrates what content is injected during workflow execution
- **HOOK_VALIDATOR.md** documents hook-based validation system
- **CLAUDE_PLUGINS.md** provides Claude Code plugin reference
- **SUBAGENTS.md** / **AGENT-SKILLS.md** / **AGENT-SDK.md** provide Anthropic SDK reference

---

## Workflow Schema

Workflows are markdown files with YAML frontmatter defining multi-step skill orchestration:

```yaml
---
name: writing-kit
version: 1.1.0
description: Transform content into structured writing kit

steps:
  - id: summary
    skill: media-reviewer
    mission: |
      Deep analysis of content to extract key themes, concepts.
      Extract minimum 3 verbatim quotes, at least 5 key points.
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    validate:
      required_fields: [contentId, headline, keyThemes]
      min_quotes: 3

  - id: ideas
    skill: idea-synthesis
    mission: |
      Generate creative writing ideas, hooks, and angles.
    needs: [summary]
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json

  - id: writing-kit
    skill: writing-kit-assembler
    mission: |
      Assemble final writing kit combining summary and ideas.
    needs: [summary, ideas]
    input:
      - ${{ steps.summary.output }}
      - ${{ steps.ideas.output }}
    output: ${{ sandbox }}/outputs/writing-kit.json
    final: true
---

# Writing Kit Workflow

Documentation and usage instructions...
```

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique step identifier |
| `skill` | string | **Yes** | Skill to execute |
| `mission` | string | **Yes** | Natural language task description |
| `input` | string/array | Yes | Input file path(s) |
| `output` | string | Yes | Output file path |
| `needs` | array | No | Step dependencies |
| `model` | string | No | Model override (haiku/sonnet/opus) |
| `validate` | object | No | Validation criteria |
| `final` | boolean | No | Mark as final output |

---

## Project Structure

```
looplia-core/
├── apps/
│   ├── cli/              # CLI application
│   └── docs/             # Documentation (Astro Starlight)
├── packages/
│   ├── core/             # Domain models, command framework
│   └── provider/         # Claude Agent SDK integration
├── plugins/
│   ├── looplia-core/     # Infrastructure plugin
│   │   ├── CLAUDE.md
│   │   ├── commands/
│   │   ├── skills/
│   │   └── hooks/
│   └── looplia-writer/   # Domain plugin
│       ├── workflows/
│       ├── skills/
│       └── user-profile.json
├── examples/             # Sample content files
└── docs/                 # Architecture documentation
```

---

## Key v0.6.1/v0.6.2 Concepts

### Skills-First Workflow Schema (v0.6.1)

```yaml
# v0.6.1 Workflow Format (Skills as first-class citizens)
steps:
  - id: summary
    skill: media-reviewer                 # Skill to execute (NOT agents/X)
    mission: "Analyze content structure and themes"
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json

  - id: ideas
    skill: idea-synthesis
    mission: "Generate creative hooks and angles"
    needs: [summary]
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json
```

### Universal Skill-Executor (v0.6.1)

```
ALL workflow steps use ONE pattern:

Workflow YAML                      Task Tool Call
─────────────────────────────────  ──────────────────────────────────────
skill: media-reviewer          →   subagent_type: "skill-executor"
skill: idea-synthesis          →   subagent_type: "skill-executor"
skill: writing-kit-assembler   →   subagent_type: "skill-executor"

ONLY ONE subagent for ALL steps: skill-executor
```

### Two-Plugin Model (v0.6.1 - Skills-First)

```
┌─────────────────────────────────┐    ┌─────────────────────────────────────┐
│        LOOPLIA-CORE              │    │         LOOPLIA-WRITER               │
│     (Infrastructure Plugin)      │    │        (Domain Plugin)               │
├─────────────────────────────────┤    ├─────────────────────────────────────┤
│ commands/                        │    │ skills/                              │
│   ├── run.md                     │    │   ├── media-reviewer/                │
│   └── build.md                   │    │   ├── idea-synthesis/                │
├─────────────────────────────────┤    │   └── writing-kit-assembler/         │
│ skills/                          │    ├─────────────────────────────────────┤
│   ├── workflow-executor/         │    │ workflows/                           │
│   ├── workflow-validator/        │    │   └── writing-kit.md                 │
│   ├── plugin-registry-scanner/   │    └─────────────────────────────────────┘
│   ├── skill-capability-matcher/  │
│   └── workflow-schema-composer/  │
├─────────────────────────────────┤
│ CLAUDE.md                        │
│   (Generic interpreter)          │
└─────────────────────────────────┘

Note: agents/ directory removed in v0.6.1 - skills are first-class citizens
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

### Workflow-as-Markdown (v0.6.1 Format)

Workflows are defined in `workflows/*.md` with YAML frontmatter:

```yaml
---
name: writing-kit
version: 1.0.0
description: Transform content into structured writing kit

steps:
  - id: summary
    skill: media-reviewer                    # v0.6.1: skill: instead of run:
    mission: "Deep content analysis"         # v0.6.1: mission required
    input: ${{ sandbox }}/inputs/content.md
    output: ${{ sandbox }}/outputs/summary.json
    validate:
      required_fields: [contentId, headline, tldr]

  - id: ideas
    skill: idea-synthesis
    mission: "Generate hooks, angles, questions"
    needs: [summary]
    input: ${{ steps.summary.output }}
    output: ${{ sandbox }}/outputs/ideas.json

  - id: writing-kit
    skill: writing-kit-assembler
    mission: "Assemble final writing kit"
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
/build my-workflow "Description of workflow"  # v0.6.1: AI-assisted workflow creation
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

*This README provides navigation for Looplia-Core v0.6.4 documentation.*
