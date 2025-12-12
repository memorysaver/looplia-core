# Looplia-Core Glossary

> Ubiquitous Language Reference for Domain-Driven Design
>
> **Version:** 0.5.0
> **Last Updated:** 2025-12-12

This glossary defines the shared vocabulary used throughout Looplia-Core. Consistent terminology enables clear communication between code, documentation, and team discussions.

---

## 1. Core Domain Concepts

### ContentItem
**Type:** `packages/core/src/domain/content.ts`

Raw content to be processed. Contains source material with metadata for analysis.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `source` | `Source` | Origin metadata |
| `title` | `string` | Content title |
| `url` | `string` | Original URL |
| `publishedAt` | `string?` | ISO 8601 publication date |
| `rawText` | `string` | Raw text content (transcript, article body, etc.) |
| `metadata` | `ContentMetadata` | Additional metadata |

### ContentSummary
**Type:** `packages/core/src/domain/summary.ts`

Structured analysis of content with 15+ fields. Enhanced in v0.3 with documentary-style analysis.

**Core Fields (v0.1):**
- `headline` - One-sentence distilled insight (10-200 chars)
- `tldr` - 3-5 sentence summary
- `bullets` - Key points (1-10 items)
- `tags` - Topic tags (1-20)
- `sentiment` - `"positive"` | `"neutral"` | `"negative"`
- `category` - Content category
- `score` - `SummaryScore` with `relevanceToUser` (0-1)

**Enhanced Fields (v0.3):**
- `overview` - Rich 2-3 paragraph overview
- `keyThemes` - 3-7 main themes
- `detailedAnalysis` - Documentary-style breakdown
- `narrativeFlow` - How content progresses
- `coreIdeas` - `CoreIdea[]` with explanations
- `importantQuotes` - `Quote[]` with timestamps
- `context` - Background context
- `relatedConcepts` - Related topics
- `detectedSource` - Auto-detected source type

### WritingKit
**Type:** `packages/core/src/domain/writing-kit.ts`

Complete writing scaffold combining summary, ideas, and outline. The primary output of the `kit` command.

| Field | Type | Description |
|-------|------|-------------|
| `contentId` | `string` | Reference to source content |
| `source` | `WritingKitSource` | Simplified source reference |
| `summary` | `ContentSummary` | Full content summary |
| `ideas` | `WritingIdeas` | Creative writing ideas |
| `suggestedOutline` | `OutlineSection[]` | Article structure |
| `meta` | `WritingKitMeta` | Relevance and reading time |

### WritingIdeas
**Type:** `packages/core/src/domain/ideas.ts`

Creative expansion of summarized content into writing materials.

| Field | Type | Description |
|-------|------|-------------|
| `contentId` | `string` | Reference to source content |
| `hooks` | `WritingHook[]` | Opening hooks to capture attention |
| `angles` | `WritingAngle[]` | Narrative angles/perspectives |
| `questions` | `WritingQuestion[]` | Exploratory questions |

### UserProfile
**Type:** `packages/core/src/domain/user-profile.ts`

User preferences for personalization.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | `string` | User identifier |
| `topics` | `UserTopic[]` | Topics with interest levels (1-5) |
| `style` | `WritingStyle` | Writing preferences |
| `writingSamples` | `string[]?` | Example articles for voice matching |

### Source / SourceType
**Type:** `packages/core/src/domain/content.ts`

Content origin metadata.

- **SourceType:** `"rss"` | `"youtube"` | `"podcast"` | `"twitter"` | `"custom"`
- **Source:** Contains `id`, `type`, `label`, `url`, and optional `metadata`

### ContentMetadata
**Type:** `packages/core/src/domain/content.ts`

Well-known metadata fields: `language`, `durationSeconds`, `author`, `wordCount`, plus extensible key-value pairs.

---

## 2. Architecture Layers

### Clean Architecture
The architectural pattern used in Looplia-Core. Dependencies flow inward: outer layers depend on inner layers, never the reverse.

```
Outer → Inner
CLI → Provider → Core (Domain)
```

### Domain Layer
**Location:** `packages/core/src/domain/`

The innermost layer containing business entities and rules. Has **no external dependencies**.

Contains: `ContentItem`, `ContentSummary`, `WritingKit`, `WritingIdeas`, `UserProfile`, `ProviderResult`

### Ports Layer
**Location:** `packages/core/src/ports/`

Interface definitions that outer layers implement. Enables dependency inversion.

