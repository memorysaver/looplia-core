# Project Context

## Purpose

**Looplia-Core** is a Claude Agent SDK-based agentic workflow platform that enables creating and executing multi-step AI workflows. It provides:
- A skill registry system with marketplace integration for 56+ skills
- Declarative workflow definitions (Markdown with YAML frontmatter)
- Deterministic multi-step orchestration via a universal skill-executor
- Sandbox-based isolated workflow execution

**Current Version:** v0.7.3

## Tech Stack

- **Runtime:** Bun (package manager and runtime)
- **Language:** TypeScript (strict mode)
- **Monorepo:** Turborepo with Bun workspaces
- **AI SDK:** Claude Agent SDK (Anthropic)
- **CLI Framework:** Ink (React for CLI)
- **Linting/Formatting:** Ultracite (zero-config Biome preset)
- **Documentation:** Astro Starlight
- **Scaffolding:** Better-T-Stack CLI

## Project Conventions

### Code Style

Uses **Ultracite** (Biome-based) with these principles:
- Explicit types for function parameters and return values
- Prefer `unknown` over `any`
- Arrow functions for callbacks
- `for...of` over `.forEach()`
- Optional chaining (`?.`) and nullish coalescing (`??`)
- `const` by default, `let` only when needed, never `var`
- `async/await` over promise chains

**Commands:**
- `npx ultracite fix` - Auto-fix issues
- `npx ultracite check` - Check for issues

### Architecture Patterns

**Skills-First Architecture (v0.6.1+):**
- Skills are first-class citizens, not agents
- Universal `skill-executor` subagent handles ALL workflow steps
- Skills define their own JSON schemas in SKILL.md files

**Two-Plugin Model:**
- `looplia-core/` (name: "looplia") - Infrastructure: commands, workflow engine
- `looplia-writer/` (name: "looplia-writer") - Domain: content analysis skills

**Sandbox Architecture:**
- Each workflow run creates isolated sandbox: `~/.looplia/sandbox/{id}/`
- Structure: `inputs/`, `outputs/`, `logs/`, `validation.json`
- Resumable via `--sandbox-id` flag

**Skill Registry (v0.7.0+):**
- Skills installed to `~/.looplia/plugins/`
- Selective loading based on workflow `skills:` declaration
- Third-party skills via git clone

### Testing Strategy

- **E2E Testing:** `looplia-e2e` skill with Docker support
- **Modes:** Docker E2E, published CLI validation, version-specific checks
- **CI:** GitHub Actions with Docker testing
- **Mock Mode:** `--mock` flag for testing without API keys

### Git Workflow

- **Main Branch:** `main`
- **Feature Branches:** `feature/<name>` for new features
- **PR Checklist:** Review `docs/PR_CHECKLIST.md` before merging
- **Commit Convention:** Co-authored commits with Claude Code

## Domain Context

**Core Concepts:**
- **Workflow:** Markdown file with YAML frontmatter defining multi-step skill orchestration
- **Skill:** Reusable AI capability with defined input/output schemas
- **Step:** Single skill invocation within a workflow (`skill:` + `mission:`)
- **Sandbox:** Isolated execution environment for a workflow run
- **Mission:** Natural language description of what a skill should accomplish

**Key Files:**
- `~/.looplia/` - User workspace
- `~/.looplia/workflows/` - Workflow definitions
- `~/.looplia/registry/` - Skill catalog and sources
- `~/.looplia/looplia.setting.json` - Provider configuration

**Commands:**
- `/looplia:run <workflow> --file <path>` - Execute workflow
- `/looplia:build <name>` - AI-assisted workflow creation
- `looplia skill add <name>` - Install skill from registry

## Important Constraints

- **No barrel files** - Prefer specific imports
- **Skills define schemas** - No workflow-specific types in `packages/core`
- **Sandbox ID format:** `{slug}-{YYYY-MM-DD}-{random4chars}`
- **Workflow skills declaration:** Required for selective loading (v0.7.0+)
- **OpenSpec:** Use for new features, breaking changes, architecture shifts

## External Dependencies

| Service | Purpose | Auth |
|---------|---------|------|
| **Anthropic API** | Claude Agent SDK | `ANTHROPIC_API_KEY` or OAuth |
| **ZenMux** (optional) | Model proxy for cost optimization | `ZENMUX_API_KEY` |
| **GitHub Releases** | Skill registry manifests | Public |
| **Git** | Third-party skill installation | Public repos |

**Model Presets:**
- Anthropic Direct: `ANTHROPIC_CLAUDE_HAIKU`, `ANTHROPIC_CLAUDE_SONNET`
- ZenMux: 14 presets including `ZENMUX_ZAI_GLM47`
