# Changelog

All notable changes to Looplia-Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.1] - 2026-01-12

### Added

- **Build Command Sandbox Support** - Build command now creates sandbox with logs
  - Sandbox directory: `~/.looplia/sandbox/build-YYYY-MM-DD-XXXX/`
  - Logs stored in `logs/` subdirectory
  - Enables debugging of workflow generation process

- **ZenMux Build E2E Test** - New `test-build-zenmux` job in Docker E2E workflow
  - Tests build command with ZenMux GLM-4.7 preset
  - Validates skill model mapping works correctly

### Changed

- **Unified Sandbox Utilities** - Shared sandbox functions in `utils/sandbox.ts`
  - `generateSandboxId()` - Consistent ID generation across commands
  - `createSandboxDirectories()` - Standard directory structure creation
  - Reduced code duplication between `run` and `build` commands

- **Skill Model Mapping** - Skill frontmatter uses simplified model names
  - Changed from `claude-haiku-4-5-20251001` to `haiku`
  - Enables ZenMux preset model mapping (`haiku` → `z-ai/glm-4.7`)
  - Updated skills: registry-loader, workflow-schema-composer, search, skill-capability-matcher

### Fixed

- **ZenMux Model Mapping** - Skills now work correctly with ZenMux presets
  - Previously: Skills with full model names caused 404 errors with ZenMux
  - Now: Simplified model names map correctly via preset configuration

## [0.7.0] - 2026-01-04

### Added

- **Skill Registry System** - shadcn/ui-inspired registry for skill discovery and installation
  - Remote registry manifest on GitHub Releases
  - Skill catalog compilation from multiple sources (official + third-party)
  - Default marketplace installation during `looplia init` (Anthropic, ComposioHQ)
  - 56+ skills available out of the box after initialization

- **Registry CLI Commands** - New `looplia registry` command family
  - `init` - Initialize local registry with official source
  - `add <url>` - Add GitHub registry source (auto-detects marketplace.json/registry.json)
  - `sync` - Compile skill catalog from all sources
  - `list` - List configured sources and stats
  - `remove <id>` - Remove a registry source

- **Skill CLI Commands** - New `looplia skill` command family
  - `add <name>` - Install skill to workspace (JIT from git)
  - `list` - List installed/available skills
  - `info <name>` - Show skill details
  - `remove <name>` - Remove skill from workspace
  - `update <name>` - Update third-party skill (git pull)

- **Selective Plugin Loading** - Only load plugins required by workflow
  - New `skills:` field in workflow frontmatter declares dependencies
  - Core skills always loaded: workflow-executor, workflow-validator, registry-loader
  - Reduces context window usage and tool discovery overhead

- **Third-party Skill Installation** - Community skill support
  - Git clone to `~/.looplia/plugins/{repo-name}/`
  - Auto-wrap standalone SKILL.md repos as valid plugins
  - Just-in-Time (JIT) installation during workflow run

- **Unified Marketplace Handling** - Support for both marketplace formats
  - Anthropic style: `skills[]` array with multiple skills per plugin
  - ComposioHQ style: `source` path with 1 skill per plugin
  - Auto-detection during sync

- **registry-loader Skill** - New skill for build pipeline
  - Loads compiled skill catalog for workflow building
  - Replaces runtime plugin-registry-scanner for faster builds

- **LOOPLIA_HOME Environment Variable** - Custom workspace path
  - Overrides `~/.looplia` path for testing/custom installations
  - Used for isolated test workspaces

### Changed

- **Init Command** - Enhanced with marketplace installation
  - Downloads and installs default marketplace sources in parallel
  - Creates plugin structure for each marketplace entry
  - Compiles skill-catalog.json after installation

- **Build Command** - Uses compiled skill catalog
  - registry-loader reads cached skill-catalog.json
  - skill-capability-matcher enhanced for installed status
  - workflow-schema-composer generates `skills:` field

- **Run Command** - JIT skill installation
  - Parses workflow to extract required skills
  - Installs missing third-party skills before execution
  - Passes requiredSkills to selective plugin loading

- **Workspace Structure** - New registry and plugins directories
  - `~/.looplia/registry/` for skill-catalog.json and sources.json
  - `~/.looplia/plugins/` for third-party installed plugins
  - First-party plugins remain at root level

### Documentation

- **DESIGN-0.7.0.md** - Complete specification for Skill Registry System
- **README.md** - Updated architecture, CLI commands, environment variables
- **docs/README.md** - Added "What's New in v0.7.0" section

## [0.6.10] - 2026-01-03

### Added

- **Unified Command Initialization** - Shared initialization logic for build and run commands
  - New `initializeCommandEnvironment()` function in `command-init.ts`
  - Settings loaded before API key validation (fixes ZenMux preset not working with `build`)
  - Mock mode (`--mock`) works without API key for testing
  - Consistent behavior across both commands

