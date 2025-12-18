# Looplia Core

> **Universal agentic workflow CLI — compose AI agents and skills for any task.**

Looplia Core is an agentic workflow platform powered by the Claude Agent SDK. It provides a composable architecture of custom subagents with auto-loading skills that can be extended to any domain.

**Current focus:** Content writing workflows (summarization, idea generation, writing kit construction)

**Vision:** A universal swiss knife for AI-powered workflows — one CLI, many domains, powered by the same agent infrastructure.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  CLI Commands                                               │
│  └─ looplia init   → Initialize workspace                   │
│  └─ looplia run    → Execute workflow (e.g., writing-kit)   │
│  └─ looplia config → Manage user settings                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Workflow-as-Markdown + AgentExecutor                       │
│  • Workflow definitions (workflows/*.md with frontmatter)   │
│  • Validation-driven completion (validation.json)           │
│  • Real-time streaming events                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Custom Subagents & Auto-Loading Skills                     │
│  • Custom subagents via Task tool (.claude/agents/)         │
│  • Skills auto-load via frontmatter (.claude/skills/)       │
│  • Validation-driven state & smart continuation             │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Claude Agent SDK** - Agentic runtime with custom subagents and skills
- **Workflow-as-Markdown** - YAML frontmatter + markdown instructions
- **Sandbox Isolation** - Each run in `sandbox/{id}/inputs/outputs/logs/`
- **Custom Subagents** - Task tool with custom `subagent_type`
- **Skills Auto-Loading** - `skills:` frontmatter for automatic skill loading
- **Validation-Driven** - Deterministic script-based output validation
- **Clean Architecture** - CLI → Core → Provider separation
- **Streaming TUI** - Real-time progress with tool execution display
- **Smart Continuation** - Resume workflows via `--sandbox-id`
- **TypeScript** - Full type safety with Zod schemas

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Build the project
bun run build

# 3. Initialize workspace (creates ~/.looplia/ with agents, skills, workflows)
bun run apps/cli/dist/index.js init --yes

# 4. Run a workflow
export ANTHROPIC_API_KEY=sk-ant-...
bun run apps/cli/dist/index.js run writing-kit --file ./examples/ai-healthcare.md
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `looplia init` | Initialize workspace with plugin files (agents, skills, workflows, CLAUDE.md) |
| `looplia run <workflow-id>` | Execute workflow to build output (e.g., `run writing-kit --file article.md`) |
| `looplia config` | Manage user profile settings |

### Writing Kit Workflow

The `run writing-kit` command executes a 3-stage pipeline:

```
content-analyzer → summary.json
       ↓
idea-generator → ideas.json
       ↓
writing-kit-builder → writing-kit.json
```

**Output includes:**
- **Summary**: Headline, TL;DR, key bullets, tags, themes, core ideas, quotes
- **Ideas**: 5 hooks (emotional, curiosity, controversy, statistic, story), angles, questions
- **Outline**: Structured sections with word estimates
- **Meta**: Relevance score, estimated reading time

```bash
# Build kit from content
looplia run writing-kit --file ./article.md

# With user profile options
looplia run writing-kit --file ./article.md --topics "ai,productivity"

# Resume existing session
looplia run writing-kit --session-id article-2024-12-09-abc123

# Output formats
looplia run writing-kit --file ./article.md --format markdown --output kit.md
```

### Sandbox Architecture (v0.5.2)

Each `--file` creates an isolated sandbox folder:

```
~/.looplia/sandbox/{sandbox-id}/
├── inputs/content.md      # Copied from --file
├── outputs/               # Generated artifacts (summary.json, ideas.json, etc.)
├── logs/                  # Session logs for debugging
└── validation.json        # Tracks validated: true/false per output
```

**Sandbox ID format:** `{slug}-{YYYY-MM-DD}-{random4chars}` (e.g., `my-article-2025-12-18-xk7m`)

```bash
# Create new sandbox
looplia run writing-kit --file ./article.md
# Output: Created sandbox: my-article-2025-12-18-xk7m

# Resume existing sandbox (skips validated steps)
looplia run writing-kit --sandbox-id my-article-2025-12-18-xk7m
```

## Architecture

```
looplia-core/
├── apps/
│   ├── cli/              # CLI application
│   └── docs/             # Documentation (Astro Starlight)
├── packages/
│   ├── core/             # Domain models, command framework
│   └── provider/         # Claude Agent SDK integration
├── plugins/
│   ├── looplia-core/     # Infrastructure plugin (commands, skills, hooks)
│   └── looplia-writer/   # Domain plugin (agents, workflows)
├── scripts/
│   └── verify-workflow-log.sh  # Log verification script
└── docs/                 # Architecture documentation
    ├── DESIGN-0.5.2.md
    ├── AGENTIC_CONCEPT-0.5.md
    ├── TEST_PLAN-0.5.md
    └── GLOSSARY.md
```

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

# Verify workflow logs
./scripts/verify-workflow-log.sh
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for Claude API (skip with `--mock` flag) |

## Documentation

| Document | Description |
|----------|-------------|
| [DESIGN-0.5.2.md](./docs/DESIGN-0.5.2.md) | Two-plugin architecture, sandbox folder design |
| [AGENTIC_CONCEPT-0.5.md](./docs/AGENTIC_CONCEPT-0.5.md) | Agent system design with validation-driven completion |
| [TEST_PLAN-0.5.md](./docs/TEST_PLAN-0.5.md) | Test strategy with real API testing |
| [GLOSSARY.md](./docs/GLOSSARY.md) | Ubiquitous language reference |
| [PR_CHECKLIST.md](./docs/PR_CHECKLIST.md) | PR checklist for docs and CI/CD alignment |
| [SUBAGENTS.md](./docs/SUBAGENTS.md) | Anthropic SDK subagents reference |
| [AGENT-SKILLS.md](./docs/AGENT-SKILLS.md) | Anthropic SDK skills reference |

## License

[Elastic License 2.0](./LICENSE)
