# Looplia Core

> **Skills-first agentic workflow CLI — compose AI skills and workflows for any task.**

Looplia Core is an agentic workflow platform powered by the Claude Agent SDK. It provides a **skills-first architecture** where workflows declare which skill to execute and provide natural language missions, letting Claude determine the best approach.

**Current focus:** Content writing workflows (summarization, idea generation, writing kit construction)

**Vision:** A universal CLI for AI-powered workflows — one tool, many domains, powered by composable skills.

## v0.7.0 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLI Commands                                                               │
│  └─ looplia init     → Initialize workspace + install marketplace skills    │
│  └─ looplia run      → Execute workflow on content                          │
│  └─ looplia build    → Build workflow from natural language                 │
│  └─ looplia registry → Manage skill registry sources                        │
│  └─ looplia skill    → Install and manage individual skills                 │
│  └─ looplia config   → Manage user profile                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Workflow-as-Markdown + Per-Step Orchestration                              │
│  • Workflow definitions (workflows/*.md with YAML frontmatter)              │
│  • Each step: skill: + mission: syntax                                      │
│  • One step → one skill-executor call → multiple skills execution           │
│  • Validation-driven completion (validation.json)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Two-Plugin Model + Skill Registry                                          │
│  ┌─────────────────────────────┬───────────────────────────────────────────┐│
│  │ looplia-core                │ looplia-writer                            ││
│  │ (Infrastructure)            │ (Domain)                                  ││
│  ├─────────────────────────────┼───────────────────────────────────────────┤│
│  │ • CLAUDE.md (entry point)   │ • workflows/writing-kit.md                ││
│  │ • commands/run.md, build.md │ • skills/media-reviewer/                  ││
│  │ • skills/workflow-executor/ │ • skills/idea-synthesis/                  ││
│  │ • skills/workflow-validator/│ • skills/writing-kit-assembler/           ││
│  │ • skills/registry-loader/   │ • user-profile.json                       ││
│  │ • hooks/                    │                                           ││
│  └─────────────────────────────┴───────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Skill Registry System (v0.7.0)                                          ││
│  │ • ~/.looplia/registry/skill-catalog.json (compiled from all sources)    ││
│  │ • ~/.looplia/plugins/ (third-party skills from marketplaces)            ││
│  │ • Default sources: Anthropic (42+ skills), ComposioHQ (29+ skills)      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Skills-First Architecture** - Workflows declare skills + missions, not rigid agent definitions
- **Skill Registry System** - shadcn/ui-inspired registry for skill discovery and installation
- **Selective Plugin Loading** - Only load skills required by workflow (reduced context usage)
- **Third-party Skills** - Install community skills via git clone from marketplaces
- **Marketplace Integration** - 56+ skills installed by default (Anthropic + ComposioHQ)
- **Per-Step Orchestration** - One workflow step → one skill-executor call → multiple skills
- **Workflow-as-Markdown** - YAML frontmatter + markdown documentation
- **Sandbox Isolation** - Each run in `sandbox/{id}/inputs/outputs/logs/`
- **Validation-Driven** - Deterministic script-based output validation
- **Two-Plugin Model** - Separate infrastructure (core) from domain logic (writer)
- **Streaming TUI** - Real-time progress with tool execution display
- **Smart Continuation** - Resume workflows via `--sandbox-id`
- **TypeScript** - Full type safety with Zod schemas

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Build the project
bun run build

# 3. Initialize workspace (creates ~/.looplia/ with plugins)
bun run apps/cli/dist/index.js init --yes

# 4. Run a workflow
export ANTHROPIC_API_KEY=sk-ant-...
bun run apps/cli/dist/index.js run writing-kit --file ./examples/ai-healthcare.md
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `looplia init` | Initialize workspace + install marketplace skills (56+) |
| `looplia run <workflow-id>` | Execute workflow on content |
| `looplia build [description]` | Build workflow from natural language |
| `looplia registry <subcommand>` | Manage skill registry sources |
| `looplia skill <subcommand>` | Install and manage individual skills |
| `looplia config` | Manage user profile settings |
| `looplia config provider` | Configure model provider and presets |

### Run Command

Execute a workflow from `~/.looplia/workflows/` on provided content:

```bash
# Create new sandbox and run workflow
looplia run writing-kit --file ./article.md

# Resume existing sandbox
looplia run writing-kit --sandbox-id article-2025-12-18-abc123

# Options
looplia run <workflow-id> --file <path>       # New sandbox
looplia run <workflow-id> --sandbox-id <id>   # Resume sandbox
looplia run <workflow-id> --mock              # Mock mode (no API)
looplia run <workflow-id> --no-streaming      # Batch mode
```

### Build Command

Create a workflow definition from natural language:

```bash
# Interactive mode
looplia build

# Direct mode
looplia build "analyze videos and create blog outlines"

# With explicit name
looplia build --name article-summary "summarize articles and extract key points"
```

The build command uses three skills in sequence:
1. **registry-loader** - Load compiled skill catalog (v0.7.0)
2. **skill-capability-matcher** - Match requirements to skills
3. **workflow-schema-composer** - Generate workflow YAML/Markdown with `skills:` field

### Registry Command

Manage skill registry sources:

```bash
looplia registry init              # Initialize registry with official source
looplia registry add <url>         # Add GitHub registry source
looplia registry sync              # Compile skill catalog from all sources
looplia registry list              # List configured sources and stats
looplia registry remove <id>       # Remove a registry source
```

### Skill Command

Install and manage individual skills:

```bash
looplia skill add <name>           # Install skill to workspace
looplia skill list                 # List installed skills
looplia skill list --available     # Show all available skills
looplia skill info <name>          # Show skill details
looplia skill remove <name>        # Remove skill from workspace
looplia skill update <name>        # Update third-party skill (git pull)
```

### Config Command

Manage user profile for personalized content:

```bash
# Set topics of interest
looplia config topics "AI, productivity, writing"

# Set writing style
looplia config style --tone expert --word-count 1500 --voice first-person

# Show current profile
looplia config show

# Configure model provider (v0.6.6)
looplia config provider show                       # Display current config
looplia config provider preset ZENMUX_ZAI_GLM47    # Apply preset
looplia config provider set auth-token sk-ai-xxx   # Set API key
looplia config provider reset                      # Clear config
```

## Workflow Schema

Workflows are markdown files with YAML frontmatter. Each step declares a `skill:` and `mission:` for Claude to execute. See [Workflow Schema](./docs/README.md#workflow-schema) for the complete schema reference and examples.

## Sandbox Architecture

Each `--file` creates an isolated sandbox:

```
~/.looplia/sandbox/{sandbox-id}/
├── inputs/content.md      # Copied from --file
├── outputs/               # Generated artifacts
│   ├── summary.json
│   ├── ideas.json
│   └── writing-kit.json
├── logs/                  # Session logs
└── validation.json        # Step completion tracking
```

**Sandbox ID format:** `{slug}-{YYYY-MM-DD}-{random4chars}` (e.g., `my-article-2025-12-18-xk7m`)

## Available Skills

After `looplia init`, **56+ skills** are available from three sources:

### Built-in: Infrastructure (looplia-core)

| Skill | Purpose |
|-------|---------|
| **workflow-executor** | Execute looplia workflows, orchestrate steps |
| **workflow-validator** | Validate JSON artifacts against criteria |
| **registry-loader** | Load compiled skill catalog for build pipeline |
| **skill-capability-matcher** | Match requirements to skills |
| **workflow-schema-composer** | Generate workflow definitions with `skills:` field |

### Built-in: Domain (looplia-writer)

| Skill | Purpose |
|-------|---------|
| **media-reviewer** | Deep content analysis, extract themes and quotes |
| **content-documenter** | Structure content into documentation format |
| **idea-synthesis** | Generate hooks, angles, and questions |
| **writing-kit-assembler** | Assemble final writing kit with outline |
| **user-profile-reader** | Read user preferences for personalization |

### Third-party: Marketplace Skills

Installed during `looplia init` from default sources:

| Source | Skills | Examples |
|--------|--------|----------|
| **Anthropic** | 42+ | xlsx, pdf, docx, pptx, frontend-design, algorithmic-art, mcp-builder |
| **ComposioHQ** | 14+ | brand-guidelines, slack-gif-creator, webapp-testing |

Run `looplia skill list --available` to see all skills. Install additional skills with `looplia skill add <name>`.

## Development

```bash
# Start development
bun run dev

# Run tests
bun test

# Type check
bun run check-types

# Link CLI globally
cd apps/cli && bun link
looplia --help

# Test with real API
env $(cat .env) looplia run writing-kit --file test.md
```

### Development Mode

For contributors developing looplia from source without running `init`:

```bash
# Set environment variables
export LOOPLIA_DEV=true
export LOOPLIA_DEV_ROOT=~/looplia-core

# Run from any directory - plugins loaded directly from source
cd ~/my-project
looplia run writing-kit --file ./article.md
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for Claude API |
| `CLAUDE_CODE_OAUTH_TOKEN` | Alternative: OAuth token |
| `ZENMUX_API_KEY` | ZenMux proxy API key (auto-mapped to ANTHROPIC_API_KEY) |
| `LOOPLIA_AGENT_MODEL_MAIN` | Override main agent model |
| `LOOPLIA_AGENT_MODEL_EXECUTOR` | Override executor model |
| `LOOPLIA_HOME` | Override ~/.looplia path (testing/custom installs) |
| `LOOPLIA_DEV` | Enable development mode (load from source) |
| `LOOPLIA_DEV_ROOT` | Path to looplia-core repo (for dev mode) |

## Documentation

| Document | Description |
|----------|-------------|
| [DESIGN-0.7.0.md](./docs/DESIGN-0.7.0.md) | Skill Registry System design |
| [AGENTIC_CONCEPT_1.0.md](./docs/AGENTIC_CONCEPT_1.0.md) | Skills-first architecture design |
| [GLOSSARY.md](./docs/GLOSSARY.md) | Ubiquitous language reference |
| [PR_CHECKLIST.md](./docs/PR_CHECKLIST.md) | PR checklist for contributors |

## Version History

| Version | Focus |
|---------|-------|
| v0.5.x | Agent system, two-plugin model |
| v0.6.0 | Steps-based workflows, `run: agents/X` syntax |
| v0.6.1 | Skills-first, universal skill-executor |
| v0.6.2 | Per-step orchestration |
| v0.6.3 | Input-less workflows, web-capable skills |
| v0.6.4 | Interactive Build Wizard, Streaming TUI |
| v0.6.5 | Agent SDK Local Plugin Loading, Bootstrap Module |
| v0.6.6 | Model Provider Configuration, ZenMux Integration |
| v0.6.7 | Package rename to @looplia/looplia-cli |
| v0.6.8 | Claude Code path resolution fix |
| v0.6.9 | SDK Compatibility, Endpoint-Aware API Key Selection |
| v0.6.10 | Unified Command Initialization, E2E Testing Skill |
| **v0.7.0** | **Skill Registry System, Marketplace Integration** |

## License

[Elastic License 2.0](./LICENSE)
