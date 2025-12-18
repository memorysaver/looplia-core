# Looplia-Core Glossary

> Ubiquitous Language Reference for Domain-Driven Design
>
> **Version:** 0.5.2
> **Last Updated:** 2025-12-18

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
The `~/.looplia/` directory. Persistent filesystem for sandboxes, plugins, and configuration.

```
~/.looplia/
├── CLAUDE.md           # Main agent instructions
├── user-profile.json   # User preferences
├── sandbox/            # Sandbox storage (v0.5.2)
│   └── {sandbox-id}/
│       ├── inputs/
│       │   └── content.md    # Input content (copied from --file)
│       ├── outputs/
│       │   ├── summary.json    # ContentSummary
│       │   ├── ideas.json      # WritingIdeas
│       │   └── writing-kit.json # WritingKit (final)
│       ├── logs/
│       │   └── query-*.log     # Session logs
│       └── validation.json     # Validation state
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

### Sandbox (v0.5.2)
An isolated execution environment for a single workflow run. Contains all input, output, and log files.

**Structure:**
```
sandbox/{sandbox-id}/
├── inputs/content.md      # Copied from --file
├── outputs/*.json         # Generated artifacts
├── logs/*.log             # Session logs
└── validation.json        # Validation state tracking
```

**Benefits:**
- **Isolation**: Each run is self-contained
- **Resumable**: Use `--sandbox-id` to continue from last validated step
- **Auditable**: Full logs preserved for debugging

### Sandbox-ID (v0.5.2)
Unique identifier for a sandbox. Format: `{slug}-{YYYY-MM-DD}-{random4chars}`

**Examples:**
- `my-article-2025-12-18-xk7m`
- `ai-healthcare-2025-12-18-ab12`

**Generation:**
1. Extract slug from filename (lowercase, alphanumeric, hyphens)
2. Add current date in ISO format
3. Append 4 random alphanumeric characters

### Session (deprecated v0.5.2)
Previous term for what is now called a "Sandbox". See **Sandbox**.

### contentItem Folder (deprecated v0.5.2)
Previous folder structure replaced by `sandbox/` in v0.5.2. See **Sandbox**.

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

## 11. Workflow System (v0.5.1)

### Workflow
A configuration-driven task orchestration unit. Replaces "Pipeline" terminology from v0.5.0.

**v0.5.0:** `pipelines/*.yaml` (YAML only)
**v0.5.1:** `workflows/*.md` (YAML frontmatter + markdown instructions)

### Workflow.md
A single markdown file defining a complete workflow:
- **YAML frontmatter**: Declarative output definitions with validation criteria
- **Markdown body**: Custom instructions for this specific workflow

**Location:** `~/.looplia/workflows/{workflow-id}.md`

### WorkflowDefinition
**Type:** `packages/core/src/domain/workflow.ts`

Complete workflow definition parsed from YAML frontmatter.

```typescript
type WorkflowDefinition = {
  name: string;           // Unique workflow identifier
  description: string;    // Human-readable description
  outputs: Record<string, WorkflowOutput>;
};
```

### WorkflowOutput
**Type:** `packages/core/src/domain/workflow.ts`

Single output configuration within a workflow.

| Field | Type | Description |
|-------|------|-------------|
| `artifact` | `string` | Output filename (e.g., `summary.json`) |
| `agent` | `string` | Subagent responsible for producing this output |
| `requires` | `string[]?` | Dependencies - other output names |
| `final` | `boolean?` | Marks this as the final output |
| `validate` | `ValidationCriteria?` | Validation criteria |

### ValidationCriteria
**Type:** `packages/core/src/domain/workflow.ts`

Criteria for validating workflow outputs. Used by the workflow-validator skill.

| Field | Type | Description |
|-------|------|-------------|
| `required_fields` | `string[]?` | Required top-level fields |
| `min_quotes` | `number?` | Minimum number of quotes |
| `min_key_points` | `number?` | Minimum key points |
| `min_outline_sections` | `number?` | Minimum outline sections |
| `has_hooks` | `boolean?` | Must have hooks array |

Extensible with custom keys for workflow-specific validation.

### validation.json (v0.5.2)
**Location:** `sandbox/{sandbox-id}/validation.json`

Generated from workflow frontmatter. Tracks validation state per output.

```json
{
  "workflow": "writing-kit",
  "sandboxId": "my-article-2025-12-18-xk7m",
  "createdAt": "2025-12-18T10:30:00Z",
  "outputs": {
    "summary": {
      "artifact": "outputs/summary.json",
      "criteria": { "required_fields": [...], "min_quotes": 3 },
      "validated": true
    },
    "ideas": {
      "artifact": "outputs/ideas.json",
      "criteria": { "required_fields": [...], "has_hooks": true },
      "validated": true
    },
    "writing-kit": {
      "artifact": "outputs/writing-kit.json",
      "criteria": { "required_fields": [...], "has_hooks": true },
      "validated": false
    }
  }
}
```

**v0.5.2 Changes:**
- Location changed from `contentItem/{id}/` to `sandbox/{id}/`
- Added `sandboxId` and `createdAt` fields
- Artifact paths now relative to sandbox (e.g., `outputs/summary.json`)

### workflow-validator Skill
**Location:** `.claude/skills/workflow-validator/`

New skill in v0.5.1 for validating workflow outputs against criteria.

**Structure:**
```
workflow-validator/
├── SKILL.md              # Level 2: Instructions
└── scripts/
    └── validate.ts       # Level 3: Deterministic script
```

**Progressive Disclosure:**
- Level 1 (always): Skill metadata (~100 tokens)
- Level 2 (on use): SKILL.md instructions (<5k tokens)
- Level 3 (on use): Script execution (0 LLM tokens)

The validation script runs **outside the LLM context**, providing deterministic validation without consuming tokens.

### Generic Workflow Interpreter
**v0.5.1 Concept**

CLAUDE.md becomes a generic interpreter that can execute ANY workflow defined in `workflows/*.md`. It no longer contains workflow-specific instructions.

**Key Behaviors:**
1. Read workflow.md (frontmatter + body)
2. Read validation.json for state
3. Execute outputs in dependency order
4. Validate each output using workflow-validator skill
5. Return final artifact when validation passes

### Validation-Driven Completion
**v0.5.1 Pattern**

A step is complete when its output **passes validation**, not when it's marked "done".

**v0.5.0:** Status-based (`steps.analyzing === "done"`)
**v0.5.1:** Validation-based (`outputs.summary.validated === true` + criteria checks pass)

---

## 12. Plugin System (v0.5.2)

### Two-Plugin Architecture
**v0.5.2 Concept**

Looplia-Core separates functionality into two Claude Code plugins:

| Plugin | Type | Purpose |
|--------|------|---------|
| **looplia-core** | Infrastructure | Workflow engine, validation, slash commands |
| **looplia-writer** | Domain | Writing-kit workflow, content analysis agents |

**Benefits:**
- Infrastructure reusable across domains
- Domain plugins installable independently
- Clear separation of concerns

### looplia-core Plugin
**Location:** `plugins/looplia-core/`

Infrastructure plugin providing workflow execution capabilities.

**Components:**
- `commands/run.md` - `/run` slash command
- `commands/build-workflow.md` - `/build-workflow` slash command
- `commands/list-workflows.md` - `/list-workflows` slash command
- `skills/workflow-executor/` - Workflow interpretation skill
- `skills/workflow-validator/` - Output validation skill
- `hooks/hooks.json` - Lifecycle event handlers
- `CLAUDE.md` - Generic workflow interpreter

### looplia-writer Plugin
**Location:** `plugins/looplia-writer/`

Domain plugin for writing-related workflows.

**Components:**
- `agents/content-analyzer.md` - Deep content analysis
- `agents/idea-generator.md` - Creative idea generation
- `agents/writing-kit-builder.md` - Final kit assembly
- `skills/media-reviewer/` - Media content analysis
- `skills/content-documenter/` - Structured output generation
- `skills/user-profile-reader/` - User preference loading
- `workflows/writing-kit.md` - Writing workflow definition

### Slash Command
**v0.5.2 Concept**

Claude Code slash commands defined in `commands/*.md`. Primary entry point for user interaction.

**Structure:**
```markdown
---
description: Short description for /help
---

# Command Title

## Usage
/command-name <args> [--flags]

## Implementation
How the agent should execute...
```

**Available Commands (looplia-core):**
| Command | Description |
|---------|-------------|
| `/run <workflow-id> --file <path>` | Execute a workflow |
| `/build-workflow <name>` | Scaffold new workflow |
| `/list-workflows` | List available workflows |

### workflow-executor Skill
**Location:** `plugins/looplia-core/skills/workflow-executor/`

Core skill that interprets workflow.md files and orchestrates execution.

**Capabilities:**
1. Parse workflow definition (YAML frontmatter + markdown)
2. Resolve output dependencies (topological sort)
3. Invoke subagents via Task tool
4. Track validation state via validation.json
5. Resume from last validated state

### Plugin Manifest
**Location:** `.claude-plugin/plugin.json`

JSON file describing plugin metadata.

```json
{
  "name": "plugin-name",
  "version": "0.5.2",
  "description": "What this plugin does",
  "author": { "name": "Author Name" },
  "keywords": ["tag1", "tag2"],
  "dependencies": ["other-plugin"]
}
```

### Infrastructure Plugin
A plugin providing foundational capabilities used by domain plugins. Example: looplia-core provides workflow execution.

### Domain Plugin
A plugin providing domain-specific functionality. Depends on infrastructure plugins. Example: looplia-writer provides writing workflow.

### Looplia Extension
The `workflows/` directory is a Looplia-specific extension to the Claude Code plugin model. Not part of standard Claude Code plugin spec.

**Standard Claude Code:**
- `commands/`, `agents/`, `skills/`, `hooks/`

**Looplia Extension:**
- `workflows/` - Workflow-as-Markdown definitions

### Hooks
**Location:** `hooks/hooks.json`

Event handlers for workflow lifecycle events.

**v0.5.2 Hooks (minimal logging):**
```json
{
  "hooks": {
    "SubagentStart": [...],
    "SubagentStop": [...]
  }
}
```

---

## Quick Reference: File Locations

| Concept | Location |
|---------|----------|
| Domain entities | `packages/core/src/domain/` |
| Workflow types | `packages/core/src/domain/workflow.ts` |
| Workflow parser | `packages/core/src/domain/workflow-parser.ts` |
| Command framework | `packages/core/src/commands/` |
| Workflow command | `packages/core/src/commands/workflow.ts` |
| Port interfaces | `packages/core/src/ports/` |
| Services | `packages/core/src/services/` |
| Mock adapters | `packages/core/src/adapters/mock/` |
| Provider (SDK) | `packages/provider/src/claude-agent-sdk/` |
| CLI commands | `apps/cli/src/commands/` |
| Display config | `apps/cli/src/config/display-config.ts` |
| Runtime | `apps/cli/src/runtime/` |
| TUI components | `apps/cli/src/components/` |
| **looplia-core plugin** | `plugins/looplia-core/` (v0.5.2) |
| **looplia-writer plugin** | `plugins/looplia-writer/` (v0.5.2) |
| Slash commands | `plugins/looplia-core/commands/` (v0.5.2) |
| workflow-executor skill | `plugins/looplia-core/skills/workflow-executor/` (v0.5.2) |
| workflow-validator skill | `plugins/looplia-core/skills/workflow-validator/` (v0.5.2) |
| Writing workflows | `plugins/looplia-writer/workflows/` |
| Writing agents | `plugins/looplia-writer/agents/` |

### Workspace Structure (v0.5.2)

```
~/.looplia/
├── CLAUDE.md                    # From looplia-core
├── user-profile.json            # User preferences
├── commands/                    # From looplia-core (v0.5.2)
│   ├── run.md
│   ├── build-workflow.md
│   └── list-workflows.md
├── hooks/                       # From looplia-core (v0.5.2)
│   └── hooks.json
├── workflows/                   # From looplia-writer
│   └── writing-kit.md
├── .claude/
│   ├── agents/                  # From looplia-writer
│   │   ├── content-analyzer.md
│   │   ├── idea-generator.md
│   │   └── writing-kit-builder.md
│   └── skills/                  # From both plugins
│       ├── workflow-executor/   # looplia-core
│       ├── workflow-validator/  # looplia-core
│       ├── media-reviewer/      # looplia-writer
│       ├── content-documenter/  # looplia-writer
│       └── ...
└── sandbox/{sandbox-id}/        # v0.5.2 sandbox architecture
    ├── inputs/
    │   └── content.md           # Input content (copied from --file)
    ├── outputs/
    │   ├── summary.json         # Stage 1 output
    │   ├── ideas.json           # Stage 2 output
    │   └── writing-kit.json     # Stage 3 output (final)
    ├── logs/
    │   └── query-*.log          # Session logs
    └── validation.json          # Validation state
```

---

*This glossary should be updated when new terms are introduced or existing definitions change.*