- **Comprehensive E2E Testing Skill** - New `.claude/skills/looplia-e2e/` skill
  - Docker E2E testing script with ZenMux GLM 4.7 preset support
  - Published CLI E2E testing with version consistency check
  - v0.6.10 verification script for command initialization
  - Common verification functions for workflow validation
  - Test content fixture (ai-healthcare.md)

### Changed

- **E2E Test Scripts** - Standardized on ZenMux GLM 4.7 preset for cost savings
  - `docker-e2e.sh` now prioritizes `ZENMUX_API_KEY` over `ANTHROPIC_API_KEY`
  - All scripts use `ZENMUX_ZAI_GLM47` preset when ZenMux key available
  - Fallback to Anthropic for backward compatibility

- **Version Consistency Check** - CLI version now checked against package version
  - `published-cli-e2e.sh` verifies `looplia --version` matches npm package version
  - Catches VERSION constant sync issues before publishing

### Fixed

- **ZenMux Preset with Build Command** - Settings now loaded before API key validation
  - Previously: `looplia build` failed with "API key required" even with ZenMux preset configured
  - Now: Settings file read first, then API key validated (matching `run` behavior)

### Documentation

- **DESIGN-0.6.10.md** - Unified command initialization specification
- **looplia-e2e SKILL.md** - Comprehensive E2E testing skill documentation
- **SKILL.md Environment Variables** - Updated to prefer ZenMux for cost optimization

## [0.6.9] - 2025-12-31

### Added

- **Unified Skill Executor Strategy** - Context offload for all providers
  - ALL providers (Anthropic, ZenMux, custom) now use built-in `general-purpose` subagent
  - The `workflow-executor` skill provides execution protocol that teaches subagent how to invoke other skills
  - Each workflow step = separate context window (context offload keeps main agent clean)
  - Conceptually still a "skill executor", implemented via built-in agent + skill-provided instructions
  - `workflow-executor-inline` kept as dormant fallback (not actively used)

### Changed

- **Query Executor Simplification** - Removed provider-specific branching
  - Removed `isProxyProvider` detection logic
  - Removed `workflowExecutionHint` conditional
  - Removed custom `skill-executor` agent registration
  - Simplified to unified strategy for all API providers

- **Optional Claude Code Path** - SDK compatibility improvement
  - `findClaudeCodePath()` now returns `undefined` instead of throwing
  - SDK falls back to built-in Claude Code executable when not globally installed
  - Fixes Docker E2E failures in containerized environments

- **Endpoint-Aware API Key Selection** - Improved API key handling
  - Settings file `authToken` now takes priority over environment variables
  - Endpoint-based fallback: uses `ZENMUX_API_KEY` for ZenMux endpoints
  - Cleaner logic: user explicit configuration first, then endpoint-specific env var

### Fixed

- **SDK Bundled CLI Path Resolution** - Critical fix for Docker/bundled deployments
  - Root cause: When CLI is bundled (tsup), SDK's internal `__dirname` resolves to bundle directory
  - SDK spawned our CLI instead of its bundled Claude Code, causing JSON parse errors
  - Fix: Added `findSdkBundledCliPath()` using `require.resolve()` to find SDK's `cli.js`
  - `require.resolve()` works in bundled ESM via `createRequire(import.meta.url)`
  - Search order now: env override → common paths → PATH lookup → SDK bundled CLI

- **Hook stdout Pollution** - Fix Docker E2E `JSON Parse error: Unexpected identifier "looplia"`
  - Removed SessionStart echo hook that output to stdout before SDK communication established
  - Changed `post-write-validate.sh` success messages to stderr (`>&2`)
  - Root cause: v0.6.5+ `plugins:` option loads hooks immediately; v0.6.4 `settingSources:` did not
  - Documented hook stdout usage guidelines in DESIGN-0.6.9.md

### Documentation

- **DESIGN-0.6.9.md** - Complete specification for unified skill executor, SDK compatibility, API key selection, and hook stdout fix
- **workflow-executor/SKILL.md** - Updated to use `general-purpose` subagent with full execution protocol
- **README.md** - Updated architecture version and version history
- **docs/README.md** - Added "What's New in v0.6.9" section

## [0.6.8] - 2025-12-31

### Fixed

- **Claude Code Path Resolution** - Fix SDK finding wrong executable
  - Added `findClaudeCodePath()` to explicitly locate Claude Code
  - Prevents SDK from finding looplia's CLI instead of Claude Code
  - Search order: `CLAUDE_CODE_PATH` env, common paths, `which claude`

### Changed

- **Docker Entrypoint** - Updated CLI path from `index.js` to `cli.js`
  - Matches new tsup output filename after package rename

## [0.6.7] - 2025-12-30

### Changed