Contains: `SummarizerProvider`, `IdeaProvider`, `OutlineProvider`, `ScoringPolicy`

### Adapters Layer
**Location:** `packages/core/src/adapters/`, `packages/provider/`

Implementations of port interfaces. Can be swapped without affecting core logic.

Contains: Mock implementations for testing, Claude Agent SDK integration

### Services Layer
**Location:** `packages/core/src/services/`

Application orchestration logic that coordinates domain entities through ports.

Contains: `WritingKitEngine`, `SummarizationEngine`, `IdeaEngine`, `RankingEngine`

### Provider Layer
**Location:** `packages/provider/`

External system integration. Implements `AgentExecutor` interface using Claude Agent SDK.

### CLI Layer
**Location:** `apps/cli/`

Outermost layer. User interface, argument parsing, result rendering.

---

## 3. Command Framework

### CommandDefinition\<T\>
**Type:** `packages/core/src/commands/types.ts`

Core abstraction for defining commands. Everything needed to execute a command.

```typescript
type CommandDefinition<TOutput> = {
  name: string;                                       // Unique command name
  promptTemplate: (context: PromptContext) => string; // Generates prompt
  outputSchema: z.ZodType<TOutput>;                  // Zod validation schema
};
```

> **v0.5.0 Change:** `displayConfig` removed from CommandDefinition. Display configuration is now managed by CLI layer via `getDisplayConfig(commandName)`.

### CommandRegistry
**Location:** `packages/core/src/commands/registry.ts`

Central registry for all command definitions. Single source of truth.

Functions:
- `registerCommand<T>(definition)` - Register a command
- `getCommand<T>(name)` - Retrieve by name
- `hasCommand(name)` - Check existence
- `getCommandNames()` - List all commands
- `clearCommands()` - Clear (for testing)

### CommandResult\<T\>
**Type:** `packages/core/src/commands/types.ts`

Standardized result type for command execution.

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether execution succeeded |
| `data` | `T?` | Result data (if success) |
| `error` | `{type, message}?` | Error details (if failure) |
| `sessionId` | `string` | Session identifier |
| `usage` | `{inputTokens, outputTokens, totalCostUsd}?` | Token usage |

### PromptContext
**Type:** `packages/core/src/commands/types.ts`

Context passed to `promptTemplate` function.

| Field | Type | Description |
|-------|------|-------------|
| `contentId` | `string` | Content/Session ID |
| `contentPath` | `string` | Path relative to workspace |
| `workspace` | `string` | Workspace root path |

### DisplayConfig
**Type:** `apps/cli/src/config/display-config.ts` (moved from core in v0.5.0)

TUI display configuration for a command. Now lives in CLI layer for Clean Architecture purity.

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Box header title |
| `successMessage` | `string` | Message after completion |
| `sessionInfoFormat` | `string?` | Session info format (uses `{contentId}`) |
| `nextStep` | `{description, commandTemplate}?` | Follow-up command hint |

> **v0.5.0 Change:** Moved from `packages/core/` to `apps/cli/src/config/`. Use `getDisplayConfig(commandName)` to retrieve.

### promptTemplate
A function that generates the minimal prompt sent to the agent from a `PromptContext`. The prompt tells the agent **what** to accomplish, not **how**.

### outputSchema
A Zod schema that validates the structured output returned by the agent. Ensures type safety at runtime.

---

## 4. Agent System

### Main Agent
The orchestrator agent that receives the CLI prompt. Reads `CLAUDE.md` for instructions, checks session state, and invokes subagents.

**Key behaviors:**
- Reads `CLAUDE.md` from workspace
- Globs session folder to check existing files
- Invokes subagents via Task tool
- Returns final result via StructuredOutput

### Subagent
An autonomous specialist invoked by the Main Agent via the Task tool. Each subagent has focused expertise.

**Current subagents:**
| Name | File | Expertise |
|------|------|-----------|
| `content-analyzer` | `agents/content-analyzer.md` | Deep content analysis |
| `idea-generator` | `agents/idea-generator.md` | Creative writing ideation |
| `writing-kit-builder` | `agents/writing-kit-builder.md` | Outline creation and kit assembly |

### Skill
A focused capability invoked by subagents. Skills provide specialized expertise.

