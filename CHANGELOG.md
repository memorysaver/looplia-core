# Changelog

All notable changes to Looplia-Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Session Manifest System** - New `session.json` file tracks session lifecycle with step states, content hashes, and schema versions
  - `SessionManifest` type in `packages/core/src/domain/session.ts`
  - `SessionService` for manifest manipulation in `packages/core/src/services/session-service.ts`
  - `session-io.ts` for file operations in provider layer
  - Auto-migration for legacy sessions without manifest
- **Intermediate Artifact Validation** - Zod validation after each artifact write
  - `ArtifactValidation` service in `packages/core/src/services/artifact-validation.ts`
  - `ValidationInterceptor` in provider streaming layer
  - Enhanced `ErrorEvent` with `retryHint`, `validationErrors`, and `artifact` fields
- **CLI Display Configuration** - New `apps/cli/src/config/display-config.ts` for TUI presentation settings

### Changed

- **Smart Continuation** - Now uses manifest-based state tracking instead of file-existence checks
  - Agent reads `session.json` to determine step states
  - Detects source content changes via `sourceHash` comparison
  - More reliable continuation with validation hashes
- **CommandDefinition** - Removed `displayConfig` property (moved to CLI layer)
- **Prompt Templates** - Updated to instruct agent on manifest usage

### Removed

- `DisplayConfig` export from `@looplia-core/core` (moved to CLI layer)
- `displayConfig` property from `CommandDefinition` type

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

[Unreleased]: https://github.com/memorysaver/looplia-core/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/memorysaver/looplia-core/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/memorysaver/looplia-core/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/memorysaver/looplia-core/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/memorysaver/looplia-core/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/memorysaver/looplia-core/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/memorysaver/looplia-core/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/memorysaver/looplia-core/releases/tag/v0.1.0
