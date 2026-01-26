# Looplia-Core Documentation

> **Version:** 0.7.5
> **Last Updated:** January 2026

This directory contains the core documentation for Looplia-Core, a Claude Agent SDK-based agentic workflow platform.

---

## Core Documents

These are the current, authoritative documents for the v0.7.5 architecture:

| Document | Purpose | Audience |
|----------|---------|----------|
| [AGENTIC_CONCEPT_1.0.md](./AGENTIC_CONCEPT_1.0.md) | **Skills-first architecture overview** - comprehensive guide | All team members |
| [GLOSSARY.md](./GLOSSARY.md) | Ubiquitous language reference (domain terms + TypeScript types) | All team members |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | **Development and release workflow** with OpenSpec integration | Contributors, Claude Code |
| [openspec/project.md](../openspec/project.md) | **Project conventions** for OpenSpec workflow | All team members |
| [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md) | Context injection flow when running workflows (ASCII diagram) | Developers, Architects |
| [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md) | Claude Code plugin system reference | Developers |
| [AGENT-SDK.md](./AGENT-SDK.md) | Claude Agent SDK TypeScript reference (message types, tools, hooks) | Developers |
| [SUBAGENTS.md](./SUBAGENTS.md) | Anthropic documentation for Subagents | Developers |
| [AGENT-SKILLS.md](./AGENT-SKILLS.md) | Anthropic documentation for Agent Skills | Developers |

### Archived Documents

Historical design documents and version-specific specs are preserved in `/docs/archive/`:

| Document | Version | Notes |
|----------|---------|-------|
| [DESIGN-0.7.2.md](./archive/DESIGN-0.7.2.md) | v0.7.2 | Output flag and LOOPLIA_OUTPUT_DIR |
| [DESIGN-0.7.1.md](./archive/DESIGN-0.7.1.md) | v0.7.1 | Build sandbox support, ZenMux compatibility |
| [DESIGN-0.7.0.md](./archive/DESIGN-0.7.0.md) | v0.7.0 | Skill Registry System, marketplace |
| [DESIGN-0.6.10.md](./archive/DESIGN-0.6.10.md) | v0.6.10 | Unified command initialization |
| [DESIGN-0.6.9.md](./archive/DESIGN-0.6.9.md) | v0.6.9 | SDK Compatibility & API Key Selection |
| [DESIGN-0.6.6.md](./archive/DESIGN-0.6.6.md) | v0.6.6 | Model Provider Configuration |
| [DESIGN-0.6.5.md](./archive/DESIGN-0.6.5.md) | v0.6.5 | Agent SDK plugin loading |
| [DESIGN-0.6.3.md](./archive/DESIGN-0.6.3.md) | v0.6.3 | Input-less workflows, web-capable skills |
| [DESIGN-0.6.2.md](./archive/DESIGN-0.6.2.md) | v0.6.2 | Schema-in-Skill architecture |
| [DESIGN-0.6.1.md](./archive/DESIGN-0.6.1.md) | v0.6.1 | Skills-first architecture |
| [DESIGN-0.6.0.md](./archive/DESIGN-0.6.0.md) | v0.6.0 | Steps-based workflow schema |
| [DESIGN-0.5.2.md](./archive/DESIGN-0.5.2.md) | v0.5.2 | Two-plugin architecture |
| [DESIGN-0.5.1.md](./archive/DESIGN-0.5.1.md) | v0.5.1 | Workflow-as-Markdown |
| [DESIGN-0.5.0.md](./archive/DESIGN-0.5.0.md) | v0.5.0 | Initial workflow design |
| [DESIGN-0.4.0.md](./archive/DESIGN-0.4.0.md) | v0.4.0 | CommandDefinition abstraction |
| [CLEANUP-0.6.1.md](./archive/CLEANUP-0.6.1.md) | v0.6.1 | Legacy code removal plan |
| [AGENTIC_CONCEPT-0.5.md](./archive/AGENTIC_CONCEPT-0.5.md) | v0.5.2 | Two-plugin agent design (historical) |
| [TEST_PLAN-0.6.md](./archive/TEST_PLAN-0.6.md) | v0.6.0 | Test architecture (historical) |

---

## Quick Links

### For New Contributors

1. Start with [GLOSSARY.md](./GLOSSARY.md) to understand the terminology
2. Read [AGENTIC_CONCEPT_1.0.md](./AGENTIC_CONCEPT_1.0.md) for the skills-first architecture overview
3. **Before PRs:** Use [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for development and release workflow

### For Developers

- **Context injection flow?** See [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md)
- **Plugin system?** See [CLAUDE_PLUGINS.md](./CLAUDE_PLUGINS.md)
- **SDK reference?** See [AGENT-SDK.md](./AGENT-SDK.md)
- **Historical design docs?** See `/docs/archive/`

### For Architects

- **Current architecture:** [AGENTIC_CONCEPT_1.0.md](./AGENTIC_CONCEPT_1.0.md)
- **Historical versions:** `/docs/archive/DESIGN-*.md`

---

## Document Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT RELATIONSHIPS (v0.7.5)                       │
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
│ AGENTIC_CONCEPT │    │   RELEASE_CHECKLIST.md     │    │  CONTEXT-         │
│ _1.0.md         │    │   (Development Workflow)   │    │  INJECTION.md     │
│ (Architecture)  │    └────────────────────────────┘    │  (Flow)           │
└─────────────────┘                                      └───────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SDK REFERENCES                                  │
│  CLAUDE_PLUGINS.md  │  SUBAGENTS.md  │  AGENT-SKILLS.md  │  AGENT-SDK.md   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         docs/archive/ (Historical)                           │
│  DESIGN-0.4.0.md → DESIGN-0.7.2.md  │  CLEANUP-0.6.1.md  │  TEST_PLAN-*.md  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Documents:**
- **AGENTIC_CONCEPT_1.0.md** - Canonical architecture overview
- **GLOSSARY.md** - Terms used across all documents
- **RELEASE_CHECKLIST.md** - Development and release workflow
- **SDK References** - External API documentation

**Archived Documents:**
- Historical DESIGN-*.md files document version-specific features
- Preserved for reference; see `/docs/archive/`

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
    └── archive/          # Historical design documents
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

## Slash Commands

Commands exposed via Claude Code plugin system (prefixed with `/looplia:`):

| Command | Description |
|---------|-------------|
| `/looplia:run <workflow-id> --file <path>` | Execute a workflow on content (creates sandbox) |
| `/looplia:run <workflow-id> --sandbox-id <id>` | Resume existing sandbox |
| `/looplia:build <name>` | AI-assisted workflow creation |
| `/looplia:list-workflows` | List available workflows |

---

*This README provides navigation for Looplia-Core v0.7.5 documentation.*