**Current skills:**
| Name | Purpose |
|------|---------|
| `media-reviewer` | 9-step deep content analysis |
| `content-documenter` | Structure all 15 summary fields |
| `user-profile-reader` | Relevance scoring based on user interests |
| `writing-enhancer` | Style personalization |
| `id-generator` | Session ID generation |

### Plugin
Markdown files that define agent behavior. Located in `plugins/looplia-writer/`.

- `README.md` → Deployed as `CLAUDE.md`
- `agents/*.md` → Subagent definitions
- `skills/*/SKILL.md` → Skill definitions

### Smart Continuation
Agent-controlled flow where the agent checks session state and skips completed steps.

**v0.5.0 (Manifest-based):**
The agent reads `session.json` to determine step states:
- Check `steps.analyzing.status === "completed"` → Skip content-analyzer
- Check `steps.generating_ideas.status === "completed"` → Skip idea-generator
- Check `steps.assembling_kit.status === "completed"` → Return directly
- If `sourceHash` changed → Restart from analyzing step

**v0.4.0 (File-based, deprecated):**
- Only `content.md` → Run full workflow
- `+ summary.json` → Skip content-analyzer
- `+ ideas.json` → Skip idea-generator
- `+ writing-kit.json` → Return directly

### One Command = One Prompt
Core principle: Every CLI command maps to exactly ONE minimal prompt to the SDK. The agent handles all orchestration.

---

## 5. Streaming & Events

### StreamingEvent
**Type:** `packages/core/src/commands/types.ts`

Union type of all streaming events. Provider yields these, CLI consumes them.

```typescript
type StreamingEvent =
  | PromptEvent | SessionStartEvent
  | TextEvent | TextDeltaEvent
  | ThinkingEvent | ThinkingDeltaEvent
  | ToolStartEvent | ToolEndEvent
  | ProgressEvent | UsageEvent
  | ErrorEvent | CompleteEvent;
```

### PromptEvent
Initial prompt sent to the agent.

```typescript
{ type: "prompt"; content: string; timestamp: number }
```

### SessionStartEvent
Session initialized with agent.

```typescript
{ type: "session_start"; sessionId: string; model: string; availableTools: string[]; timestamp: number }
```

### TextEvent / TextDeltaEvent
Agent text output (full or incremental).

```typescript
{ type: "text"; content: string; timestamp: number }
{ type: "text_delta"; text: string; timestamp: number }
```

### ThinkingEvent / ThinkingDeltaEvent
Agent reasoning (extended thinking mode).

```typescript
{ type: "thinking"; content: string; timestamp: number }
{ type: "thinking_delta"; thinking: string; timestamp: number }
```

### ToolStartEvent
Tool invocation started.

```typescript
{ type: "tool_start"; toolUseId: string; tool: string; input: { path?, skill?, pattern?, raw? }; timestamp: number }
```

### ToolEndEvent
Tool invocation completed.

```typescript
{ type: "tool_end"; toolUseId: string; tool: string; success: boolean; summary?: string; durationMs: number; timestamp: number }
```

### ProgressEvent
Pipeline step progress.

```typescript
{ type: "progress"; step: "initializing" | "analyzing" | "generating_ideas" | "building_outline" | "assembling_kit"; percent: number; message: string; timestamp: number }
```

### UsageEvent
Token usage update.

```typescript
{ type: "usage"; inputTokens: number; outputTokens: number; timestamp: number }
```

### ErrorEvent
Non-fatal error occurred.

```typescript
{ type: "error"; code: string; message: string; recoverable: boolean; timestamp: number }
```

### CompleteEvent\<T\>
Final result with metrics.

```typescript
{ type: "complete"; subtype: "success" | "error_max_turns" | "error_during_execution"; result: T; usage: { inputTokens, outputTokens, totalCostUsd }; metrics: { durationMs, durationApiMs?, numTurns }; sessionId: string; timestamp: number }
```

---

## 6. Runtime Concepts

### LoopliaRuntime
**Location:** `apps/cli/src/runtime/looplia-runtime.ts`

Main runtime class for CLI command execution. Orchestrates session management, command lookup, and execution dispatch.

**Key methods:**
- `executeCommand<T>(name, contentId, contentTitle)` - Execute by command name
- `executeKit(config)` - Kit workflow
- `executeSummarize(config)` - Summarize workflow

### ExecutionContext
Internal state for runtime execution.

| Field | Type | Description |
|-------|------|-------------|
| `workspace` | `string` | Absolute workspace path |
| `mode` | `"streaming"` \| `"batch"` | Execution mode |
| `mock` | `boolean` | Whether using mock providers |