- **Package Rename** - Renamed CLI package for npm publishing
  - From `@looplia-core/cli` to `@looplia/looplia-cli`
  - Prepares for npm registry publication

## [0.6.6] - 2025-12-28

### Added

- **Model Provider Configuration** - Agent-based model switching with CLI commands
  - New `looplia config provider` command family for provider management
  - `show` - Display current provider configuration
  - `preset <name>` - Apply a preset (16 available presets)
  - `set <key> <value>` - Set individual configuration values
  - `reset` - Remove provider configuration
- **Provider Presets** - 16 pre-configured model presets
  - Anthropic Direct: `ANTHROPIC_CLAUDE_HAIKU`, `ANTHROPIC_CLAUDE_SONNET`
  - ZenMux Models: `ZENMUX_ZAI_GLM47`, `ZENMUX_MINIMAX_M21`, `ZENMUX_GOOGLE_GEMINI3FLASH`, and 11 more
- **ZenMux Integration** - Full support for ZenMux proxy provider
  - Automatic `ZENMUX_API_KEY` → `ANTHROPIC_API_KEY` mapping
  - Base URL auto-configuration for ZenMux endpoints
- **Dual-Strategy Execution** - Provider-aware execution patterns
  - Anthropic Direct: Uses Task subagents with `skill-executor`
  - Proxy Providers (ZenMux): Uses inline execution without subagents
  - New `workflow-executor-inline` skill for proxy provider compatibility
- **Configuration File** - Persistent settings at `~/.looplia/looplia.setting.json`
  - Agent-centric model configuration (main agent + skill executor)
  - Provider type, base URL, and auth token storage

### Changed

- **Query Executor** - Provider detection and conditional agent registration
  - Detects provider type from settings at runtime
  - Registers `skill-executor` subagent only for Anthropic Direct
  - Injects appropriate workflow execution hint based on provider
- **Skill Model Fields** - Removed hardcoded `model:` from looplia-writer skills
  - media-reviewer, content-documenter, idea-synthesis, writing-kit-assembler, user-profile-reader
  - Models now controlled by provider configuration

### Documentation

- **DESIGN-0.6.6.md** - Complete specification for Model Provider Configuration
- **README.md** - Updated architecture diagram, CLI commands, environment variables
- **docs/README.md** - Added "What's New in v0.6.6" section

### Fixed

- **Docker Plugin Path** - Fixed plugin copy destination in Dockerfile
  - Changed from `packages/provider/plugins` to `apps/cli/plugins`
  - Ensures CLI init finds bundled plugins correctly

## [0.6.5] - 2025-12-27

### Added

- **Agent SDK Local Plugin Loading** - Load looplia plugins directly via SDK `plugins` option
  - Plugins loaded from local paths instead of `.mcp.json` discovery
  - SDK `cwd` set to `~/.looplia` for sandbox/workflow access
  - User working directory injected into system prompt for file path resolution
- **Bootstrap Module** - New `@looplia-core/provider/bootstrap` export
  - `copyBundledPlugins()` - Copy from npm package to `~/.looplia`
  - `downloadRemotePlugins()` - Download from GitHub releases
  - `getPluginPaths()` - Get plugin paths based on mode
  - `isDevMode()` - Check if running in development mode
- **Development Mode** - Run from any directory with environment variables
  - `LOOPLIA_DEV=true` - Enable development mode
  - `LOOPLIA_DEV_ROOT` - Path to looplia-core repository
  - Plugins loaded directly from source without init

### Changed

- **Init Command** - Refactored to use bootstrap module
  - Merges looplia-core and looplia-writer into single `~/.looplia` plugin
  - Creates `.claude-plugin/plugin.json` manifest
- **Slash Commands** - Use plugin prefix to avoid SDK conflicts
  - `/run` → `/looplia:run`
  - `/build` → `/looplia:build`
- **Docker Configuration** - Updated for v0.6.5 bootstrap
  - Entrypoint checks `.claude-plugin/plugin.json` instead of removed `CLAUDE.md`
  - Plugins copied to `apps/cli/plugins/` for correct path resolution
  - docker.package.json files updated to v0.6.5

### Fixed

- **Sandbox Path Resolution** - User working directory now correctly resolved
  - System prompt includes user's cwd for `--file` path resolution
- **Docker E2E Workflow** - Updated skill search path from `plugins` to `skills`

### Documentation

- **DESIGN-0.6.5.md** - Complete specification for Agent SDK plugin loading
- **.env.example** - Template with LOOPLIA_DEV environment variables

## [0.6.4] - 2025-12-26

### Added

- **Interactive Build Wizard** - Multi-turn TUI for workflow creation
  - Tab-based navigation through clarification sections (one question per tab)
  - AI-generated questions via enhanced skill-capability-matcher
  - Client-side workflow preview (no API calls during editing)
  - "Something else in mind" option for custom input on all questions
  - Dynamic sections generated based on description ambiguity
