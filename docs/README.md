# Looplia-Core Documentation

> **Version:** 0.7.2
> **Last Updated:** January 2026

This directory contains the core documentation for Looplia-Core, a Claude Agent SDK-based agentic workflow platform.

---

## Core Documents (Latest)

These are the current, authoritative documents for the v0.7.2 architecture:

| Document | Purpose | Audience |
|----------|---------|----------|
| [DESIGN-0.7.2.md](./DESIGN-0.7.2.md) | **Output flag and LOOPLIA_OUTPUT_DIR**, workflow output management | Developers, Architects |
| [DESIGN-0.7.1.md](./DESIGN-0.7.1.md) | **Build sandbox support**, ZenMux skill compatibility | Developers, Architects |
| [DESIGN-0.7.0.md](./DESIGN-0.7.0.md) | **Skill Registry System**, marketplace integration, selective loading | Developers, Architects |
| [AGENTIC_CONCEPT_1.0.md](./AGENTIC_CONCEPT_1.0.md) | **Skills-first architecture overview** - comprehensive guide to v0.6.1/v0.6.2 | All team members |
| [DESIGN-0.6.10.md](./DESIGN-0.6.10.md) | **Unified command initialization**, E2E testing | Developers, Architects |
| [DESIGN-0.6.9.md](./DESIGN-0.6.9.md) | **SDK Compatibility & API Key Selection**, endpoint-aware keys | Developers, Architects |
| [DESIGN-0.6.6.md](./DESIGN-0.6.6.md) | **Model Provider Configuration**, ZenMux support, dual-strategy execution | Developers, Architects |
| [DESIGN-0.6.5.md](./DESIGN-0.6.5.md) | **Agent SDK plugin loading**, bootstrap module, dev mode | Developers, Architects |
| [DESIGN-0.6.3.md](./DESIGN-0.6.3.md) | **Input-less workflows**, web-capable skills, named inputs | Developers, Architects |
| [DESIGN-0.6.2.md](./DESIGN-0.6.2.md) | **Schema-in-Skill architecture**, plugin-first domain types | Developers, Architects |
| [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) | **Skills-first architecture**, universal skill-executor, `/build` command | Developers, Architects |
| [DESIGN-0.6.0.md](./DESIGN-0.6.0.md) | Steps-based workflow schema, deterministic subagent invocation | Developers, Architects |
| [GLOSSARY.md](./GLOSSARY.md) | Ubiquitous language reference (domain terms + TypeScript types) | All team members |
| [PR_CHECKLIST.md](./PR_CHECKLIST.md) | **PR checklist** with OpenSpec workflow integration | Contributors, Claude Code |
| [openspec/project.md](../openspec/project.md) | **Project conventions** for OpenSpec workflow | All team members |
| [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) | Context injection flow when running workflows (ASCII diagram) | Developers, Architects |
| [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) | Claude Code plugin system reference | Developers |
| [AGENT-SDK.md](./AGENT-SDK.md) | Claude Agent SDK TypeScript reference (message types, tools, hooks) | Developers |

### Archived Documents

| Document | Purpose |
|----------|---------|
| [AGENTIC_CONCEPT-0.5.md](./archive/AGENTIC_CONCEPT-0.5.md) | Agent system design: Two-plugin model (historical) |
| [TEST_PLAN-0.6.md](./archive/TEST_PLAN-0.6.md) | Test architecture with real API testing (historical) |

---

## What's New in v0.7.1

### Build Command Sandbox Support

v0.7.1 adds sandbox support for the build command:

| Feature | Description |
|---------|-------------|
| **Build Sandbox** | Sandbox created at `~/.looplia/sandbox/build-*/` |
| **Logging** | Logs stored in `logs/` subdirectory |
| **Debugging** | Enables debugging of workflow generation |

### Unified Sandbox Utilities

Shared utility functions for sandbox management:

```typescript
import { generateSandboxId, createSandboxDirectories } from "../utils/sandbox.js";

// Generate ID: build-2026-01-12-a1b2
const sandboxId = generateSandboxId("build");

// Create directories: inputs/, outputs/, logs/
const sandboxDir = createSandboxDirectories(workspace, sandboxId);
```

### ZenMux Skill Compatibility

Skill frontmatter now uses simplified model names for better proxy compatibility:

| Before (v0.7.0) | After (v0.7.1) |
|-----------------|----------------|
| `model: claude-haiku-4-5-20251001` | `model: haiku` |

**Benefit:** Enables ZenMux preset model mapping (`haiku` → `z-ai/glm-4.7`).

See [CHANGELOG.md](../CHANGELOG.md) for full v0.7.1 release notes.

---

## What's New in v0.7.0

### Skill Registry System

v0.7.0 introduces a **shadcn/ui-inspired skill registry system** for skill discovery and installation:

| Feature | Description |
|---------|-------------|
| **Remote Registry** | JSON manifest hosted on GitHub Releases for skill discovery |
| **Skill Catalog** | Local cache aggregated from multiple sources (`~/.looplia/registry/skill-catalog.json`) |
| **Build Integration** | Search registry during workflow generation |
| **Selective Loading** | Only load skills required by workflow (reduced context usage) |
| **Third-party Skills** | Live git clone support for community plugins |

### Default Marketplace Installation

During `looplia init`, **56+ skills** are automatically installed from default sources:

| Source | Description | Skills |
|--------|-------------|--------|
| **Anthropic** | anthropic-agent-skills marketplace | 42+ (xlsx, pdf, docx, pptx, frontend-design, etc.) |
| **ComposioHQ** | awesome-claude-skills marketplace | 14+ (brand-guidelines, slack-gif-creator, etc.) |

### Registry CLI Commands

New `looplia registry` command family:

```bash
looplia registry init              # Initialize registry with official source
looplia registry add <url>         # Add GitHub registry source
looplia registry sync              # Compile skill catalog from all sources
looplia registry list              # List configured sources and stats
looplia registry remove <id>       # Remove a registry source
```

### Skill CLI Commands

New `looplia skill` command family:

```bash
looplia skill add <name>           # Install skill to workspace (JIT from git)
looplia skill list                 # List installed skills
looplia skill list --available     # Show all available skills
looplia skill info <name>          # Show skill details
looplia skill remove <name>        # Remove skill from workspace
looplia skill update <name>        # Update third-party skill (git pull)
```

### Workflow Skills Declaration

Workflows can now explicitly declare required skills in frontmatter:

```yaml
---
name: writing-kit
version: 1.2.0
description: Transform content into structured writing kit

# v0.7.0: Explicit skill requirements
skills:
  - media-reviewer
  - idea-synthesis
  - writing-kit-assembler

steps:
  - id: summary
    skill: media-reviewer
    # ...
---
```

**Benefits:**
- Selective plugin loading at runtime
- Reduced context window usage
- Clear dependency declaration
- JIT installation of missing skills

### LOOPLIA_HOME Environment Variable

New environment variable for custom workspace paths:

```bash
export LOOPLIA_HOME=/custom/path     # Override ~/.looplia
looplia init                         # Creates workspace at custom path
```

Useful for testing and isolated installations.

See [DESIGN-0.7.0.md](./DESIGN-0.7.0.md) for full specification.

---

## What's New in v0.6.10

### Unified Command Initialization

v0.6.10 unifies the initialization logic between `build` and `run` commands:

| Feature | Description |
|---------|-------------|
| **initializeCommandEnvironment()** | Shared initialization for both build and run commands |
| **Settings-First Loading** | Settings file loaded before API key validation |
| **Mock Mode Support** | `--mock` works without API key for testing |
| **Improved Error Messages** | Clear error messages with all available options |

