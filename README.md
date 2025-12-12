# Looplia Core

> **Universal agentic workflow CLI — compose AI agents and skills for any task.**

Looplia Core is an agentic workflow platform powered by the Claude Agent SDK. It provides a composable architecture of subagents and skills that can be extended to any domain.

**Current focus:** Content writing workflows (summarization, idea generation, writing kit construction)

**Vision:** A universal swiss knife for AI-powered workflows — one CLI, many domains, powered by the same agent infrastructure.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  CLI Commands                                               │
│  └─ looplia init   → Initialize workspace                   │
│  └─ looplia run    → Execute pipeline workflow              │
│  └─ looplia config → Manage user settings                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Pipeline-as-Configuration + AgentExecutor                  │
│  • YAML workflow definitions (pipelines/)                   │
│  • Session manifest for smart continuation                  │
│  • Real-time streaming events                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Subagents & Skills (Composable Capabilities)               │
│  • Domain-specific subagents (.claude/agents/)              │
│  • Reusable skills (.claude/skills/)                        │
│  • Manifest-based state & smart continuation                │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Claude Agent SDK** - Agentic runtime with subagents and skills
- **Clean Architecture** - CLI → Core → Provider separation
- **Streaming TUI** - Real-time progress with tool execution display
- **Smart Continuation** - Resume workflows from where they left off
- **TypeScript** - Full type safety with Zod schemas
- **Turborepo** - Optimized monorepo build system

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Build the project
bun run build

# 3. Initialize workspace (creates ~/.looplia/ with agents, skills, pipelines)
bun run apps/cli/dist/index.js init --yes

# 4. Run a workflow
export ANTHROPIC_API_KEY=sk-ant-...
bun run apps/cli/dist/index.js run --file ./examples/ai-healthcare.md
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `looplia init` | Initialize workspace with plugin files (agents, skills, pipelines, CLAUDE.md) |
| `looplia run` | Execute pipeline to build a complete writing kit |
| `looplia config` | Manage user profile settings |

### Writing Kit Workflow

The `run` command executes the writing-kit pipeline and produces a complete WritingKit:

- **Summary**: Headline, TL;DR, key bullets, tags, themes, core ideas, quotes
- **Ideas**: 5 hooks, 5 angles, 5 reflective questions
- **Outline**: Structured sections with word estimates
- **Meta**: Relevance score, estimated reading time

```bash
# Build kit from content
looplia run --file ./article.md

# With options
looplia run --file ./article.md --topics "ai,productivity" --tone expert --word-count 2000

# Resume existing session
looplia run --session-id article-2024-12-09-abc123

# Output formats
looplia run --file ./article.md --format markdown --output kit.md
```

### Session Management

Each `--file` creates a new session with a `session.json` manifest. Use `--session-id` to resume:

```bash
# Create new session
looplia run --file ./article.md
# Output: ✓ New session created: article-2024-12-09-abc123

# Resume (skips completed steps via manifest-based smart continuation)
looplia run --session-id article-2024-12-09-abc123
```

## Architecture

```
looplia-core/
├── apps/
│   ├── cli/           # CLI application
│   └── docs/          # Documentation (Astro Starlight)
├── packages/
│   ├── core/          # Domain models, command framework
│   └── provider/      # Claude Agent SDK integration
└── docs/              # Architecture documentation
    ├── DESIGN-0.4.0.md
    ├── AGENTIC_CONCEPT-0.3.md
    ├── GLOSSARY.md
    └── TEST_PLAN-0.3.md
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
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for Claude API (skip with `--mock` flag) |

## Documentation

- [DESIGN-0.4.0.md](./docs/DESIGN-0.4.0.md) - Architecture overview
- [AGENTIC_CONCEPT-0.3.md](./docs/AGENTIC_CONCEPT-0.3.md) - Agent system design
- [GLOSSARY.md](./docs/GLOSSARY.md) - Ubiquitous language reference
- [TEST_PLAN-0.3.md](./docs/TEST_PLAN-0.3.md) - Test strategy

## License

[Elastic License 2.0](./LICENSE)