### SessionManager
**Location:** `apps/cli/src/runtime/session-manager.ts`

Manages content session lifecycle: creation, loading, and file operations.

**Key methods:**
- `prepare({file?, sessionId?})` - Prepare content for execution
- `prepareFromFile(file)` - Create new session from file
- `getWorkspace()` - Get current workspace path

### AgentExecutor
**Type:** `packages/core/src/commands/types.ts`

Interface implemented by provider layer. Dependency inversion point.

```typescript
type AgentExecutor = {
  executeStreaming<T>(prompt, schema, options): AsyncGenerator<StreamingEvent, CommandResult<T>>;
  execute<T>(prompt, schema, options): Promise<CommandResult<T>>;
};
```

### ExecutorOptions
Options passed to AgentExecutor.

| Field | Type | Description |
|-------|------|-------------|
| `workspace` | `string` | Workspace path |
| `contentId` | `string` | Session tracking ID |

---

## 7. Provider Concepts

### Claude Agent SDK
Anthropic's agent framework for building autonomous agents. Looplia-Core uses this to execute prompts with tool access.

### SDK Message Types
Internal message types in Claude Agent SDK conversations:
- `system` - System prompt message
- `assistant` - Agent response
- `user` - User input (including tool results)
- `stream_event` - Real-time streaming event
- `result` - Final structured result

### Content Blocks
Types of content within messages:
- `text` - Plain text content
- `thinking` - Extended thinking content
- `tool_use` - Tool invocation (nested in assistant message)
- `tool_result` - Tool response (nested in user message)

**Important:** Tool calls are content blocks, not top-level messages.

### TransformContext
**Location:** `packages/provider/src/claude-agent-sdk/streaming/transformer.ts`

State maintained during SDK-to-StreamingEvent transformation. Tracks pending tools for correlation.

### ProgressTracker
**Location:** `packages/provider/src/claude-agent-sdk/streaming/progress-tracker.ts`

Infers progress from skill/tool invocations. Maps tool names to pipeline steps.

### QueryLogger
**Location:** `packages/provider/src/claude-agent-sdk/logger/`

Debug logging for agent queries. Creates unique log files per query for auditability.

---

## 8. Workspace & Session

### Workspace
The `~/.looplia/` directory. Persistent filesystem for sessions, plugins, and configuration.

```
~/.looplia/
├── CLAUDE.md           # Main agent instructions
├── user-profile.json   # User preferences
├── contentItem/        # Session storage
│   └── {session-id}/
│       ├── content.md      # Input content
│       ├── session.json    # Session manifest (v0.5.0)
│       ├── summary.json    # ContentSummary
│       ├── ideas.json      # WritingIdeas
│       ├── outline.json    # OutlineSection[]
│       └── writing-kit.json # WritingKit
└── .claude/            # Plugins (agents, skills)
```

### SessionManifest (v0.5.0)
**Type:** `packages/core/src/domain/session.ts`

Minimal manifest tracking step completion. Agent manages this file.

```typescript
type SessionManifest = {
  version: 1;
  contentId: string;
  updatedAt: string;
  steps: Partial<Record<StepName, "done">>;
};
```

**Design Decisions:**
- Binary "done" or absent (no `pending`/`in_progress` states)
- No content hashes (file timestamps suffice)
- Agent-managed (TypeScript only provides types)

### StepName (v0.5.0)
**Type:** `packages/core/src/domain/session.ts`

Named pipeline steps with artifact mappings:

| StepName | Artifact | Subagent |
|----------|----------|----------|
| `analyzing` | `summary.json` | content-analyzer |
| `generating_ideas` | `ideas.json` | idea-generator |
| `building_outline` | `outline.json` | writing-kit-builder |
| `assembling_kit` | `writing-kit.json` | writing-kit-builder |

**Note:** `writing-kit-builder` produces both `outline.json` and `writing-kit.json`. Both steps are marked done together.

### Session
A work session with unique ID. Contains all input/output files for one execution.

### Session-ID
Unique identifier for a session. Format: `{title-slug}-{timestamp}-{random}` (e.g., `article-2025-12-09-abc123`)

### contentItem Folder
Session file storage at `~/.looplia/contentItem/{session-id}/`.

