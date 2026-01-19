# Looplia-Core Architecture Design v0.4.0

> Clean Architecture Command Framework with Agentic Execution
>
> **Version:** 0.4.0
> **Date:** 2025-12-12
> **Related:** [GLOSSARY.md](./GLOSSARY.md) for ubiquitous language definitions

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Folder Design: CLI Package](#3-folder-design-cli-package)
4. [Folder Design: Core Package](#4-folder-design-core-package)
5. [Folder Design: Provider Package](#5-folder-design-provider-package)
6. [Agent System with Skills](#6-agent-system-with-skills)
7. [Streaming Event System](#7-streaming-event-system)
8. [Clean Architecture Mapping](#8-clean-architecture-mapping)
9. [Adding a New Command](#9-adding-a-new-command)

---

## 1. Executive Summary

### Evolution from v0.3.x to v0.4.0

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.3.2 | Agentic Architecture | One command = One prompt = One session |
| v0.3.3 | Operations | QueryLogger, Docker, bootstrap automation |
| v0.3.4.0 | User Experience | Streaming TUI with Ink/React |
| v0.3.4.0-v2 | Code Quality | LoopliaRuntime layer, complexity reduction |
| **v0.4.0** | **Clean Architecture** | **CommandDefinition<T> abstraction** |

### Core Innovation

The `CommandDefinition<T>` abstraction cleanly separates concerns:

```typescript
type CommandDefinition<TOutput> = {
  name: string;                              // Unique identifier
  displayConfig: DisplayConfig;              // TUI configuration
  promptTemplate: (ctx: PromptContext) => string;  // Generates prompt
  outputSchema: z.ZodType<TOutput>;         // Validates output
};
```

### Benefits Achieved

| Metric | Before (v0.3.4.0) | After (v0.4.0) |
|--------|-------------------|----------------|
| Command complexity | 25+ | ~5 |
| Lines per command | 350+ | ~30 |
| New command effort | ~350 lines | ~150 lines |
| Testability | Coupled | Fully isolated |

### Key Principles

1. **One Command = One Prompt** - CLI sends minimal prompt, agent handles orchestration
2. **Agent Makes Decisions** - Not hardcoded in TypeScript
3. **File-Based State** - Session state persisted in workspace
4. **Smart Continuation** - Agent checks existing files, skips completed steps
5. **Plugin-Driven Behavior** - Edit markdown to change behavior without code rebuild

---

## 2. Architecture Overview

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLI Layer (apps/cli/)                             │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  commands/  │──│  parsers/   │──│  runtime/   │──│ renderers/  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                               │                   │               │
│         │                          ┌────┴────┐              │               │
│         │                          │components│ (Ink/React) │               │
│         │                          └────┬────┘              │               │
└─────────┼───────────────────────────────┼───────────────────┼───────────────┘
          │                               │                   │
          │         AgentExecutor         │                   │
          │              │                │                   │
          ▼              ▼                ▼                   │
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Provider Layer (packages/provider/)                    │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────┐      │
│  │    executor.ts  │  │  streaming/                                 │      │
│  │  (AgentExecutor)│  │  ├─ query-executor.ts (SDK integration)     │      │
│  └────────┬────────┘  │  ├─ transformer.ts (event transformation)   │      │
│           │           │  └─ progress-tracker.ts (step inference)    │      │
│           │           └─────────────────────────────────────────────┘      │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            │  CommandDefinition, StreamingEvent, Domain Types
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Core Layer (packages/core/)                          │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  commands/  │  │   domain/   │  │   ports/    │  │  services/  │        │
│  │  (registry) │  │  (entities) │  │ (interfaces)│  │  (engines)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────┐  ┌───────────────────────────────────────────────┐        │
│  │ validation/ │  │  adapters/mock/ (testing implementations)     │        │
│  │  (schemas)  │  │                                               │        │
│  └─────────────┘  └───────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Dependency Flow

```
CLI ──depends on──► Provider ──depends on──► Core

Core defines:
  - CommandDefinition<T>, StreamingEvent (contracts)
  - Domain entities (ContentItem, WritingKit, etc.)
  - Port interfaces (SummarizerProvider, etc.)

Provider implements:
  - AgentExecutor interface
  - Claude Agent SDK integration

CLI orchestrates:
  - User interaction
  - Session management
  - Result rendering
```

---

## 3. Folder Design: CLI Package

**Location:** `apps/cli/src/`

### Directory Structure

```
apps/cli/src/
├── index.ts                 # Entry point, command dispatch
├── commands/                # Command entry points
│   ├── bootstrap.ts         # Deploy plugins to workspace
│   ├── config.ts            # User configuration
│   ├── kit.ts               # Kit building command
│   └── summarize.ts         # Summarization command
├── parsers/                 # Argument parsing
│   ├── index.ts
│   ├── kit-parser.ts        # Kit command args
│   └── summarize-parser.ts  # Summarize command args
├── renderers/               # Output formatting
│   ├── index.ts
│   ├── kit-renderer.ts      # Kit result display
│   ├── summarize-renderer.ts
│   └── post-completion.ts   # Next step hints
├── runtime/                 # Orchestration layer
│   ├── index.ts
│   ├── looplia-runtime.ts   # Main runtime class
│   ├── session-manager.ts   # Content session lifecycle
│   └── types.ts             # Config types
├── components/              # Ink/React TUI components
│   ├── index.ts
│   ├── streaming-query-ui.tsx  # Main streaming container
│   ├── agent-tree.tsx          # Agent hierarchy display
│   ├── agent-output.tsx        # Agent text output
│   ├── activity-log.tsx        # Activity history
│   ├── activity-item.tsx       # Single activity
│   ├── boxed-area.tsx          # UI container
│   ├── header.tsx              # Session header
│   ├── workspace-header.tsx    # Workspace info
│   ├── progress-bar.tsx        # Visual progress
│   ├── progress-section.tsx    # Progress + message
│   ├── result-section.tsx      # Final result
│   ├── spinner.tsx             # Loading indicator
│   ├── token-stats.tsx         # Token count
│   └── usage-stats.tsx         # Usage metrics
└── utils/                   # Helpers
    ├── index.ts
    ├── args.ts              # Argument utilities
    ├── file.ts              # File operations
    ├── format.ts            # Output formatting
    ├── streaming-state.ts   # Streaming state hooks
    └── terminal.ts          # Terminal detection
```

### File Purposes

| File | Purpose | Complexity Target |
|------|---------|-------------------|
| `commands/*.ts` | Entry points: parse → validate → execute → render | ≤5 |
| `parsers/*.ts` | Argument extraction and validation | ≤8 |
| `renderers/*.ts` | Output formatting and display | ≤8 |
| `runtime/looplia-runtime.ts` | Command orchestration | ≤10/method |
| `runtime/session-manager.ts` | Session file operations | ≤10/method |
| `components/*.tsx` | React/Ink UI components | ≤10 |

### Command Flow

```
index.ts
    │ Parse command name
    ▼
commands/kit.ts
    │ parseKitArgs(args)
    │ validateKitInput(config)
    │ createRuntime(config)
    ▼
runtime/looplia-runtime.ts
    │ sessionManager.prepare()
    │ getCommand("kit")
    │ command.promptTemplate(context)
    │ executor.executeStreaming(prompt, schema)
    ▼
components/streaming-query-ui.tsx
    │ Render streaming events
    │ Show progress, activities, usage
    ▼
renderers/kit-renderer.ts
    │ Format and display result
    │ Show next step hint
```

---

## 4. Folder Design: Core Package

**Location:** `packages/core/src/`

### Directory Structure

```
packages/core/src/
├── index.ts                 # Public API exports
├── commands/                # Command framework
│   ├── index.ts             # Auto-registration
│   ├── types.ts             # CommandDefinition, StreamingEvent
│   ├── registry.ts          # Command storage/lookup
│   ├── kit.ts               # Kit command definition
│   └── summarize.ts         # Summarize command definition
├── domain/                  # Domain entities (innermost layer)
│   ├── index.ts
│   ├── content.ts           # ContentItem, Source, ContentMetadata
│   ├── summary.ts           # ContentSummary, SummaryScore
│   ├── writing-kit.ts       # WritingKit, OutlineSection
│   ├── ideas.ts             # WritingIdeas, WritingHook, WritingAngle
│   ├── user-profile.ts      # UserProfile, WritingStyle
│   ├── core-idea.ts         # CoreIdea
│   ├── quote.ts             # Quote
│   └── errors.ts            # ProviderResult, ProviderError
├── ports/                   # Interface definitions
│   ├── index.ts
│   ├── summarizer.ts        # SummarizerProvider
│   ├── idea-generator.ts    # IdeaProvider
│   ├── outline-generator.ts # OutlineProvider
│   └── scoring.ts           # ScoringPolicy
├── services/                # Application services
│   ├── index.ts
│   ├── writing-kit-engine.ts    # buildWritingKit()
│   ├── summarization-engine.ts  # summarizeContent()
│   ├── idea-engine.ts           # generateIdeas()
│   └── ranking-engine.ts        # rankKits()
├── adapters/                # Adapter implementations
│   ├── index.ts
│   └── mock/                # Mock implementations for testing
│       ├── index.ts
│       ├── mock-summarizer.ts
│       ├── mock-idea-generator.ts
│       ├── mock-outline-generator.ts
│       └── mock-writing-kit-provider.ts
└── validation/              # Runtime validation
    ├── index.ts
    └── schemas.ts           # Zod schemas for all domain types
```

### Layer Mapping

| Directory | Clean Architecture Layer | Dependencies |
|-----------|-------------------------|--------------|
| `domain/` | Domain (innermost) | None |
| `ports/` | Ports | Domain only |
| `services/` | Application | Domain, Ports |
| `commands/` | Application | Domain, Ports |
| `adapters/mock/` | Infrastructure | Domain, Ports |
| `validation/` | Infrastructure | Domain |

### Key Types by Location

| File | Key Exports |
|------|-------------|
| `commands/types.ts` | `CommandDefinition<T>`, `StreamingEvent`, `AgentExecutor`, `CommandResult<T>`, `PromptContext` |
| `commands/registry.ts` | `registerCommand()`, `getCommand()`, `hasCommand()`, `getCommandNames()` |
| `domain/content.ts` | `ContentItem`, `Source`, `SourceType`, `ContentMetadata` |
| `domain/summary.ts` | `ContentSummary`, `SummaryScore` |
| `domain/writing-kit.ts` | `WritingKit`, `OutlineSection`, `WritingKitMeta`, `WritingKitSource` |
| `domain/ideas.ts` | `WritingIdeas`, `WritingHook`, `WritingAngle`, `WritingQuestion` |
| `domain/user-profile.ts` | `UserProfile`, `UserTopic`, `WritingStyle` |
| `domain/errors.ts` | `ProviderResult<T>`, `ProviderError`, `ok()`, `err()` |
| `ports/summarizer.ts` | `SummarizerProvider` |
| `ports/idea-generator.ts` | `IdeaProvider` |
| `ports/outline-generator.ts` | `OutlineProvider` |
| `ports/scoring.ts` | `ScoringPolicy` |

---

## 5. Folder Design: Provider Package

**Location:** `packages/provider/src/`

### Directory Structure

```
packages/provider/src/
├── index.ts                         # Public API exports
└── claude-agent-sdk/                # Claude Agent SDK integration
    ├── index.ts                     # SDK exports
    ├── executor.ts                  # AgentExecutor implementation
    ├── config.ts                    # ClaudeAgentConfig
    ├── workspace.ts                 # Workspace management
    ├── content-io.ts                # ContentItem serialization
    ├── summarizer.ts                # SummarizerProvider (legacy)
    ├── writing-kit-provider.ts      # WritingKitProvider (legacy)
    ├── streaming/                   # Event transformation
    │   ├── index.ts
    │   ├── types.ts                 # Internal streaming types
    │   ├── sdk-types.ts             # SDK message types
    │   ├── query-executor.ts        # executeAgenticQueryStreaming()
    │   ├── transformer.ts           # SDK → StreamingEvent
    │   └── progress-tracker.ts      # Step inference from tools
    ├── logger/                      # Debug logging
    │   ├── index.ts
    │   └── query-logger.ts          # QueryLogger implementation
    ├── prompts/                     # Prompt templates (legacy)
    │   └── summarize.ts
    └── utils/                       # Utilities
        ├── error-mapper.ts          # SDK error → ProviderError
        ├── schema-converter.ts      # Zod → JSON Schema
        ├── query-wrapper.ts         # Query execution wrapper
        ├── persist-result.ts        # Result persistence
        └── shared/                  # Shared utilities
            ├── index.ts
            ├── types.ts
            ├── content-id.ts        # ID generation
            └── workspace-cache.ts   # Workspace caching
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `executor.ts` | Implements `AgentExecutor` interface from core |
| `streaming/query-executor.ts` | Executes prompts via Claude Agent SDK with streaming |
| `streaming/transformer.ts` | Transforms SDK messages to `StreamingEvent` union |
| `streaming/progress-tracker.ts` | Infers progress from skill/tool invocations |
| `logger/query-logger.ts` | Creates unique log files per query for debugging |
| `workspace.ts` | Manages workspace directory (`~/.looplia/`) |

### SDK Integration Flow

```
AgentExecutor.executeStreaming(prompt, schema, options)
    │
    ├─ Convert Zod schema → JSON Schema (schema-converter.ts)
    │
    ├─ Execute via SDK (query-executor.ts)
    │   ├─ Create Claude session
    │   ├─ Send prompt with tools
    │   └─ Yield SDK messages
    │
    ├─ Transform SDK → StreamingEvent (transformer.ts)
    │   ├─ Track tool invocations (TransformContext)
    │   ├─ Correlate tool_use with tool_result
    │   └─ Yield ToolStartEvent, ToolEndEvent, etc.
    │
    ├─ Infer progress (progress-tracker.ts)
    │   ├─ Map skill names to steps
    │   └─ Emit ProgressEvent
    │
    └─ Return CommandResult<T>
```

---

## 6. Agent System with Skills

### Plugin Structure

**Location:** `plugins/looplia-writer/`

```
plugins/looplia-writer/
├── README.md                        # → Deployed as CLAUDE.md
├── agents/
│   ├── content-analyzer.md          # Deep content analysis
│   ├── idea-generator.md            # Creative ideation
│   └── writing-kit-builder.md       # Outline + assembly
└── skills/
    ├── media-reviewer/SKILL.md      # 9-step deep analysis
    ├── content-documenter/SKILL.md  # Structure 15 summary fields
    ├── user-profile-reader/SKILL.md # Relevance scoring
    ├── writing-enhancer/SKILL.md    # Style personalization
    └── id-generator/SKILL.md        # Session ID generation
```

### Agent Hierarchy

```
Main Agent (reads CLAUDE.md)
    │
    ├─ Checks session state (Glob contentItem/{id}/*.json)
    │
    ├─ Invokes via Task tool:
    │   │
    │   ├─ content-analyzer subagent
    │   │   ├─ Reads content.md
    │   │   ├─ Uses media-reviewer skill
    │   │   ├─ Uses content-documenter skill
    │   │   └─ Writes summary.json
    │   │
    │   ├─ idea-generator subagent
    │   │   ├─ Reads summary.json
    │   │   ├─ Reads user-profile.json
    │   │   └─ Writes ideas.json
    │   │
    │   └─ writing-kit-builder subagent
    │       ├─ Reads summary.json, ideas.json
    │       ├─ Writes outline.json
    │       └─ Writes writing-kit.json
    │
    └─ Returns writing-kit.json via StructuredOutput
```

### Complete Command Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLI: looplia kit --file article.md                                         │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LoopliaRuntime.executeKit(config)                                          │
│  ├─ SessionManager.prepare({file: "article.md"})                            │
│  │   ├─ ensureWorkspace() → ~/.looplia/                                     │
│  │   ├─ Create content.md in contentItem/{id}/                              │
│  │   └─ Return ContentItem                                                  │
│  ├─ getCommand("kit") → CommandDefinition<WritingKit>                       │
│  └─ command.promptTemplate(context) → minimal prompt                        │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ Prompt: "Build WritingKit for session:
                               │          contentItem/{id}"
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AgentExecutor.executeStreaming(prompt, WritingKitSchema, options)          │
│  ├─ zodToJsonSchema(WritingKitSchema)                                       │
│  ├─ executeAgenticQueryStreaming(prompt, jsonSchema, config)                │
│  │   ├─ Create Claude session (cwd: ~/.looplia/)                            │
│  │   └─ Tools: Read, Write, Glob, Task, AgentOutputTool, StructuredOutput   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ Streaming SDK messages
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAIN AGENT SESSION                                                          │
│                                                                             │
│  1. Read CLAUDE.md → Understand instructions                                │
│                                                                             │
│  2. Glob contentItem/{id}/*.json → Check existing files                     │
│     Decision: Only content.md exists → Run full workflow                    │
│                                                                             │
│  3. Task: content-analyzer → summary.json                                   │
│     ├─ Read contentItem/{id}/content.md                                     │
│     ├─ Skill: media-reviewer (9-step analysis)                              │
│     ├─ Skill: content-documenter (15 fields)                                │
│     └─ Write contentItem/{id}/summary.json                                  │
│                                                                             │
│  4. Task: idea-generator → ideas.json                                       │
│     ├─ Read summary.json, user-profile.json                                 │
│     └─ Write contentItem/{id}/ideas.json                                    │
│                                                                             │
│  5. Task: writing-kit-builder → writing-kit.json                            │
│     ├─ Read summary.json, ideas.json                                        │
│     ├─ Write outline.json                                                   │
│     └─ Write writing-kit.json                                               │
│                                                                             │
│  6. Read writing-kit.json → StructuredOutput                                │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ StreamingEvent flow
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TUI: streaming-query-ui.tsx                                                │
│  ├─ ToolStartEvent → Activity "Reading content.md"                          │
│  ├─ ToolEndEvent → Activity completed                                       │
│  ├─ ToolStartEvent (skill) → Activity "Running content-analyzer"            │
│  ├─ ProgressEvent → Progress bar 25%                                        │
│  ├─ UsageEvent → Token count update                                         │
│  └─ CompleteEvent → Final result                                            │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Renderer: kit-renderer.ts                                                  │
│  ├─ Display WritingKit summary                                              │
│  ├─ Show token usage and cost                                               │
│  └─ Print next step hint                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Smart Continuation

When resuming with `--session-id`:

```
Agent checks contentItem/{session-id}/:

Files Found:              Agent's Decision:
───────────────────────────────────────────────────────────────
content.md only           → Run full workflow (3 subagents)
+ summary.json            → Skip content-analyzer, run 2
+ ideas.json              → Skip content-analyzer + idea-generator
+ writing-kit.json        → Return existing kit directly
```

---

## 7. Streaming Event System

### Event Types

All events defined in `packages/core/src/commands/types.ts`:

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `PromptEvent` | Initial prompt sent | `content` |
| `SessionStartEvent` | Session initialized | `sessionId`, `model`, `availableTools` |
| `TextEvent` | Full agent text | `content` |
| `TextDeltaEvent` | Incremental text | `text` |
| `ThinkingEvent` | Full reasoning | `content` |
| `ThinkingDeltaEvent` | Incremental reasoning | `thinking` |
| `ToolStartEvent` | Tool invocation started | `toolUseId`, `tool`, `input` |
| `ToolEndEvent` | Tool completed | `toolUseId`, `success`, `durationMs` |
| `ProgressEvent` | Pipeline progress | `step`, `percent`, `message` |
| `UsageEvent` | Token counts | `inputTokens`, `outputTokens` |
| `ErrorEvent` | Non-fatal error | `code`, `message`, `recoverable` |
| `CompleteEvent<T>` | Final result | `result`, `usage`, `metrics` |

### Progress Steps

```typescript
type ProgressStep =
  | "initializing"      // 0%
  | "analyzing"         // 25% - content-analyzer running
  | "generating_ideas"  // 50% - idea-generator running
  | "building_outline"  // 75% - writing-kit-builder running
  | "assembling_kit";   // 90% - final assembly
```

### Event Flow Example

```
→ PromptEvent { content: "Build WritingKit..." }
→ SessionStartEvent { sessionId: "abc", model: "claude-sonnet-4-20250514", tools: [...] }
→ TextDeltaEvent { text: "I'll help you build..." }
→ ToolStartEvent { tool: "Read", input: { path: "CLAUDE.md" } }
→ ToolEndEvent { tool: "Read", success: true }
→ ToolStartEvent { tool: "Glob", input: { pattern: "contentItem/.../*.json" } }
→ ToolEndEvent { tool: "Glob", success: true }
→ ToolStartEvent { tool: "Task", input: { skill: "content-analyzer" } }
→ ProgressEvent { step: "analyzing", percent: 25, message: "Analyzing content..." }
→ ToolEndEvent { tool: "Task", success: true }
→ ProgressEvent { step: "generating_ideas", percent: 50 }
→ ... more events ...
→ UsageEvent { inputTokens: 15000, outputTokens: 3000 }
→ CompleteEvent { result: WritingKit, usage: { totalCostUsd: 0.05 } }
```

---

## 8. Clean Architecture Mapping

### Layer Responsibilities

| Layer | Location | Responsibility | Dependencies |
|-------|----------|----------------|--------------|
| **Domain** | `packages/core/src/domain/` | Business entities, rules | None |
| **Ports** | `packages/core/src/ports/` | Interface definitions | Domain |
| **Application** | `packages/core/src/services/`, `commands/` | Use cases, orchestration | Domain, Ports |
| **Adapters** | `packages/core/src/adapters/`, `packages/provider/` | External integrations | Domain, Ports |
| **Infrastructure** | `apps/cli/` | UI, persistence, config | All |

### Dependency Rule

Dependencies flow **inward only**:

```
Infrastructure (CLI)
       │
       ▼
Adapters (Provider, Mock)
       │
       ▼
Application (Services, Commands)
       │
       ▼
Ports (Interfaces)
       │
       ▼
Domain (Entities)
```

### Interface Segregation

Each port has a single responsibility:

| Port | Method | Input | Output |
|------|--------|-------|--------|
| `SummarizerProvider` | `summarize` | `ContentItem`, `UserProfile?` | `ProviderResult<ContentSummary>` |
| `IdeaProvider` | `generateIdeas` | `ContentSummary`, `UserProfile` | `ProviderResult<WritingIdeas>` |
| `OutlineProvider` | `generateOutline` | `ContentSummary`, `WritingIdeas`, `UserProfile` | `ProviderResult<OutlineSection[]>` |
| `ScoringPolicy` | `relevance` | `ContentSummary`, `UserProfile` | `number` |

### Dependency Inversion

Core defines interfaces, adapters implement them:

```typescript
// Core defines (packages/core/src/commands/types.ts)
type AgentExecutor = {
  executeStreaming<T>(...): AsyncGenerator<StreamingEvent, CommandResult<T>>;
  execute<T>(...): Promise<CommandResult<T>>;
};

// Provider implements (packages/provider/src/claude-agent-sdk/executor.ts)
export function createClaudeAgentExecutor(config?): AgentExecutor {
  return {
    async *executeStreaming<T>(...) { ... },
    async execute<T>(...) { ... }
  };
}
```

---

## 9. Adding a New Command

### Step-by-Step Guide

#### Step 1: Define Domain Types (if needed)

```typescript
// packages/core/src/domain/my-output.ts
export type MyOutput = {
  field1: string;
  field2: number;
};
```

#### Step 2: Create Command Definition

```typescript
// packages/core/src/commands/my-command.ts
import { z } from "zod";
import type { CommandDefinition, PromptContext } from "./types";

const MyOutputSchema = z.object({
  field1: z.string(),
  field2: z.number(),
});

export const myCommand: CommandDefinition<MyOutput> = {
  name: "my-command",

  displayConfig: {
    title: "My Command",
    successMessage: "Completed successfully!",
    nextStep: {
      description: "Next, try this:",
      commandTemplate: "looplia other --session-id {contentId}",
    },
  },

  promptTemplate: (ctx: PromptContext): string => `
Task: Perform my command for session: ${ctx.contentId}

Read the content from: ${ctx.contentPath}
Write result to: contentItem/${ctx.contentId}/my-output.json

Return the result as structured output.
`,

  outputSchema: MyOutputSchema,
};
```

#### Step 3: Register Command

```typescript
// packages/core/src/commands/index.ts
import { myCommand } from "./my-command";

registerCommand(myCommand);
```

#### Step 4: Create CLI Entry Point

```typescript
// apps/cli/src/commands/my-command.ts
import { createRuntime } from "../runtime";
import { parseMyCommandArgs, validateMyCommandInput } from "../parsers";
import { renderMyCommandResult } from "../renderers";

export async function runMyCommand(args: string[]): Promise<void> {
  const config = parseMyCommandArgs(args);

  if (config.help) {
    printMyCommandHelp();
    return;
  }

  try {
    validateMyCommandInput(config);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }

  const runtime = createRuntime(config);
  const result = await runtime.executeCommand<MyOutput>(
    "my-command",
    config.contentId,
    config.title
  );

  renderMyCommandResult(result, config);
}
```

#### Step 5: Create Parser

```typescript
// apps/cli/src/parsers/my-command-parser.ts
import { parseArgv, getArg } from "../utils/args";

export type MyCommandConfig = {
  help: boolean;
  file?: string;
  // ... other options
};

export function parseMyCommandArgs(args: string[]): MyCommandConfig {
  const parsed = parseArgv(args);
  return {
    help: parsed["help"] || parsed["h"],
    file: getArg(parsed, "file", "f"),
  };
}

export function validateMyCommandInput(config: MyCommandConfig): void {
  if (!config.file) {
    throw new Error("--file is required");
  }
}
```

#### Step 6: Create Renderer

```typescript
// apps/cli/src/renderers/my-command-renderer.ts
import type { CommandResult } from "@looplia-core/core";
import type { MyOutput } from "@looplia-core/core";

export function renderMyCommandResult(
  result: CommandResult<MyOutput>,
  config: MyCommandConfig
): void {
  if (!result.success) {
    console.error(`Error: ${result.error?.message}`);
    return;
  }

  console.log(JSON.stringify(result.data, null, 2));
}
```

#### Step 7: Add to CLI Dispatch

```typescript
// apps/cli/src/index.ts
switch (command) {
  case "my-command":
    await runMyCommand(rest);
    break;
  // ... other commands
}
```

#### Step 8: (Optional) Create Subagent

```markdown
<!-- plugins/looplia-writer/agents/my-agent.md -->
---
name: my-agent
description: Performs my specialized task
model: haiku
tools: Read, Write, Skill
---

# My Agent

Perform the specialized task.

## Input

Read from: `contentItem/{id}/input.md`

## Task

1. Analyze the input
2. Process as needed
3. Generate output

## Output

Write to: `contentItem/{id}/my-output.json`
```

### Checklist

- [ ] Domain types defined (if needed)
- [ ] CommandDefinition created with schema
- [ ] Command registered in index.ts
- [ ] CLI entry point created
- [ ] Parser created and exported
- [ ] Renderer created and exported
- [ ] CLI dispatch updated
- [ ] (Optional) Subagent markdown created
- [ ] Tests written

---

## Cross-References

- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md) for term definitions
- **Agentic Concept:** See [AGENTIC_CONCEPT.md](./AGENTIC_CONCEPT.md) for detailed agent architecture
- **Previous Versions:** See DESIGN-0.3.x.md files for evolution history

---

*This document serves as the single source of truth for Looplia-Core v0.4.0 architecture.*