**Benefits:**
- Consistent behavior across commands
- ZenMux preset works correctly with both `build` and `run`
- No API key required for mock mode testing

### Comprehensive E2E Testing Skill

New `looplia-e2e` skill for end-to-end testing:

| Test Mode | Purpose |
|-----------|---------|
| `docker-e2e.sh` | Docker container testing for CI |
| `published-cli-e2e.sh` | Published npm package validation |
| `check-v0610.sh` | Version-specific initialization checks |

**Features:**
- Version consistency check (CLI --version vs package.json)
- ZenMux GLM 4.7 preset standardization (cheaper testing)
- Subagent architecture verification (v0.6.9+)

See `.claude/skills/looplia-e2e/SKILL.md` for documentation.

---

## What's New in v0.6.9

### SDK Compatibility & Endpoint-Aware API Key Selection

v0.6.9 improves SDK compatibility and API key handling:

| Feature | Description |
|---------|-------------|
| **Optional Claude Code Path** | SDK uses built-in executable when Claude Code not globally installed |
| **Settings File Priority** | `authToken` from settings takes priority over env vars |
| **Endpoint-Based Fallback** | Falls back to endpoint-specific env var (e.g., `ZENMUX_API_KEY`) |

**API Key Selection Priority:**

| Endpoint | authToken set? | Key Used |
|----------|---------------|----------|
| ZenMux | Yes | `authToken` from settings |
| ZenMux | No | `ZENMUX_API_KEY` env |
| Anthropic | - | `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` |

**Docker Compatibility:** SDK now works in Docker containers without Claude Code installed globally.

See [DESIGN-0.6.9.md](./DESIGN-0.6.9.md) for full specification.

---

## What's New in v0.6.6

### Model Provider Configuration (ZenMux-style Model Switching)

v0.6.6 introduces model provider configuration for cost optimization and multi-provider support:

| Feature | Description |
|---------|-------------|
| **Provider Presets** | 16 presets (2 Anthropic Direct, 14 ZenMux models) |
| **CLI Commands** | `looplia config provider preset/show/set/reset` |
| **Dual-Strategy** | Anthropic uses subagents; ZenMux uses inline execution |
| **Auto API Mapping** | `ZENMUX_API_KEY` automatically mapped based on provider |

**New CLI Commands:**

```bash
looplia config provider show                    # Display current config
looplia config provider preset ZENMUX_ZAI_GLM47 # Apply preset
looplia config provider set auth-token sk-xxx   # Set API key
looplia config provider reset                   # Clear settings
```

**Configuration File:** `~/.looplia/looplia.setting.json`

**Available Presets:**
- Anthropic: `ANTHROPIC_CLAUDE_HAIKU`, `ANTHROPIC_CLAUDE_SONNET`
- ZenMux: `ZENMUX_ZAI_GLM47`, `ZENMUX_MINIMAX_M21`, `ZENMUX_GOOGLE_GEMINI3FLASH`, and 11 more

**Dual-Strategy Execution:**

| Provider | Execution Strategy | Agent Registration |
|----------|-------------------|-------------------|
| Anthropic Direct | Task subagents | skill-executor registered |
| ZenMux (Proxy) | Inline execution | No subagents |

See [DESIGN-0.6.6.md](./DESIGN-0.6.6.md) for full specification.

---

## What's New in v0.6.5

### Agent SDK Local Plugin Loading

v0.6.5 changes how plugins are loaded during workflow execution:

| Before (v0.6.4) | After (v0.6.5) |
|-----------------|----------------|
| Plugins via `.mcp.json` discovery | Plugins via SDK `plugins` option |
| Project settings sources | Direct local path loading |
| Implicit plugin resolution | Explicit path configuration |
| Hardcoded plugin list | Marketplace-driven discovery |

