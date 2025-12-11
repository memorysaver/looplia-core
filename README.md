# Looplia Core

> **Universal agentic workflow CLI — compose AI agents and skills for any task.**

Looplia Core is an agentic workflow platform powered by the Claude Agent SDK. It provides a composable architecture of subagents and skills that can be extended to any domain.

**Current focus:** Content writing workflows (summarization, idea generation, writing kit construction)

**Vision:** A universal swiss knife for AI-powered workflows — one CLI, many domains, powered by the same agent infrastructure.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  CLI Commands (Workflows)                                   │
│  └─ looplia kit → Writing workflow                          │
│  └─ looplia [domain] → Future workflows                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CommandDefinition<T> + AgentExecutor                       │
│  • One prompt per command                                   │
│  • Typed output schemas (Zod)                               │
│  • Real-time streaming events                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Subagents & Skills (Composable Capabilities)               │
│  • Domain-specific subagents (content-analyzer, etc.)       │
│  • Reusable skills (SKILL.md files)                         │
│  • File-based state & smart continuation                    │
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

# 3. Bootstrap workspace (creates ~/.looplia/ with agents and skills)
bun run apps/cli/dist/index.js bootstrap

# 4. Run a workflow
export ANTHROPIC_API_KEY=sk-ant-...
bun run apps/cli/dist/index.js kit --file ./examples/ai-healthcare.md
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `looplia bootstrap` | Initialize workspace with plugin files (agents, skills, CLAUDE.md) |
| `looplia summarize` | Summarize content into structured output |
| `looplia kit` | Build a complete writing kit (summary + ideas + outline) |

### Writing Kit Workflow

The `kit` command produces a complete WritingKit:

- **Summary**: Headline, TL;DR, key bullets, tags, themes, core ideas, quotes
- **Ideas**: 5 hooks, 5 angles, 5 reflective questions
- **Outline**: Structured sections with word estimates
- **Meta**: Relevance score, estimated reading time

```bash
# Build kit from content
looplia kit --file ./article.md

# With options
looplia kit --file ./article.md --topics "ai,productivity" --tone expert --word-count 2000

# Resume existing session
looplia kit --session-id article-2024-12-09-abc123

# Output formats
looplia kit --file ./article.md --format markdown --output kit.md
```

### Session Management

Each `--file` creates a new session. Use `--session-id` to resume:

```bash
# Create new session
looplia kit --file ./article.md
# Output: ✓ New session created: article-2024-12-09-abc123

# Resume (skips completed steps via smart continuation)
looplia kit --session-id article-2024-12-09-abc123
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
    ├── AGENTIC_CONCEPT-0.2.md
    ├── GLOSSARY.md
    └── TEST_PLAN-0.2.md
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
- [AGENTIC_CONCEPT-0.2.md](./docs/AGENTIC_CONCEPT-0.2.md) - Agent system design
- [GLOSSARY.md](./docs/GLOSSARY.md) - Ubiquitous language reference
- [TEST_PLAN-0.2.md](./docs/TEST_PLAN-0.2.md) - Test strategy

## License

MIT