- **Reusable Input Components** - New input primitives in `components/inputs/`
  - `TextInput` - Text input with cursor navigation and arrow key support
  - `SelectInput` - Single-select with arrow keys and "Other" option
  - `MultiSelectInput` - Multi-select with space toggle
- **Wizard Component Suite** - Build wizard components in `components/wizard/`
  - `TabBar` - Section navigation with completion indicators
  - `QuestionCard` - Question renderer with inference markers
  - `SectionView` - Section content with question display
  - `ReviewPanel` - Summary view with live workflow preview
  - `preview-builder.ts` - Client-side workflow generation from answers
  - `skill-analyzer.ts` - AI analysis integration
- **Unified Agent Logger** - Debug logging utility in `utils/agent-logger.ts`
  - `LOOPLIA_DEBUG=1` environment variable to enable logging
  - JSONL log format at `~/.looplia/logs/{context}/`
  - Streaming event logging wrapper for build wizard
- **Unit Tests for Wizard** - 49 tests for wizard components
  - `preview-builder.test.ts` - 23 tests for workflow preview generation
  - `skill-analyzer.test.ts` - 26 tests for question parsing/normalization

### Changed

- **skill-capability-matcher** - Extended to return clarifications schema
  - New `clarificationNeeded` and `clarifications` fields in output
  - Question types: `single-select`, `multi-select`, `text`
  - `goalId` linking recommendations to user-selected goals
  - `inferred: true` marker for AI-detected options with `reason` explanation
- **Build Command** - Uses wizard in interactive mode
  - `looplia build` opens interactive wizard
  - `looplia build "desc"` opens wizard with pre-filled description
  - `--no-interactive` flag for batch mode (unchanged behavior)
  - `--mock` flag for testing without API calls
- **Component Architecture** - Wizard components in dedicated folder
  - Moved from `build/` to `wizard/` folder (avoids .gitignore conflicts)
  - Separated `render.tsx` from barrel file for proper exports

### Documentation

- **BUILD-SYSTEM.md** - New document explaining slash command vs wizard modes
- **DESIGN-0.6.4.md** - Complete specification for Interactive Build Wizard

### Fixed

- Template variable backslash typo in `preview-builder.ts`
- Generator error handling in `generating-panel.tsx` - added try-catch wrapper
- Tab key conflict between wizard and TabBar components
- Answer validation before section completion in wizard
- Memoized `buildPreview` in `review-panel.tsx` to prevent unnecessary recalculation

## [0.6.3] - 2025-12-25

### Added

- **Input-Less Workflows** - Workflows can now run without `--file` if first step uses input-less capable skill
  - `isInputlessWorkflow()` function validates workflow supports input-less execution
  - `search` skill as first input-less capable skill
  - Automatic detection at runtime before sandbox creation
- **Web-Capable Skills** - Skills can now perform web searches and fetch URLs
  - `WebSearch` and `WebFetch` added to `allowedTools` in skill-executor
  - Enables real-time data fetching from web sources
- **Search Skill** - New autonomous data fetching skill (`plugins/looplia-core/skills/search/`)
  - Uses WebSearch for queries and WebFetch for URL content
  - Haiku model for cost-effective web operations
  - Input-less capable (no input file required)
- **Named Inputs (CLI)** - `--input name=value` syntax for multi-input workflows
  - Support for multiple inputs: `--input video1=v1.md --input video2=v2.md`
  - Inline JSON support: `--input config='{"key":"value"}'`
  - Duplicate input name detection with clear error messages

### Changed

- **Workflow Parser** - Added `INPUTLESS_CAPABLE_SKILLS` constant for input-less validation
  - `validateStep()` now allows missing input for input-less capable skills
  - `validateInputReferences()` validates `${{ inputs.name }}` references
- **Run Command** - Refactored for better maintainability
  - Extracted helper functions to reduce cognitive complexity
  - Switch statement in argument parsing for clarity
  - `isJsonValue()` now validates JSON by parsing (prevents `{production}.json` as JSON)
  - Sandbox ID always uses workflow ID for consistent naming

### Fixed

- **isJsonValue Edge Case** - File paths like `{production}.json` no longer incorrectly detected as JSON
- **Duplicate Input Names** - Now throws clear error instead of silent overwrite
- **Sandbox ID Generation** - Always uses workflow ID instead of first input name
- **CI Test Error Message** - Updated to expect `--input` option in error message

### Documentation

- **DESIGN-0.6.3.md** - Complete specification for Flexible Input System
- **Updated workflow-executor skill** - Documents input-less step handling
- **Updated workflow-schema-composer skill** - Documents input-less workflow generation

## [0.6.2] - 2025-12-22

### Added