**Key Changes:**
- SDK `cwd` set to `~/.looplia` (sandbox and workflows accessible)
- User's working directory injected into system prompt for `--file` resolution
- Bootstrap module for three installation modes (npm bundle, remote, dev)
- Marketplace-driven plugin discovery via `.claude-plugin/marketplace.json`
- Workflows extracted to `~/.looplia/workflows/` during init (separate from plugin components)

### Runtime Structure

After `looplia init`, the following structure is created:

```
~/.looplia/
├── looplia-core/           # Plugin (name: "looplia" for /looplia: prefix)
│   ├── .claude-plugin/plugin.json
│   ├── commands/           # /looplia:run, /looplia:build, etc.
│   ├── skills/             # workflow-executor, validator, builder skills
│   └── hooks/              # Session logging, validation hooks
├── looplia-writer/         # Plugin (name: "looplia-writer")
│   ├── .claude-plugin/plugin.json
│   └── skills/             # media-reviewer, idea-synthesis, etc.
├── workflows/              # Extracted from plugins during init
│   └── writing-kit.md      # Workflow definitions
├── sandbox/                # Workflow execution sandboxes
└── user-profile.json       # User configuration
```

**Note:** Plugins remain separate (not merged). The core plugin is named "looplia" for cleaner `/looplia:` command prefix.

### Development Mode

New environment variables for development without running `init`:

```bash
export LOOPLIA_DEV=true
export LOOPLIA_DEV_ROOT=~/looplia-core
looplia run writing-kit --file ./test.md  # Works from any directory
```

In dev mode:
- Plugins loaded directly from `$LOOPLIA_DEV_ROOT/plugins/`
- Changes take effect immediately (no re-init needed)
- Both looplia-core and looplia-writer loaded as separate plugins

See [DESIGN-0.6.5.md](./DESIGN-0.6.5.md) for full specification.

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

