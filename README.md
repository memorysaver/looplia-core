# Looplia Core


Looplia Core is a vendor-neutral, stateless content-intelligence engine that transforms raw long-form content into structured writing materials.

It provides a clean, composable pipeline for:

Summarization – turn transcripts/articles into structured summaries

Idea Generation – produce hooks, angles, and reflective questions

Writing Kit Construction – assemble summaries + ideas + outlines for human writing workflows

Looplia Core defines the canonical domain models and pure engines behind the Looplia ecosystem.
It does not fetch content, call LLMs, store data, schedule jobs, or manage users.

All LLM interaction is injected through Providers, enabling support for Claude Agents, OpenAI, DeepSeek, local models, and any future ecosystem.

This repository contains only the open-source core.
Scheduling, storage, UI, publishing, and agent orchestration are implemented in Looplia Cloud and other downstream applications.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Husky** - Git hooks for code quality
- **Starlight** - Documentation site with Astro
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```


Then, run the development server:

```bash
bun run dev
```









## Project Structure

```
looplia-core/
├── apps/
│   ├── docs/        # Documentation site (Astro Starlight)
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run check-types`: Check TypeScript types across all apps
- `cd apps/docs && bun run dev`: Start documentation site
- `cd apps/docs && bun run build`: Build documentation site

## CLI Usage

The `looplia` CLI provides content intelligence tools from the command line.

### Commands

| Command | Description |
|---------|-------------|
| `looplia bootstrap` | Initialize workspace with plugin files (agents, skills, CLAUDE.md) |
| `looplia summarize` | Summarize content from a file into structured output |
| `looplia kit` | Build a complete writing kit (summary + ideas + outline) |

### Quick Start

```bash
# 1. Build the project
bun run build

# 2. Bootstrap workspace (creates ~/.looplia/ with agents and skills)
bun run apps/cli/dist/index.js bootstrap

# 3. Build a writing kit from content
export ANTHROPIC_API_KEY=sk-ant-...
bun run apps/cli/dist/index.js kit --file ./examples/ai-healthcare.md
```

### Example Output

The `kit` command produces a complete WritingKit with:
- **Summary**: Headline, TL;DR, key bullets, tags, themes, core ideas, quotes
- **Ideas**: 5 hooks (emotional, curiosity, controversy, statistic, story), 5 angles, 5 questions
- **Outline**: 7 sections with word estimates (~2,500 words total)
- **Meta**: Relevance score, estimated reading time

### Session Management

Each `--file` creates a new session. Use `--session-id` to resume:

```bash
# Create new session from file
looplia kit --file ./article.md
# Output: ✓ New session created: article-2024-12-09-abc123

# Resume existing session (skips completed steps)
looplia kit --session-id article-2024-12-09-abc123
# Output: ✓ Resuming session: article-2024-12-09-abc123
```

Smart continuation automatically detects existing files (`summary.json`, `ideas.json`) and skips already-completed analysis steps.

### All Options

```bash
# Summarize command
looplia summarize --file <path>        # Summarize content
looplia summarize --file <path> --mock # Use mock provider (no API key)
looplia summarize --file <path> --format markdown --output summary.md

# Kit command
looplia kit --file <path>              # Build kit from new file
looplia kit --session-id <id>          # Resume existing session
looplia kit --file <path> --topics "ai,productivity" --tone expert
looplia kit --file <path> --word-count 2000
looplia kit --file <path> --format markdown --output kit.md
looplia kit --file <path> --mock       # Use mock provider (no API key)
```

### Local Development

After building the project, you can link the CLI globally:

```bash
# Build the project
bun run build

# Link CLI globally (run once)
cd apps/cli && bun link

# Now 'looplia' command is available anywhere
looplia --help
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for Claude API calls (skip with `--mock` flag) |