- **Programmatic Agent Configuration** - SDK-based agent config with explicit model enforcement
  - `skill-executor` agent defined in `query-executor.ts` with haiku model
  - Multi-layered output enforcement (agent instructions + orchestrator + hooks + SDK)
  - Removes filesystem ambiguity for agent definitions
- **Build Command Test Suite** - Comprehensive 5-level test pyramid
  - L1: Unit tests for parseArgs, buildPrompt, validateEnvironment (27 tests)
  - L2: Script tests for plugin-registry-scanner (25 tests)
  - L3: Integration tests with mock executor (16 tests)
  - L4: Docker E2E tests in CI workflow
  - L5: Snapshot tests for mock mode (3 tests)
- **Progressive Disclosure Architecture** - Layered context for agent instructions
  - CLAUDE.md (~100 lines) routes commands to skills
  - Commands (~50-70 lines) reference skill SKILL.md files
  - Skills contain full implementation details
  - Documented in AGENTIC_CONCEPT_1.0.md

### Changed

- **Domain Type Cleanup** - Removed legacy domain types
  - Removed: `Summary`, `Ideas`, `WritingKit`, `Pipeline` types
  - Removed: Mock implementations and legacy validation schemas
  - Simplified: `packages/core/src/domain/` to workflow types only
- **CLAUDE.md Redesign** - Reduced from 395 to 98 lines
  - Delegates orchestration to workflow-executor skill
  - Explicit tool usage rules (no subagents for file operations)
  - Commands reference skills for implementation details
- **Command Simplification** - Applied Progressive Disclosure pattern
  - `run.md`: Reduced from 84 to 50 lines
  - `build.md`: Reduced from 200 to 71 lines

### Fixed

- **WorkflowStep Type Mismatch** - Added `skill` and `mission` fields to type
- **Workflow Parser** - Now handles v0.6.1 skill/mission syntax
- **Empty contentId** - Build command now generates UUID for session tracking
- **E2E Test Reliability** - Multiple fixes for Docker CI tests
  - Fixed grep direction (`-B5` → `-A5`) for JSON log parsing
  - Added yq raw output flag (`-r`) for proper number handling
  - Fixed frontmatter extraction to handle embedded YAML examples
  - Fixed array length counting with proper yq syntax

## [0.6.1] - 2025-12-21

### Added

- **Skills-First Architecture** - Major paradigm shift from agents to skills
  - `skill:` + `mission:` replaces `run: agents/{name}` in workflow steps
  - Universal `skill-executor` subagent for all workflow steps
  - Skills as first-class citizens with SKILL.md definitions
- **Builder Skills** - AI-assisted workflow generation
  - `plugin-registry-scanner`: Deterministic script to discover available skills
  - `skill-capability-matcher`: LLM-based matching of requirements to skills
  - `workflow-schema-composer`: LLM-based workflow YAML generation
- **Build Command** - New `looplia build` CLI command
  - Natural language workflow creation: `looplia build "summarize articles"`
  - Mock mode for testing: `--mock` flag
  - Batch mode for CI: `--no-interactive` flag
- **Variable Substitution** - GitHub Actions-like syntax
  - `${{ sandbox }}` for sandbox path
  - `${{ steps.X.output }}` for step output references

### Changed

- **Subagent Invocation** - Deterministic mapping from workflow to Task tool
  - All steps use `subagent_type: "skill-executor"` (no custom types)
  - Removed: `content-analyzer`, `idea-generator`, `writing-kit-builder` subagent types
- **Workflow Schema** - Breaking change from v0.6.0 format
  - `run: agents/{name}` → `skill: {skill-name}` + `mission: {description}`
  - Backward compatibility: `run:` still parsed but deprecated

### Removed

- **Legacy Agents** - Thin wrapper agents migrated to skills
  - `agents/content-analyzer.md` → `skills/media-reviewer/SKILL.md`
  - `agents/idea-generator.md` → `skills/idea-synthesis/SKILL.md`
  - `agents/writing-kit-builder.md` → `skills/writing-kit-assembler/SKILL.md`

### Documentation

- **DESIGN-0.6.1.md** - Skills-first architecture design
- **CLEANUP-0.6.1.md** - Migration and cleanup plan
- **BUILD-COMMAND-TESTS.md** - Test pyramid documentation

## [0.6.0] - 2025-12-20

### Added

- **Steps-Based Workflow Schema** - GitHub Actions-inspired workflow format
  - `steps:` array replaces `outputs:` object for explicit ordering
  - `run: agents/{name}` action-oriented syntax
  - `needs:` dependency specification (replaces `requires:`)
  - `${{ sandbox }}` and `${{ steps.X.output }}` variable substitution