| Folder | Plugin Name | Purpose | Contents |
|--------|-------------|---------|----------|
| **looplia-core/** | `looplia` | Infrastructure | Workflow engine, validation, `/looplia:run` command |
| **looplia-writer/** | `looplia-writer` | Domain | Content analysis skills (media-reviewer, idea-synthesis) |

**Note:** The core plugin is named "looplia" (not "looplia-core") for cleaner `/looplia:` command prefix. Workflows are extracted to `~/.looplia/workflows/` during init.

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

Commands exposed via Claude Code plugin system (prefixed with `/looplia:`):

| Command | Description |
|---------|-------------|
| `/looplia:run <workflow-id> --file <path>` | Execute a workflow on content (creates sandbox) |
| `/looplia:run <workflow-id> --sandbox-id <id>` | Resume existing sandbox |
| `/looplia:build <name>` | AI-assisted workflow creation |
| `/looplia:list-workflows` | List available workflows |

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
│                        DOCUMENT RELATIONSHIPS (v0.7.2)                       │
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
- v0.6.0 → v0.6.1 → v0.6.2 → v0.6.3 → v0.6.4 → v0.6.5 → v0.6.6 → v0.6.7 → v0.6.8 → v0.6.9 → v0.6.10 → v0.7.0 → v0.7.1 → **v0.7.2** (current)

**Key Documents:**
- **DESIGN-0.7.0.md** documents skill registry system (marketplace, selective loading)
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
version: 1.2.0
description: Transform content into structured writing kit

# v0.7.0: Explicit skill requirements for selective loading
skills:
  - media-reviewer
  - idea-synthesis
  - writing-kit-assembler

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

**Workflow-level fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Workflow identifier |
| `version` | string | No | Semantic version |
| `description` | string | **Yes** | Workflow description |
| `skills` | array | No | v0.7.0: Explicit skill dependencies for selective loading |

**Step-level fields:**

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

### Repository Layout (Development)

```
looplia-core/
├── .claude-plugin/
│   └── marketplace.json  # Plugin registry for dynamic discovery
├── apps/
│   ├── cli/              # CLI application
│   └── docs/             # Documentation (Astro Starlight)
├── packages/
│   ├── core/             # Domain models, command framework
│   └── provider/         # Claude Agent SDK integration, bootstrap module
├── plugins/
│   ├── looplia-core/     # Infrastructure plugin (name: "looplia")
│   │   ├── .claude-plugin/plugin.json
│   │   ├── CLAUDE.md
│   │   ├── commands/     # /looplia:run, /looplia:build
│   │   ├── skills/       # workflow-executor, validator, builder skills
│   │   └── hooks/
│   └── looplia-writer/   # Domain plugin (name: "looplia-writer")
│       ├── .claude-plugin/plugin.json
│       ├── workflows/    # Extracted to root during init
│       └── skills/       # media-reviewer, idea-synthesis, etc.
├── examples/             # Sample content files
└── docs/                 # Architecture documentation
```

### Runtime Layout (~/.looplia)

After `looplia init`, the following structure is created:

```
~/.looplia/
├── registry/                           # Skill Registry System (v0.7.0)
│   ├── skill-catalog.json              # Compiled skill catalog (56+ skills)
│   └── sources.json                    # Configured marketplace sources
│
├── looplia-core/                       # Built-in: core plugin
│   ├── .claude-plugin/plugin.json
│   └── skills/
│       ├── workflow-executor/
│       ├── workflow-validator/
│       ├── registry-loader/            # New in v0.7.0
│       └── ...
│
├── looplia-writer/                     # Built-in: writer plugin
│   └── skills/
│       ├── media-reviewer/
│       ├── idea-synthesis/
│       └── ...
│
├── plugins/                            # Third-party plugins (v0.7.0)
│   ├── document-skills/                # From Anthropic marketplace
│   │   └── skills/xlsx/, pdf/, docx/, pptx/
│   ├── example-skills/                 # From Anthropic marketplace
│   │   └── skills/frontend-design/, algorithmic-art/, ...
│   ├── brand-guidelines/               # From ComposioHQ marketplace
│   └── ...
│
├── sandbox/                            # Workflow execution sandboxes
├── workflows/                          # Workflow definitions
└── looplia.setting.json                # Provider configuration
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

### Two-Plugin Model (v0.6.6 - Skills-First)

```
┌─────────────────────────────────┐    ┌─────────────────────────────────────┐
│     looplia-core/ folder         │    │       looplia-writer/ folder         │
│     (name: "looplia")            │    │       (name: "looplia-writer")       │
│     Infrastructure Plugin        │    │       Domain Plugin                  │
├─────────────────────────────────┤    ├─────────────────────────────────────┤
│ commands/                        │    │ skills/                              │
│   ├── run.md → /looplia:run      │    │   ├── media-reviewer/                │
│   └── build.md → /looplia:build  │    │   ├── idea-synthesis/                │
├─────────────────────────────────┤    │   └── writing-kit-assembler/         │
│ skills/                          │    └─────────────────────────────────────┘
│   ├── workflow-executor/         │
│   ├── workflow-validator/        │    ┌─────────────────────────────────────┐
│   ├── plugin-registry-scanner/   │    │   ~/.looplia/workflows/              │
│   ├── skill-capability-matcher/  │    │   (Extracted during init)            │
│   └── workflow-schema-composer/  │    ├─────────────────────────────────────┤
├─────────────────────────────────┤    │   └── writing-kit.md                 │
│ CLAUDE.md                        │    └─────────────────────────────────────┘
│   (Generic interpreter)          │
└─────────────────────────────────┘

Note: Workflows extracted to ~/.looplia/workflows/ during init (not plugin components)
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
/looplia:run writing-kit --file article.md           # Create new sandbox
/looplia:run writing-kit --sandbox-id text-2025-12-18-abc1  # Resume existing
/looplia:build my-workflow "Description of workflow"  # v0.6.1: AI-assisted workflow creation
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

*This README provides navigation for Looplia-Core v0.7.2 documentation.*
