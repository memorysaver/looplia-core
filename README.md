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
| `looplia summarize` | Summarize content from a file into structured output |
| `looplia kit` | Build a complete writing kit (summary + ideas + outline) |

### Quick Examples

```bash
# Summarize a file (requires ANTHROPIC_API_KEY)
looplia summarize --file ./article.txt

# Build a writing kit with options
looplia kit --file ./article.txt --topics "ai,productivity" --tone expert

# Use mock provider (no API key needed)
looplia summarize --file ./article.txt --mock

# Output as markdown
looplia kit --file ./article.txt --format markdown --mock
```

### Local Development

After building the project, you can link the CLI globally for development:

```bash
# Build the project
bun run build

# Link CLI globally (run once)
cd apps/cli && bun link

# Now 'looplia' command is available anywhere
looplia --help
```

The link is a symlink to your local build. Any time you rebuild (`bun run build`), the global `looplia` command automatically uses the latest version.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for Claude API calls (skip with `--mock` flag) |