- **Deterministic Subagent Invocation** - Explicit mapping from workflow to Task tool
  - `run: agents/content-analyzer` → `subagent_type: "content-analyzer"`
  - Visual prohibition against `general-purpose` fallback in CLAUDE.md
  - Mapping table in CLAUDE.md for all agent types
- **Semantic Validation in Hooks** - Full validation integrated into hook system
  - `post-write-validate.sh` now calls `validate.ts` with criteria
  - Blocks writes that fail semantic validation (not just JSON syntax)
  - Hook handles validation automatically; skill for manual retry only

### Changed

- **Workflow Schema** - Breaking change from v0.5.x format
  - `outputs:` (object) → `steps:` (array)
  - `agent:` → `run: agents/{name}`
  - `requires:` → `needs:`
  - `artifact:` → `output:`
  - Implicit paths → `${{ }}` explicit syntax
- **validation.json Schema** - Uses `steps` instead of `outputs`
  - `.outputs[$art]` → `.steps[$art]` in all hooks
  - Updated `post-write-validate.sh`, `stop-guard.sh`, `compact-inject-state.sh`
- **workflow-validator Skill** - Now primarily for manual retry/debugging
  - Automatic validation handled by PostToolUse hook
  - Skill documentation updated to reflect new role

### Documentation

- **DESIGN-0.6.0.md** - New architecture document for steps-based schema
- **CONTEXT-INJECTION.md** - Updated to v0.6.0 workflow format
- **docs/README.md** - Updated to v0.6.0 with new concepts
- **workflow-executor/SKILL.md** - Updated execution protocol
- **workflow-validator/SKILL.md** - Updated for hook-based validation

## [0.5.2] - 2025-12-18

### Added

- **Sandbox Folder Architecture** - Isolated execution environments for each workflow run
  - New folder structure: `sandbox/{sandbox-id}/inputs/`, `outputs/`, `logs/`
  - Sandbox ID format: `{slug}-{YYYY-MM-DD}-{random4chars}`
  - CLI creates sandbox folder when `--file` is provided
  - Content copied to `inputs/content.md`, artifacts written to `outputs/`
  - Logs written to `logs/` subdirectory
- **Two-Plugin Architecture** - Separation of infrastructure and domain concerns
  - `looplia-core` plugin: workflow engine, validation, `/run` command
  - `looplia-writer` plugin: writing-kit workflow, content analysis agents
- **Hook-Based Workflow Validator** - Claude Code hooks for workflow integrity
  - `PostToolUse:Write` hook for auto-validation of artifacts
  - `Stop` hook to guard workflow completion
  - `SessionStart:compact` hook to re-inject sandbox state
- **PR Checklist** - `docs/PR_CHECKLIST.md` for documentation and CI/CD alignment
  - Checklist for updating README, docs, GLOSSARY, TEST_PLAN
  - CI/CD verification steps
  - Version consistency checks

### Changed

- **Workspace Structure** - Migrated from `contentItem/` to `sandbox/` folder
  - `contentItem/{session-id}/` → `sandbox/{sandbox-id}/`
  - Flat structure → Organized `inputs/`, `outputs/`, `logs/` subdirectories
  - `validation.json` now at sandbox root level
- **CI/CD Updates** - Updated Docker E2E tests for sandbox architecture
  - `.github/workflows/docker-e2e.yml` uses sandbox paths
  - `scripts/docker-e2e.sh` updated to v0.5.2

### Documentation

- **DESIGN-0.5.2.md** - Two-plugin architecture design
- **README.md** - Updated with sandbox architecture section
- **docs/README.md** - Added sandbox folder architecture, updated quick links
- **GLOSSARY.md** - Added Sandbox, Sandbox-ID terms; deprecated contentItem
- **TEST_PLAN-0.5.md** - Updated all paths to sandbox folder structure
- **PR_CHECKLIST.md** - New checklist for documentation and CI/CD alignment

## [0.5.1] - 2025-12-17

### Added

- **Workflow-as-Markdown** - Single-file workflow definitions with YAML frontmatter
  - `workflows/*.md` format with `outputs`, `agents`, `validation` in frontmatter
  - Markdown body for custom instructions
  - Replaces Pipeline-as-Configuration YAML files
- **Custom Subagents** - Task tool with custom `subagent_type` parameter
  - Agent definitions in `.claude/agents/*.md`
  - Custom types: `content-analyzer`, `idea-generator`, `writing-kit-builder`
  - SDK discovers agents via `settingSources: ["project"]` configuration
- **Skills Auto-Loading** - Automatic skill loading via `skills:` frontmatter
  - Agent definitions specify required skills in frontmatter
  - Skills loaded at subagent invocation time
  - Progressive disclosure model for skill availability
- **Validation-Driven Completion** - Deterministic script-based output validation
  - `validation.json` tracks validation state per output
  - `workflow-validator` skill with `validate.ts` script
  - Replaces binary "done" status with validated/not-validated state
