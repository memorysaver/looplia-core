# Changelog

All notable changes to Looplia-Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Changed

- **Domain Type Cleanup** - Removed legacy domain types
  - Removed: `Summary`, `Ideas`, `WritingKit`, `Pipeline` types
  - Removed: Mock implementations and legacy validation schemas
  - Simplified: `packages/core/src/domain/` to workflow types only

### Fixed

- **WorkflowStep Type Mismatch** - Added `skill` and `mission` fields to type
- **Workflow Parser** - Now handles v0.6.1 skill/mission syntax
- **Empty contentId** - Build command now generates UUID for session tracking

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

[Unreleased]: https://github.com/memorysaver/looplia-core/compare/v0.6.2...HEAD
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