Files:
- `content.md` - Input content
- `session.json` - Session manifest (v0.5.0)
- `summary.json` - From content-analyzer
- `ideas.json` - From idea-generator
- `outline.json` - From writing-kit-builder
- `writing-kit.json` - Final output
- `logs/` - Query logs

### CLAUDE.md
Main agent instructions deployed from `plugins/looplia-writer/README.md`. The "brain" of the system.

### user-profile.json
User preferences file with topics, style settings, and optional writing samples.

---

## 9. Result Patterns

### ProviderResult\<T\>
**Type:** `packages/core/src/domain/errors.ts`

Discriminated union for operation results. Success or error, never exceptions.

```typescript
type ProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: ProviderError };
```

**Helpers:**
- `ok<T>(data)` - Create success result
- `err<T>(error)` - Create error result

### ProviderError
Standardized error types across all providers:
- `rate_limit` - API rate limiting
- `unsupported_language` - Language not supported
- `content_moderation` - Content flagged
- `malformed_output` - Output validation failed
- `network_error` - Network failure
- `validation_error` - Input validation failed
- `unknown` - Unclassified error

### ProviderResultWithUsage
Result type that includes token usage metrics.

---

## 10. Writing Domain

### WritingHook
**Type:** `packages/core/src/domain/ideas.ts`

Attention-grabbing opening for an article.

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | The hook text |
| `type` | `HookType` | Why this hook works |

**HookType:** `"emotional"` | `"curiosity"` | `"controversy"` | `"statistic"` | `"story"`

### WritingAngle
**Type:** `packages/core/src/domain/ideas.ts`

Narrative perspective for structuring an article.

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Short angle title |
| `description` | `string` | Perspective description |
| `relevanceScore` | `number` | Relevance to user (0-1) |

### WritingQuestion
**Type:** `packages/core/src/domain/ideas.ts`

Exploratory question to address in writing.

| Field | Type | Description |
|-------|------|-------------|
| `question` | `string` | The question |
| `type` | `QuestionType` | Question category |

**QuestionType:** `"analytical"` | `"practical"` | `"philosophical"` | `"comparative"`

### OutlineSection
**Type:** `packages/core/src/domain/writing-kit.ts`

A section in the suggested article outline.

| Field | Type | Description |
|-------|------|-------------|
| `heading` | `string` | Section heading |
| `notes` | `string` | Writing notes |
| `estimatedWords` | `number?` | Target word count |

### CoreIdea
**Type:** `packages/core/src/domain/core-idea.ts`

A core concept with explanation and examples extracted from content.

### Quote
**Type:** `packages/core/src/domain/quote.ts`

Verbatim quote from content with optional timestamp (format: `[HH:MM:SS]`).

### SummaryScore
**Type:** `packages/core/src/domain/summary.ts`

Scoring metrics for content summary. Contains `relevanceToUser` (0-1).

### WritingStyle
**Type:** `packages/core/src/domain/user-profile.ts`

User's writing style preferences.

| Field | Type | Description |
|-------|------|-------------|
| `tone` | `ToneLevel` | Target audience level |
| `targetWordCount` | `number` | Target article length |
| `voice` | `VoiceType` | Narrative voice |

**ToneLevel:** `"beginner"` | `"intermediate"` | `"expert"` | `"mixed"`

**VoiceType:** `"first-person"` | `"third-person"` | `"instructional"`

### UserTopic
**Type:** `packages/core/src/domain/user-profile.ts`

A topic the user is interested in.

| Field | Type | Description |
|-------|------|-------------|
| `topic` | `string` | Topic name |
| `interestLevel` | `1-5` | Interest level (1=low, 5=high) |

---

## Quick Reference: File Locations

| Concept | Location |
|---------|----------|
| Domain entities | `packages/core/src/domain/` |
| Session manifest types | `packages/core/src/domain/session.ts` (v0.5.0) |
| Command framework | `packages/core/src/commands/` |
| Port interfaces | `packages/core/src/ports/` |
| Services | `packages/core/src/services/` |
| Mock adapters | `packages/core/src/adapters/mock/` |
| Provider (SDK) | `packages/provider/src/claude-agent-sdk/` |
| CLI commands | `apps/cli/src/commands/` |
| Display config | `apps/cli/src/config/display-config.ts` (v0.5.0) |
| Runtime | `apps/cli/src/runtime/` |
| TUI components | `apps/cli/src/components/` |
| Plugins | `plugins/looplia-writer/` |

---

*This glossary should be updated when new terms are introduced or existing definitions change.*