- **Log Verification Script** - `scripts/verify-workflow-log.sh`
  - Automated verification of subagent_type usage
  - Checks Task tool and Skill tool invocations
  - Validates workflow execution matches design

### Changed

- **SDK Configuration** - Added `settingSources: ["project"]` for agent/skill discovery
- **Workspace Structure** - Reorganized for Workflow-as-Markdown
  - `workflows/` directory for workflow definitions
  - `validation.json` replaces `session.json` for state tracking
- **Smart Continuation** - Now uses validation state instead of binary done status
  - Resume via `validated: true` flag + artifact existence check

### Documentation

- **AGENTIC_CONCEPT-0.4.md** - New agent system design document
  - Workflow-as-Markdown architecture
  - Custom Subagents with Task tool
  - Skills Auto-Loading mechanism
  - Validation-Driven Completion flow
  - Execution Cycle and Call Stack concepts
- **TEST_PLAN-0.5.md** - Updated test strategy
  - Real API testing with `bun link` workflow
  - Log verification for subagent and skill execution
  - Automated verification script documentation
- **DESIGN-0.5.1.md** - Workflow-as-Markdown architecture design
- **SUBAGENTS.md** - Added to documentation references
- **README.md** - Updated for v0.5.1 with new architecture
- **docs/README.md** - Updated document references and relationships

## [0.5.0] - 2025-12-12

### Added

- **Pipeline-as-Configuration** - Declarative YAML workflow definitions
  - `PipelineDefinition` and `PipelineOutput` types in `packages/core/src/domain/pipeline.ts`
  - `PipelineDefinitionSchema` and `PipelineOutputSchema` for validation
  - Default pipeline: `plugins/looplia-writer/pipelines/writing-kit.yaml`
- **Session Manifest System** - New `session.json` file tracks step completion status
  - `SessionManifest` type in `packages/core/src/domain/session.ts`
  - Minimal design: binary "done" status per step, no hashes
- **CLI Display Configuration** - New `apps/cli/src/config/display-config.ts`
  - `DisplayConfig` type moved from core to CLI layer
  - `getDisplayConfig(commandName)` lookup function

### Changed

- **CLI Simplification** - Streamlined to three commands: `init`, `run`, `config`
  - `bootstrap` renamed to `init` (standard CLI convention)
  - `kit` renamed to `run` (generic pipeline executor)
  - Version bumped to 0.5.0
- **Smart Continuation** - Now uses manifest-based state tracking
  - Agent reads `session.json` to check which steps are "done"
  - Skips steps marked done AND with artifact file present
  - Agent manages manifest updates (agent-first philosophy)
- **CommandDefinition** - Removed `displayConfig` property (moved to CLI layer)
- **Prompt Templates** - Updated with pipeline-as-configuration approach

### Removed

- `summarize` command from CLI (consolidated into `run` pipeline)
- `summarizeCommand` export from `@looplia-core/core`
- `DisplayConfig` export from `@looplia-core/core` (moved to CLI layer)
- `displayConfig` property from `CommandDefinition` type

### Documentation

- **AGENTIC_CONCEPT-0.3.md** - New agent system design document
  - Added Pipeline-as-Configuration section
  - Updated workspace structure with `pipelines/` and `session.json`
  - Updated Smart Continuation for manifest-based approach
- **TEST_PLAN-0.3.md** - Updated test plan for v0.5.0
  - Updated CLI command references (`init`, `run`, `config`)
  - Added Pipeline/SessionManifest validation test examples
- **GLOSSARY.md** - Updated to v0.5.0 with new terms
  - Added `SessionManifest`, `StepName`, `PipelineDefinition`
  - Updated `DisplayConfig` location to CLI layer
- **README.md** - Updated for v0.5.0
  - Updated "How It Works" diagram with new CLI commands
  - Updated Quick Start, CLI Commands, and Session Management sections
- **docs/README.md** - Updated document references to v0.3 versions

### Design Decisions

The following were considered but **intentionally deferred** to v0.6+:
- Content hash verification (adds complexity without proven need)
- Intermediate artifact validation (final output validation suffices)
- Provider-side manifest reconciliation (contradicts agent-first philosophy)
- Tool/path safety policies (security hardening is separate concern)
- Plugin compatibility versioning (only one plugin exists)

## [0.4.0] - 2025-12-12

### Added

- **CommandDefinition<T> Abstraction** - Core abstraction for defining commands with type-safe outputs
  - Generic output type parameter for schema validation
  - `promptTemplate` function for minimal prompt generation
  - `outputSchema` for Zod-based output validation
- **Command Registry** - Central registry for command definitions
  - `registerCommand()`, `getCommand()`, `hasCommand()`, `getCommandNames()`
- **Streaming Event System** - 12 event types for real-time TUI updates
  - `PromptEvent`, `SessionStartEvent`, `TextEvent`, `TextDeltaEvent`
  - `ThinkingEvent`, `ThinkingDeltaEvent`, `ToolStartEvent`, `ToolEndEvent`
  - `ProgressEvent`, `UsageEvent`, `ErrorEvent`, `CompleteEvent`
- **Ink/React TUI** - Modern terminal UI with streaming support
  - `streaming-query-ui.tsx` main container
  - `agent-tree.tsx` for agent hierarchy display
  - `activity-log.tsx` for tool activity tracking
  - `progress-bar.tsx` and `token-stats.tsx`
- **LoopliaRuntime** - Unified runtime class for command execution
- **SessionManager** - Content session lifecycle management
- **SDK Message Transformer** - Converts Claude Agent SDK messages to StreamingEvent

### Changed

- **Architecture** - Migrated to Clean Architecture with clear layer separation
  - CLI layer (`apps/cli/`) for UI and orchestration
  - Core layer (`packages/core/`) for domain and commands
  - Provider layer (`packages/provider/`) for SDK integration
- **Command Complexity** - Reduced from ~350 lines to ~30 lines per command
- **One Command = One Prompt** - Each CLI command maps to single minimal prompt

### Fixed

- Missing ink/react dependencies in Docker package files (#13)

## [0.3.3] - 2025-12-09

### Added

- **QueryLogger** - Debug logging with unique log files per query
- **Docker Support** - Containerized execution environment
- **E2E Test Infrastructure** - End-to-end testing with Docker
- **Multi-source E2E Tests** - YouTube VTT/SRT/JSON format testing (#9)

### Fixed

- Use ANTHROPIC_API_KEY secret for Docker E2E tests (#8)

## [0.3.2] - 2025-12-08

### Added

- **Smart Continuation** - Agent-controlled flow that skips completed steps
- **Session Management** - Persistent sessions with content tracking
- Session-ID format: `{title-slug}-{timestamp}-{random}`

## [0.3.1] - 2025-12-07

### Added

- **True Agentic Architecture** - Full agentic execution via Claude Agent SDK
- **Subagent System** - content-analyzer, idea-generator, writing-kit-builder
- **Skills System** - media-reviewer, content-documenter, user-profile-reader, writing-enhancer, id-generator
- **Plugin Architecture** - Markdown-based agent/skill definitions
- **Workspace Bootstrap** - Auto-deployment of plugins to `~/.looplia/`

### Changed

- Provider layer now uses `permissionMode: "bypassPermissions"` for agent autonomy
- Agents invoke subagents via Task tool instead of hardcoded orchestration

## [0.3.0] - 2025-12-06

### Added

- **Agent-Centric Architecture** - Moved orchestration from TypeScript to agents
- Initial CLAUDE.md instructions file
- Agent markdown files in plugins directory

## [0.2.0] - 2025-12-05

### Added

- **Provider Architecture** - Port interfaces with adapter implementations
- `SummarizerProvider`, `IdeaProvider`, `OutlineProvider` interfaces
- Mock adapters for testing

### Changed

- Domain model refinements for ContentSummary and WritingKit

## [0.1.0] - 2025-12-04

### Added

- Initial CLI implementation with `kit` and `summarize` commands
- Core domain types: `ContentItem`, `ContentSummary`, `WritingKit`, `WritingIdeas`
- Basic test suite
- GitHub Actions CI integration

---

[Unreleased]: https://github.com/memorysaver/looplia-core/compare/v0.7.1...HEAD
[0.7.1]: https://github.com/memorysaver/looplia-core/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/memorysaver/looplia-core/compare/v0.6.10...v0.7.0
[0.6.10]: https://github.com/memorysaver/looplia-core/compare/v0.6.9...v0.6.10
[0.6.9]: https://github.com/memorysaver/looplia-core/compare/v0.6.8...v0.6.9
[0.6.8]: https://github.com/memorysaver/looplia-core/compare/v0.6.7...v0.6.8
[0.6.7]: https://github.com/memorysaver/looplia-core/compare/v0.6.6...v0.6.7
[0.6.6]: https://github.com/memorysaver/looplia-core/compare/v0.6.5...v0.6.6
[0.6.5]: https://github.com/memorysaver/looplia-core/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/memorysaver/looplia-core/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/memorysaver/looplia-core/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/memorysaver/looplia-core/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/memorysaver/looplia-core/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/memorysaver/looplia-core/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/memorysaver/looplia-core/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/memorysaver/looplia-core/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/memorysaver/looplia-core/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/memorysaver/looplia-core/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/memorysaver/looplia-core/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/memorysaver/looplia-core/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/memorysaver/looplia-core/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/memorysaver/looplia-core/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/memorysaver/looplia-core/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/memorysaver/looplia-core/releases/tag/v0.1.0
