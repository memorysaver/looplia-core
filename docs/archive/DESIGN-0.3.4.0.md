# Looplia Core – Technical Design Document v0.3.4.0

**Version:** 0.3.4.0
**Status:** Proposed
**Last Updated:** 2025-12-09

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Design Goals](#3-design-goals)
4. [Architecture](#4-architecture)
5. [Streaming Event Model](#5-streaming-event-model)
6. [Ink UI Components](#6-ink-ui-components)
7. [Provider Changes](#7-provider-changes)
8. [CLI Changes](#8-cli-changes)
9. [Implementation Plan](#9-implementation-plan)
10. [File Changes](#10-file-changes)
11. [Usage Guide](#11-usage-guide)
12. [Testing Strategy](#12-testing-strategy)
13. [Future Considerations](#13-future-considerations)

---

## 1. Overview

### 1.1 Purpose

v0.3.4 introduces a **streaming terminal UI** using [Ink](https://github.com/vadimdemedes/ink) (React for CLIs) to provide real-time visibility into agent execution. Users will see live progress as the Claude agent processes content, invokes skills, and builds writing kits.

### 1.2 Key Features

| Feature | Description |
|---------|-------------|
| **Real-time Progress** | Live progress bar and status updates |
| **Activity Log** | Scrolling log of agent actions (file reads, skill invocations) |
| **Token Usage** | Live token count and estimated cost display |
| **Step Indicators** | Visual checkmarks for completed pipeline steps |
| **Graceful Fallback** | Non-interactive mode for pipes and CI environments |

### 1.3 Key Changes from v0.3.3

| Aspect | v0.3.3 | v0.3.4 |
|--------|--------|--------|
| **Output Style** | Static console.log after completion | Real-time streaming UI |
| **Progress Visibility** | Single "Building..." message | Step-by-step progress with activity log |
| **Dependencies** | Minimal | +ink, +react, +@types/react |
| **SDK Messages** | Logged to file only | Parsed and displayed in UI |
| **Token Usage** | Hidden | Live display during execution |

### 1.4 Why Ink?

**Ink** is the de-facto standard for building modern CLI applications with React:

- **React Paradigm**: Familiar component model, hooks, state management
- **Efficient Rendering**: Only updates changed terminal regions
- **Rich Ecosystem**: Spinners, progress bars, tables, and more
- **TypeScript Support**: First-class TypeScript definitions
- **Battle-tested**: Used by Gatsby, Prisma, Shopify CLI, and others

```tsx
// Example Ink usage
import { render, Text, Box } from 'ink';

const App = () => (
  <Box flexDirection="column">
    <Text color="green">✓ Step completed</Text>
    <Text>Processing...</Text>
  </Box>
);

render(<App />);
```

---

## 2. Problem Statement

### 2.1 Current UX Issues

The v0.3.3 CLI provides minimal feedback during agent execution:

```bash
$ looplia kit --file article.md
✓ New session created: article-2025-12-09-abc123
⏳ Building writing kit...

# ... 30-60 seconds of silence ...

{"contentId": "...", "summary": {...}, ...}
```

**Problems:**

1. **No Progress Visibility**: Users don't know if the tool is working or stuck
2. **Long Wait Times**: Agent queries take 30-120 seconds with no feedback
3. **Hidden Activity**: File reads, skill invocations, and subagent calls are invisible
4. **No Token Insight**: Users can't see API usage or estimate costs
5. **Poor Error UX**: Errors appear after long silence, with minimal context

### 2.2 SDK Streaming Capability

The Claude Agent SDK already returns an `AsyncGenerator<SDKMessage>` that yields real-time events:

```typescript
// Current implementation - IGNORES streaming messages
for await (const message of result) {
  if (contentId) {
    logger.log(message);  // Only logged to file
  }
  if (message.type !== "result") {
    continue;  // SKIP all intermediate messages!
  }
  // Process final result only
}
```

**SDK Message Types Available:**

| Message Type | Subtype/Content | Description |
|--------------|-----------------|-------------|
| `system` | `init` | Session ID, model, available tools |
| `system` | `compact_boundary` | Session compaction marker |
| `assistant` | `message.content[]` | Contains `TextBlock`, `ThinkingBlock`, `ToolUseBlock` |
| `user` | `message.content[]` | Contains `ToolResultBlock` with tool outputs |
| `stream_event` | `event` (delta) | Real-time streaming (requires `includePartialMessages: true`) |
| `result` | `success`/`error_*` | Final output with metrics |

**Important:** Tool calls and results are NOT top-level message types. They are **content blocks** nested inside `assistant` and `user` messages respectively.

This streaming data is currently **logged but not displayed**.

### 2.3 User Expectations

Modern CLI tools provide rich feedback:

```bash
# Example: pnpm install
⠋ Resolving packages...
Packages: +342
Progress: ██████████████████████████████░░░░░░ 85%
```

```bash
# Example: GitHub CLI
✓ Created pull request #123
? View in browser? (y/N)
```

Users expect similar feedback from AI-powered tools.

---

## 3. Design Goals

### 3.1 Primary Goals

| Goal | Metric | Target |
|------|--------|--------|
| **Real-time Feedback** | First UI update | <500ms after command start |
| **Progress Visibility** | User comprehension | Clear pipeline stage indication |
| **Token Transparency** | Cost visibility | Live token/cost display |
| **Clean Separation** | Architecture | Provider has no UI dependencies |

### 3.2 Constraints

| Constraint | Rationale |
|------------|-----------|
| **Provider stays pure** | No ink/react deps in @looplia-core/provider |
| **Backward compatible** | Existing scripts with `--format json` must work |
| **Non-interactive support** | Pipes, CI, redirected output must work |
| **Minimal footprint** | Ink adds ~400KB, acceptable for CLI |

### 3.3 Non-Goals (v0.3.4)

- Interactive prompts mid-execution
- Multiple concurrent kit builds
- Web-based dashboard
- Persistent progress history

---

## 4. Architecture

### 4.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CLI Layer (@looplia-core/cli)                                                  │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Ink UI Components (React)                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │   │
│  │  │ ProgressBar  │  │ ActivityLog  │  │ StepIndicator│  │ UsageStats  │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │   │
│  │                            │                                            │   │
│  │                            ▼                                            │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    KitBuilderUI (Main Component)                 │  │   │
│  │  │                                                                  │  │   │
│  │  │  useStreamingQuery(provider, content, user)                     │  │   │
│  │  │    └─► Consumes AsyncGenerator<StreamingEvent>                  │  │   │
│  │  │    └─► Updates React state on each event                        │  │   │
│  │  │    └─► Triggers re-render                                       │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                        ▲                                        │
│                                        │ StreamingEvent                        │
└────────────────────────────────────────┼────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────┼────────────────────────────────────────┐
│  Provider Layer (@looplia-core/provider)                                        │
│                                        │                                        │
│  ┌─────────────────────────────────────┴───────────────────────────────────┐   │
│  │                     buildKitStreaming()                                 │   │
│  │                                                                         │   │
│  │  Returns: AsyncGenerator<StreamingEvent, WritingKit>                   │   │
│  │                                                                         │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    SDK Message Transformer                        │ │   │
│  │  │                                                                   │ │   │
│  │  │  SDKMessage ──► parse ──► StreamingEvent                         │ │   │
│  │  │                                                                   │ │   │
│  │  │  • init      → { type: 'session_start', sessionId }              │ │   │
│  │  │  • assistant → { type: 'thinking', content }                     │ │   │
│  │  │  • tool_use  → { type: 'tool_start', tool, input }              │ │   │
│  │  │  • tool_result → { type: 'tool_end', tool, output }             │ │   │
│  │  │  • result    → { type: 'complete', result, usage }              │ │   │
│  │  └───────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                        ▲                                        │
│                                        │ SDKMessage                            │
│                                        │                                        │
│  ┌─────────────────────────────────────┴───────────────────────────────────┐   │
│  │                          Claude Agent SDK                               │   │
│  │                                                                         │   │
│  │  query() → AsyncGenerator<SDKMessage>                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow

```
User Command
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ CLI: runKitCommand()                                            │
│   │                                                             │
│   ├─► Parse args, load content                                  │
│   │                                                             │
│   ├─► Check if TTY (interactive terminal)                       │
│   │     │                                                       │
│   │     ├─► TTY: render(<KitBuilderUI />)                      │
│   │     │         │                                             │
│   │     │         └─► useStreamingQuery hook                    │
│   │     │               │                                       │
│   │     │               ▼                                       │
│   │     │         provider.buildKitStreaming()                  │
│   │     │               │                                       │
│   │     │               ▼                                       │
│   │     │         for await (event of stream) {                │
│   │     │           setProgress(event);  // React state         │
│   │     │         }                                             │
│   │     │               │                                       │
│   │     │               ▼                                       │
│   │     │         On complete: render final result              │
│   │     │                                                       │
│   │     └─► Non-TTY: provider.buildKit() (legacy)              │
│   │                   │                                         │
│   │                   ▼                                         │
│   │                 console.log(result)                         │
│   │                                                             │
│   └─► Exit                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Component Hierarchy

```
<KitBuilderUI>
├── <Header />
│   └── Session ID, timestamp
│
├── <ProgressSection />
│   ├── <ProgressBar percent={progress} />
│   └── <CurrentStep step={currentStep} />
│
├── <ActivityLog />
│   └── <ActivityItem /> × N (scrolling)
│       ├── ✓ Read content.md
│       ├── ✓ content-analyzer completed
│       ├── ⏳ idea-generator running...
│       └── ○ writing-kit-builder pending
│
├── <UsageStats />
│   └── Tokens: 1,234 in / 567 out | Cost: $0.012
│
└── <ResultSection /> (when complete)
    └── Formatted WritingKit output
```

---

## 5. Streaming Event Model

### 5.1 StreamingEvent Type Definition

```typescript
// packages/provider/src/claude-agent-sdk/streaming/types.ts

/**
 * Events emitted during streaming query execution
 *
 * These are PROVIDER events (not SDK messages). The transformer
 * converts SDK messages into these simplified events for UI consumption.
 */
export type StreamingEvent =
  | SessionStartEvent
  | TextEvent
  | TextDeltaEvent
  | ThinkingEvent
  | ThinkingDeltaEvent
  | ToolStartEvent
  | ToolEndEvent
  | ProgressEvent
  | ErrorEvent
  | CompleteEvent;

/**
 * Session initialized - from SDK system.init message
 */
export type SessionStartEvent = {
  type: "session_start";
  sessionId: string;
  model: string;
  /** Tools available for this session */
  availableTools: string[];
  timestamp: number;
};

/**
 * Text output from agent - from assistant.message.content[].text
 */
export type TextEvent = {
  type: "text";
  content: string;
  timestamp: number;
};

/**
 * Streaming text delta - from stream_event.content_block_delta.text_delta
 * Only emitted when includePartialMessages: true
 */
export type TextDeltaEvent = {
  type: "text_delta";
  text: string;
  timestamp: number;
};

/**
 * Agent thinking/reasoning - from assistant.message.content[].thinking
 */
export type ThinkingEvent = {
  type: "thinking";
  content: string;
  timestamp: number;
};

/**
 * Streaming thinking delta - from stream_event.content_block_delta.thinking_delta
 * Only emitted when includePartialMessages: true
 */
export type ThinkingDeltaEvent = {
  type: "thinking_delta";
  thinking: string;
  timestamp: number;
};

/**
 * Tool invocation started - from assistant.message.content[].tool_use block
 */
export type ToolStartEvent = {
  type: "tool_start";
  /** Unique ID for correlating with tool_end */
  toolUseId: string;
  tool: "Read" | "Skill" | "Write" | "Glob" | "Grep" | string;
  input: {
    /** For Read/Write: file path */
    path?: string;
    /** For Skill: skill name */
    skill?: string;
    /** For Glob/Grep: search pattern */
    pattern?: string;
    /** For other tools: raw input */
    raw?: unknown;
  };
  timestamp: number;
};

/**
 * Tool invocation completed - from user.message.content[].tool_result block
 */
export type ToolEndEvent = {
  type: "tool_end";
  /** Correlates with ToolStartEvent.toolUseId */
  toolUseId: string;
  tool: "Read" | "Skill" | "Write" | "Glob" | "Grep" | string;
  success: boolean;
  /** Summary of output (truncated for display) */
  summary?: string;
  /** Duration in milliseconds */
  durationMs: number;
  timestamp: number;
};

/**
 * Pipeline progress update - inferred from skill invocations
 */
export type ProgressEvent = {
  type: "progress";
  /** Current pipeline step */
  step: "analyzing" | "generating_ideas" | "building_outline" | "assembling_kit";
  /** 0-100 percentage */
  percent: number;
  /** Human-readable message */
  message: string;
  timestamp: number;
};

/**
 * Non-fatal error or warning
 */
export type ErrorEvent = {
  type: "error";
  code: string;
  message: string;
  recoverable: boolean;
  timestamp: number;
};

/**
 * Query completed - from SDK result message
 */
export type CompleteEvent<T = unknown> = {
  type: "complete";
  /** Result subtype from SDK */
  subtype: "success" | "error_max_turns" | "error_during_execution";
  result: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
  /** Execution metrics from SDK */
  metrics: {
    durationMs: number;
    durationApiMs?: number;
    numTurns: number;
  };
  sessionId: string;
  timestamp: number;
};
```

### 5.2 Claude Agent SDK Message Structure (Corrected)

Based on official SDK documentation, the message structure is:

```typescript
// SDK Message Types (discriminated union)
type SDKMessage =
  | SDKSystemMessage          // type: 'system', subtype: 'init' | 'compact_boundary'
  | SDKAssistantMessage       // type: 'assistant', contains message.content[]
  | SDKUserMessage            // type: 'user', contains tool results
  | SDKPartialAssistantMessage // type: 'stream_event' (requires includePartialMessages)
  | SDKResultMessage          // type: 'result', final output

// SDKSystemMessage (init)
type SDKSystemMessage = {
  type: 'system';
  subtype: 'init';
  session_id: string;
  uuid: string;
  tools: string[];            // Available tools: ['Read', 'Skill', ...]
  model: string;              // e.g., 'claude-haiku-4-5-20251001'
  mcp_servers: string[];
  permissionMode: string;
};

// SDKAssistantMessage - CONTAINS TOOL CALLS AS CONTENT BLOCKS
type SDKAssistantMessage = {
  type: 'assistant';
  uuid: string;
  session_id: string;
  parent_tool_use_id: string | null;
  message: {
    content: ContentBlock[];  // Array of text, thinking, or tool_use blocks
    usage: { input_tokens: number; output_tokens: number };
    model: string;
  };
};

// Content blocks inside assistant.message.content[]
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

// SDKUserMessage - CONTAINS TOOL RESULTS AS CONTENT BLOCKS
type SDKUserMessage = {
  type: 'user';
  uuid: string;
  session_id: string;
  parent_tool_use_id: string | null;
  message: {
    content: ToolResultBlock[];
  };
};

// Tool result block inside user.message.content[]
type ToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;        // References the ToolUseBlock.id
  content: string | unknown;  // Tool output
  is_error?: boolean;         // Indicates failure
};

// SDKResultMessage - Final output
type SDKResultMessage = {
  type: 'result';
  subtype: 'success' | 'error_max_turns' | 'error_during_execution';
  uuid: string;
  session_id: string;
  result: string;
  structured_output?: unknown;  // JSON schema output
  duration_ms: number;          // Total execution time
  duration_api_ms?: number;     // API-only time
  num_turns: number;            // Number of agent iterations
  total_cost_usd: number;       // Estimated cost
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  permission_denials: Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: unknown;
  }>;
};

// SDKPartialAssistantMessage - Real-time streaming
type SDKPartialAssistantMessage = {
  type: 'stream_event';
  uuid: string;
  session_id: string;
  parent_tool_use_id: string | null;
  event: RawMessageStreamEvent;  // From Anthropic SDK
};

// Stream event deltas
type RawMessageStreamEvent =
  | { type: 'content_block_start'; content_block: ContentBlock; index: number }
  | { type: 'content_block_delta'; delta: ContentBlockDelta; index: number }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_start'; message: Message }
  | { type: 'message_stop' };

type ContentBlockDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'input_json_delta'; input_json: string };
```

### 5.3 SDK Message to StreamingEvent Transformer

```typescript
// packages/provider/src/claude-agent-sdk/streaming/transformer.ts

import type { StreamingEvent, ToolStartEvent, ToolEndEvent } from "./types";

/**
 * Context maintained across message transformations
 */
export type TransformContext = {
  model: string;
  sessionId: string;
  startTime: number;
  /** Map of tool_use_id -> tool name for correlating results */
  pendingTools: Map<string, { name: string; startTime: number }>;
  /** Accumulated usage from assistant messages */
  cumulativeUsage: { inputTokens: number; outputTokens: number };
};

/**
 * Transform SDK messages to streaming events
 *
 * IMPORTANT: Tool calls and results are NESTED inside assistant/user messages
 * as content blocks, NOT separate top-level message types.
 */
export function* transformSdkMessage(
  message: Record<string, unknown>,
  context: TransformContext
): Generator<StreamingEvent> {
  const timestamp = Date.now();

  switch (message.type) {
    case "system":
      yield* handleSystemMessage(message, context, timestamp);
      break;

    case "assistant":
      yield* handleAssistantMessage(message, context, timestamp);
      break;

    case "user":
      yield* handleUserMessage(message, context, timestamp);
      break;

    case "stream_event":
      yield* handleStreamEvent(message, context, timestamp);
      break;

    case "result":
      yield* handleResultMessage(message, context, timestamp);
      break;
  }
}

/**
 * Handle system messages (init, compact_boundary)
 */
function* handleSystemMessage(
  message: Record<string, unknown>,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  if (message.subtype === "init") {
    context.sessionId = (message.session_id as string) ?? "";
    yield {
      type: "session_start",
      sessionId: context.sessionId,
      model: (message.model as string) ?? context.model,
      availableTools: (message.tools as string[]) ?? [],
      timestamp,
    };
  }
  // compact_boundary could emit a notification event if needed
}

/**
 * Handle assistant messages - extract content blocks
 */
function* handleAssistantMessage(
  message: Record<string, unknown>,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const assistantMessage = message.message as {
    content?: Array<Record<string, unknown>>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  if (!assistantMessage?.content) return;

  // Update cumulative usage
  if (assistantMessage.usage) {
    context.cumulativeUsage.inputTokens += assistantMessage.usage.input_tokens ?? 0;
    context.cumulativeUsage.outputTokens += assistantMessage.usage.output_tokens ?? 0;
  }

  // Process each content block
  for (const block of assistantMessage.content) {
    switch (block.type) {
      case "text":
        yield {
          type: "text",
          content: truncate(block.text as string, 200),
          timestamp,
        };
        break;

      case "thinking":
        yield {
          type: "thinking",
          content: truncate(block.thinking as string, 200),
          timestamp,
        };
        break;

      case "tool_use":
        // Store pending tool for result correlation
        const toolUseId = block.id as string;
        const toolName = block.name as string;
        context.pendingTools.set(toolUseId, { name: toolName, startTime: timestamp });

        yield {
          type: "tool_start",
          toolUseId,
          tool: toolName as ToolStartEvent["tool"],
          input: extractToolInput(toolName, block.input as Record<string, unknown>),
          timestamp,
        };
        break;
    }
  }
}

/**
 * Handle user messages - extract tool results
 */
function* handleUserMessage(
  message: Record<string, unknown>,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const userMessage = message.message as {
    content?: Array<Record<string, unknown>>;
  };

  if (!userMessage?.content) return;

  for (const block of userMessage.content) {
    if (block.type === "tool_result") {
      const toolUseId = block.tool_use_id as string;
      const pendingTool = context.pendingTools.get(toolUseId);

      if (pendingTool) {
        const durationMs = timestamp - pendingTool.startTime;
        context.pendingTools.delete(toolUseId);

        yield {
          type: "tool_end",
          toolUseId,
          tool: pendingTool.name as ToolEndEvent["tool"],
          success: !block.is_error,
          summary: summarizeToolOutput(block.content),
          durationMs,
          timestamp,
        };
      }
    }
  }
}

/**
 * Handle stream events for real-time updates
 */
function* handleStreamEvent(
  message: Record<string, unknown>,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const event = message.event as Record<string, unknown>;
  if (!event) return;

  if (event.type === "content_block_delta") {
    const delta = event.delta as Record<string, unknown>;
    if (delta?.type === "text_delta") {
      yield {
        type: "text_delta",
        text: delta.text as string,
        timestamp,
      };
    } else if (delta?.type === "thinking_delta") {
      yield {
        type: "thinking_delta",
        thinking: delta.thinking as string,
        timestamp,
      };
    }
  }
}

/**
 * Handle result message - final output
 */
function* handleResultMessage(
  message: Record<string, unknown>,
  context: TransformContext,
  timestamp: number
): Generator<StreamingEvent> {
  const usage = message.usage as Record<string, number> | undefined;

  yield {
    type: "complete",
    subtype: message.subtype as "success" | "error_max_turns" | "error_during_execution",
    result: message.structured_output,
    usage: {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      totalCostUsd: (message.total_cost_usd as number) ?? 0,
    },
    metrics: {
      durationMs: (message.duration_ms as number) ?? 0,
      durationApiMs: message.duration_api_ms as number | undefined,
      numTurns: (message.num_turns as number) ?? 0,
    },
    sessionId: context.sessionId,
    timestamp,
  };
}

/**
 * Extract relevant input fields based on tool type
 */
function extractToolInput(
  toolName: string,
  input: Record<string, unknown>
): ToolStartEvent["input"] {
  switch (toolName) {
    case "Read":
      return { path: input.file_path as string };
    case "Skill":
      return { skill: input.skill as string };
    case "Write":
      return { path: input.file_path as string };
    case "Glob":
      return { pattern: input.pattern as string };
    case "Grep":
      return { pattern: input.pattern as string };
    default:
      return { raw: input };
  }
}

/**
 * Summarize tool output for display
 */
function summarizeToolOutput(content: unknown): string {
  if (typeof content === "string") {
    return truncate(content, 100);
  }
  if (Array.isArray(content)) {
    return `${content.length} items`;
  }
  return "completed";
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
```

### 5.4 Progress Inference

The provider infers pipeline progress from skill invocations:

```typescript
// packages/provider/src/claude-agent-sdk/streaming/progress-tracker.ts

const SKILL_TO_STEP: Record<string, ProgressEvent["step"]> = {
  "content-analyzer": "analyzing",
  "idea-generator": "generating_ideas",
  "writing-kit-builder": "building_outline",
};

const STEP_PERCENTAGES: Record<ProgressEvent["step"], number> = {
  analyzing: 25,
  generating_ideas: 50,
  building_outline: 75,
  assembling_kit: 90,
};

export class ProgressTracker {
  private currentStep: ProgressEvent["step"] = "analyzing";
  private percent = 0;

  onToolStart(tool: string, input: { skill?: string }): ProgressEvent | null {
    if (tool !== "Skill" || !input.skill) return null;

    const step = SKILL_TO_STEP[input.skill];
    if (step) {
      this.currentStep = step;
      this.percent = STEP_PERCENTAGES[step];

      return {
        type: "progress",
        step,
        percent: this.percent,
        message: this.getStepMessage(step),
        timestamp: Date.now(),
      };
    }
    return null;
  }

  onComplete(): ProgressEvent {
    return {
      type: "progress",
      step: "assembling_kit",
      percent: 100,
      message: "Writing kit complete!",
      timestamp: Date.now(),
    };
  }

  private getStepMessage(step: ProgressEvent["step"]): string {
    switch (step) {
      case "analyzing":
        return "Analyzing content...";
      case "generating_ideas":
        return "Generating writing ideas...";
      case "building_outline":
        return "Building suggested outline...";
      case "assembling_kit":
        return "Assembling writing kit...";
    }
  }
}
```

---

## 6. Ink UI Components

### 6.1 Component Library

```
apps/cli/src/
├── components/
│   ├── index.ts                    # Export all components
│   ├── KitBuilderUI.tsx            # Main wrapper component
│   ├── Header.tsx                  # Session info header
│   ├── ProgressBar.tsx             # Visual progress indicator
│   ├── ProgressSection.tsx         # Progress + current step
│   ├── ActivityLog.tsx             # Scrolling activity items
│   ├── ActivityItem.tsx            # Single activity entry
│   ├── UsageStats.tsx              # Token/cost display
│   ├── ResultSection.tsx           # Final result display
│   └── Spinner.tsx                 # Loading indicator
├── hooks/
│   ├── useStreamingQuery.ts        # Main streaming hook
│   └── useActivityLog.ts           # Activity log state management
└── utils/
    └── terminal.ts                 # TTY detection utilities
```

### 6.2 KitBuilderUI Component

```tsx
// apps/cli/src/components/KitBuilderUI.tsx

import React from "react";
import { Box, Text, render } from "ink";
import type { ContentItem, UserProfile, WritingKit } from "@looplia-core/core";
import type { WritingKitProvider } from "@looplia-core/provider";

import { Header } from "./Header";
import { ProgressSection } from "./ProgressSection";
import { ActivityLog } from "./ActivityLog";
import { UsageStats } from "./UsageStats";
import { ResultSection } from "./ResultSection";
import { useStreamingQuery } from "../hooks/useStreamingQuery";

type Props = {
  provider: WritingKitProvider;
  content: ContentItem;
  user: UserProfile;
  format: "json" | "markdown";
  onComplete: (result: WritingKit) => void;
  onError: (error: Error) => void;
};

export const KitBuilderUI: React.FC<Props> = ({
  provider,
  content,
  user,
  format,
  onComplete,
  onError,
}) => {
  const {
    status,
    sessionId,
    progress,
    currentStep,
    activities,
    usage,
    result,
    error,
  } = useStreamingQuery(provider, content, user);

  // Handle completion
  React.useEffect(() => {
    if (status === "complete" && result) {
      onComplete(result);
    }
    if (status === "error" && error) {
      onError(error);
    }
  }, [status, result, error, onComplete, onError]);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Header sessionId={sessionId} contentTitle={content.title} />

      {/* Progress */}
      {status !== "complete" && (
        <ProgressSection
          percent={progress}
          step={currentStep}
          isRunning={status === "running"}
        />
      )}

      {/* Activity Log */}
      <ActivityLog activities={activities} maxVisible={8} />

      {/* Usage Stats */}
      <UsageStats usage={usage} />

      {/* Result */}
      {status === "complete" && result && (
        <ResultSection result={result} format={format} />
      )}

      {/* Error */}
      {status === "error" && error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error.message}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Render the streaming UI
 */
export function renderKitBuilder(props: Props): void {
  render(<KitBuilderUI {...props} />);
}
```

### 6.3 ProgressBar Component

```tsx
// apps/cli/src/components/ProgressBar.tsx

import React from "react";
import { Box, Text } from "ink";

type Props = {
  percent: number;
  width?: number;
  showPercent?: boolean;
};

export const ProgressBar: React.FC<Props> = ({
  percent,
  width = 40,
  showPercent = true,
}) => {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;

  const filledBar = "█".repeat(filled);
  const emptyBar = "░".repeat(empty);

  return (
    <Box>
      <Text color="green">{filledBar}</Text>
      <Text color="gray">{emptyBar}</Text>
      {showPercent && (
        <Text color="cyan"> {percent.toFixed(0)}%</Text>
      )}
    </Box>
  );
};
```

### 6.4 ActivityLog Component

```tsx
// apps/cli/src/components/ActivityLog.tsx

import React from "react";
import { Box, Text, Static } from "ink";
import { ActivityItem, type Activity } from "./ActivityItem";

type Props = {
  activities: Activity[];
  maxVisible?: number;
};

export const ActivityLog: React.FC<Props> = ({
  activities,
  maxVisible = 8,
}) => {
  // Show most recent activities
  const visibleActivities = activities.slice(-maxVisible);
  const hiddenCount = activities.length - maxVisible;

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="white">Activity:</Text>

      {hiddenCount > 0 && (
        <Text color="gray" dimColor>
          ... {hiddenCount} more items above
        </Text>
      )}

      {/* Completed activities (static - won't re-render) */}
      <Static items={visibleActivities.filter(a => a.status === "complete")}>
        {(activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        )}
      </Static>

      {/* In-progress activities */}
      {visibleActivities
        .filter(a => a.status !== "complete")
        .map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
    </Box>
  );
};
```

### 6.5 ActivityItem Component

```tsx
// apps/cli/src/components/ActivityItem.tsx

import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "./Spinner";

export type Activity = {
  id: string;
  status: "pending" | "running" | "complete" | "error";
  type: "read" | "skill" | "thinking" | "write";
  label: string;
  detail?: string;
  durationMs?: number;
};

type Props = {
  activity: Activity;
};

export const ActivityItem: React.FC<Props> = ({ activity }) => {
  const icon = getStatusIcon(activity.status);
  const color = getStatusColor(activity.status);

  return (
    <Box>
      <Box width={3}>
        {activity.status === "running" ? (
          <Spinner />
        ) : (
          <Text color={color}>{icon}</Text>
        )}
      </Box>
      <Text color={color}>{activity.label}</Text>
      {activity.detail && (
        <Text color="gray" dimColor> ({activity.detail})</Text>
      )}
      {activity.durationMs !== undefined && activity.status === "complete" && (
        <Text color="gray" dimColor> {activity.durationMs}ms</Text>
      )}
    </Box>
  );
};

function getStatusIcon(status: Activity["status"]): string {
  switch (status) {
    case "pending": return "○";
    case "running": return "◐";
    case "complete": return "✓";
    case "error": return "✗";
  }
}

function getStatusColor(status: Activity["status"]): string {
  switch (status) {
    case "pending": return "gray";
    case "running": return "yellow";
    case "complete": return "green";
    case "error": return "red";
  }
}
```

### 6.6 UsageStats Component

```tsx
// apps/cli/src/components/UsageStats.tsx

import React from "react";
import { Box, Text } from "ink";

type Props = {
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
};

export const UsageStats: React.FC<Props> = ({ usage }) => {
  const { inputTokens, outputTokens, totalCostUsd } = usage;

  return (
    <Box marginTop={1}>
      <Text color="gray">
        Tokens: {inputTokens.toLocaleString()} in / {outputTokens.toLocaleString()} out
        {" | "}
        Cost: ${totalCostUsd.toFixed(4)}
      </Text>
    </Box>
  );
};
```

### 6.7 useStreamingQuery Hook

```tsx
// apps/cli/src/hooks/useStreamingQuery.ts

import { useState, useEffect, useCallback } from "react";
import type { ContentItem, UserProfile, WritingKit } from "@looplia-core/core";
import type { StreamingEvent } from "@looplia-core/provider";
import type { Activity } from "../components/ActivityItem";

type StreamingProvider = {
  buildKitStreaming: (
    content: ContentItem,
    user: UserProfile
  ) => AsyncGenerator<StreamingEvent, void>;
};

type QueryState = {
  status: "idle" | "running" | "complete" | "error";
  sessionId: string;
  progress: number;
  currentStep: string;
  activities: Activity[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  };
  result: WritingKit | null;
  error: Error | null;
};

export function useStreamingQuery(
  provider: StreamingProvider,
  content: ContentItem,
  user: UserProfile
): QueryState {
  const [state, setState] = useState<QueryState>({
    status: "idle",
    sessionId: "",
    progress: 0,
    currentStep: "Initializing...",
    activities: [],
    usage: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0 },
    result: null,
    error: null,
  });

  const addActivity = useCallback((activity: Omit<Activity, "id">) => {
    setState((prev) => ({
      ...prev,
      activities: [
        ...prev.activities,
        { ...activity, id: `activity-${prev.activities.length}` },
      ],
    }));
  }, []);

  const updateLastActivity = useCallback(
    (updates: Partial<Activity>) => {
      setState((prev) => {
        const activities = [...prev.activities];
        const lastIndex = activities.length - 1;
        if (lastIndex >= 0) {
          activities[lastIndex] = { ...activities[lastIndex], ...updates };
        }
        return { ...prev, activities };
      });
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    async function runQuery() {
      setState((prev) => ({ ...prev, status: "running" }));

      try {
        const stream = provider.buildKitStreaming(content, user);

        for await (const event of stream) {
          if (!mounted) break;

          switch (event.type) {
            case "session_start":
              setState((prev) => ({
                ...prev,
                sessionId: event.sessionId,
                currentStep: "Session started",
              }));
              break;

            case "thinking":
              setState((prev) => ({
                ...prev,
                currentStep: event.content.slice(0, 60) + "...",
              }));
              break;

            case "tool_start":
              addActivity({
                status: "running",
                type: event.tool === "Skill" ? "skill" : "read",
                label: formatToolStart(event),
              });
              break;

            case "tool_end":
              updateLastActivity({
                status: event.success ? "complete" : "error",
                durationMs: event.durationMs,
                detail: event.summary,
              });
              break;

            case "progress":
              setState((prev) => ({
                ...prev,
                progress: event.percent,
                currentStep: event.message,
              }));
              break;

            case "complete":
              setState((prev) => ({
                ...prev,
                status: "complete",
                progress: 100,
                currentStep: "Complete!",
                result: event.result as WritingKit,
                usage: event.usage,
              }));
              break;

            case "error":
              if (!event.recoverable) {
                setState((prev) => ({
                  ...prev,
                  status: "error",
                  error: new Error(event.message),
                }));
              }
              break;
          }
        }
      } catch (err) {
        if (mounted) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    }

    runQuery();

    return () => {
      mounted = false;
    };
  }, [provider, content, user, addActivity, updateLastActivity]);

  return state;
}

function formatToolStart(event: { tool: string; input: { path?: string; skill?: string } }): string {
  if (event.tool === "Read" && event.input.path) {
    const filename = event.input.path.split("/").pop();
    return `Reading ${filename}`;
  }
  if (event.tool === "Skill" && event.input.skill) {
    return `Running ${event.input.skill}`;
  }
  return `Using ${event.tool}`;
}
```

---

## 7. Provider Changes

### 7.1 Streaming Provider Interface

```typescript
// packages/provider/src/claude-agent-sdk/streaming/index.ts

export * from "./types";
export * from "./transformer";
export * from "./progress-tracker";
```

```typescript
// packages/provider/src/ports/writing-kit-provider.ts (updated)

import type { ContentItem, UserProfile, WritingKit } from "@looplia-core/core";
import type { ProviderResult, ProviderResultWithUsage } from "./common";
import type { StreamingEvent } from "../claude-agent-sdk/streaming";

/**
 * Provider interface for building writing kits
 */
export type WritingKitProvider = {
  /**
   * Build a complete writing kit (non-streaming)
   */
  buildKit(
    content: ContentItem,
    user: UserProfile
  ): Promise<ProviderResultWithUsage<WritingKit>>;

  /**
   * Build a complete writing kit with streaming events
   * @returns AsyncGenerator that yields events and returns the final result
   */
  buildKitStreaming(
    content: ContentItem,
    user: UserProfile
  ): AsyncGenerator<StreamingEvent, ProviderResultWithUsage<WritingKit>>;
};
```

### 7.2 Streaming Query Execution

```typescript
// packages/provider/src/claude-agent-sdk/utils/query-wrapper-streaming.ts

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { StreamingEvent, CompleteEvent } from "../streaming/types";
import { transformSdkMessage, type TransformContext } from "../streaming/transformer";
import { ProgressTracker } from "../streaming/progress-tracker";
import { createQueryLogger } from "../logger";
import { extractContentIdFromPrompt } from "./query-wrapper";

/**
 * Execute agentic query with streaming events
 *
 * Key SDK options:
 * - includePartialMessages: true - Enables stream_event messages for real-time UI
 * - allowedTools: ["Read", "Skill"] - Tools the agent can use
 * - outputFormat: json_schema - Structured output validation
 */
export async function* executeAgenticQueryStreaming<T>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  config: ClaudeAgentConfig
): AsyncGenerator<StreamingEvent, AgenticQueryResult<T>> {
  const resolvedConfig = resolveConfig(config);
  const workspace = config.workspace ?? await getOrInitWorkspace(
    resolvedConfig.workspace,
    resolvedConfig.useFilesystemExtensions
  );

  // Initialize logging
  const contentId = extractContentIdFromPrompt(prompt);
  const logger = createQueryLogger(workspace);
  if (contentId) {
    logger.init(contentId);
    logger.log({ type: "prompt", content: prompt });
  }

  // Initialize progress tracking
  const progressTracker = new ProgressTracker();

  // Context for SDK message transformation
  // Uses Map to correlate tool_use IDs with tool_result messages
  const context: TransformContext = {
    model: resolvedConfig.model,
    sessionId: "",
    startTime: Date.now(),
    pendingTools: new Map(),
    cumulativeUsage: { inputTokens: 0, outputTokens: 0 },
  };

  // Execute SDK query with streaming enabled
  const result = query({
    prompt,
    options: {
      model: resolvedConfig.model,
      cwd: workspace,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      allowedTools: ["Read", "Skill"],
      outputFormat: {
        type: "json_schema",
        schema: jsonSchema,
      },
      // CRITICAL: Enable partial messages for real-time streaming
      // Without this, we only get complete assistant/user messages
      includePartialMessages: true,
    },
  });

  let finalResult: AgenticQueryResult<T> | undefined;

  for await (const message of result) {
    // Log all messages for debugging
    if (contentId) {
      logger.log(message as Record<string, unknown>);
    }

    // Transform SDK message to streaming events
    // Note: Generator function can yield multiple events per message
    // (e.g., assistant message with multiple content blocks)
    for (const event of transformSdkMessage(
      message as Record<string, unknown>,
      context
    )) {
      // Check for progress update on skill invocations
      if (event.type === "tool_start" && event.tool === "Skill") {
        const progressEvent = progressTracker.onToolStart(event.tool, event.input);
        if (progressEvent) {
          yield progressEvent;
        }
      }

      // Yield the event to UI
      yield event;

      // Capture final result
      if (event.type === "complete") {
        const completeEvent = event as CompleteEvent<T>;
        finalResult = {
          success: completeEvent.subtype === "success",
          data: completeEvent.result,
          usage: {
            inputTokens: completeEvent.usage.inputTokens,
            outputTokens: completeEvent.usage.outputTokens,
            totalCostUsd: completeEvent.usage.totalCostUsd,
          },
          sessionId: context.sessionId,
        };

        // Handle non-success subtypes
        if (completeEvent.subtype !== "success") {
          finalResult = {
            success: false,
            error: {
              type: "unknown",
              message: `Agent execution ended with: ${completeEvent.subtype}`,
            },
            usage: finalResult.usage,
            sessionId: context.sessionId,
          };
        }
      }
    }
  }

  logger.close();

  // Yield final progress event
  yield progressTracker.onComplete();

  // Return final result
  return finalResult ?? {
    success: false,
    error: { type: "unknown", message: "No result received" },
  };
}
```

### 7.3 Updated Writing Kit Provider

```typescript
// packages/provider/src/claude-agent-sdk/writing-kit-provider.ts (updated)

import type { ContentItem, UserProfile, WritingKit } from "@looplia-core/core";
import type { WritingKitProvider as IWritingKitProvider } from "../ports";
import type { StreamingEvent } from "./streaming";
import { executeAgenticQuery, executeAgenticQueryStreaming } from "./utils";
import { buildWritingKitPrompt, writingKitSchema } from "./prompts";

export function createClaudeWritingKitProvider(
  config?: ClaudeAgentConfig
): IWritingKitProvider {
  return {
    async buildKit(content, user) {
      const prompt = buildWritingKitPrompt(content, user);
      return executeAgenticQuery<WritingKit>(prompt, writingKitSchema, config);
    },

    async *buildKitStreaming(content, user) {
      const prompt = buildWritingKitPrompt(content, user);
      return yield* executeAgenticQueryStreaming<WritingKit>(
        prompt,
        writingKitSchema,
        config
      );
    },
  };
}
```

---

## 8. CLI Changes

### 8.1 Updated Dependencies

```json
// apps/cli/package.json
{
  "name": "@looplia-core/cli",
  "version": "0.3.4",
  "dependencies": {
    "@looplia-core/core": "workspace:*",
    "@looplia-core/provider": "workspace:*",
    "ink": "^5.0.1",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@looplia-core/config": "workspace:*",
    "@types/node": "^22.0.0",
    "tsup": "^8.5.1",
    "typescript": "^5.0.0"
  }
}
```

### 8.2 Updated Kit Command

```typescript
// apps/cli/src/commands/kit.ts (updated sections)

import { isInteractive } from "../utils/terminal";
import { renderKitBuilder } from "../components/KitBuilderUI";

export async function runKitCommand(args: string[]): Promise<void> {
  // ... existing argument parsing ...

  const noStreaming = hasFlag(parsed, "no-streaming");
  const interactive = isInteractive() && !noStreaming;

  // ... existing content/user loading ...

  const provider = createProvider(useMock, workspace);

  if (interactive) {
    // Use streaming UI
    await new Promise<void>((resolve, reject) => {
      renderKitBuilder({
        provider,
        content,
        user,
        format: format as "json" | "markdown",
        onComplete: (result) => {
          const output = format === "markdown"
            ? formatKitAsMarkdown(result)
            : JSON.stringify(result, null, 2);
          writeOutput(output, outputPath);
          resolve();
        },
        onError: (error) => {
          console.error(`Error: ${error.message}`);
          reject(error);
        },
      });
    });
  } else {
    // Legacy non-streaming mode
    console.error("⏳ Building writing kit...");
    const result = await provider.buildKit(content, user);

    if (!result.success) {
      console.error(`Error: ${result.error.message}`);
      process.exit(1);
    }

    const output = format === "markdown"
      ? formatKitAsMarkdown(result.data)
      : JSON.stringify(result.data, null, 2);
    writeOutput(output, outputPath);
  }
}
```

### 8.3 Terminal Detection Utility

```typescript
// apps/cli/src/utils/terminal.ts

/**
 * Check if running in an interactive terminal
 */
export function isInteractive(): boolean {
  // Check if stdout is a TTY
  if (!process.stdout.isTTY) {
    return false;
  }

  // Check for CI environments
  if (process.env.CI === "true") {
    return false;
  }

  // Check for common non-interactive indicators
  if (process.env.TERM === "dumb") {
    return false;
  }

  return true;
}

/**
 * Get terminal dimensions
 */
export function getTerminalSize(): { columns: number; rows: number } {
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}
```

### 8.4 Updated Help Text

```typescript
function printKitHelp(): void {
  console.log(`
looplia kit - Build a complete writing kit from content

Usage:
  looplia kit --file <path> [options]
  looplia kit --session-id <id> [options]

Options:
  --file, -f         Path to content file (creates new session)
  --session-id       Session ID to continue (resumes existing session)
  --format           Output format: json, markdown (default: json)
  --output, -o       Output file path (default: stdout)
  --topics           Comma-separated topics of interest
  --tone             Writing tone: beginner, intermediate, expert, mixed
  --word-count       Target word count (default: 1000, range: 100-10000)
  --no-streaming     Disable streaming UI (use legacy output)
  --mock, -m         Use mock providers (no API key required)
  --help, -h         Show this help

Note: Either --file or --session-id is required (but not both)
      Streaming UI is disabled automatically when piping output

Environment:
  ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN  Required unless --mock

Example:
  looplia kit --file ./article.txt --topics "ai,productivity"
  looplia kit --file ./notes.md --no-streaming | jq .summary
`);
}
```

---

## 9. Implementation Plan

### 9.1 Phase 1: Streaming Infrastructure (Provider)

| Task | Files | Priority |
|------|-------|----------|
| Define StreamingEvent types | `packages/provider/src/claude-agent-sdk/streaming/types.ts` | P0 |
| Create SDK message transformer | `packages/provider/src/claude-agent-sdk/streaming/transformer.ts` | P0 |
| Implement ProgressTracker | `packages/provider/src/claude-agent-sdk/streaming/progress-tracker.ts` | P0 |
| Add streaming query execution | `packages/provider/src/claude-agent-sdk/utils/query-wrapper-streaming.ts` | P0 |
| Update WritingKitProvider | `packages/provider/src/claude-agent-sdk/writing-kit-provider.ts` | P0 |
| Export streaming module | `packages/provider/src/claude-agent-sdk/index.ts` | P0 |

### 9.2 Phase 2: Ink Components (CLI)

| Task | Files | Priority |
|------|-------|----------|
| Add Ink dependencies | `apps/cli/package.json` | P0 |
| Create ProgressBar component | `apps/cli/src/components/ProgressBar.tsx` | P0 |
| Create ActivityLog component | `apps/cli/src/components/ActivityLog.tsx` | P0 |
| Create ActivityItem component | `apps/cli/src/components/ActivityItem.tsx` | P0 |
| Create UsageStats component | `apps/cli/src/components/UsageStats.tsx` | P1 |
| Create Spinner component | `apps/cli/src/components/Spinner.tsx` | P1 |
| Create Header component | `apps/cli/src/components/Header.tsx` | P1 |
| Create KitBuilderUI wrapper | `apps/cli/src/components/KitBuilderUI.tsx` | P0 |
| Implement useStreamingQuery hook | `apps/cli/src/hooks/useStreamingQuery.ts` | P0 |

### 9.3 Phase 3: Integration

| Task | Files | Priority |
|------|-------|----------|
| Add terminal detection | `apps/cli/src/utils/terminal.ts` | P0 |
| Update kit command | `apps/cli/src/commands/kit.ts` | P0 |
| Update summarize command | `apps/cli/src/commands/summarize.ts` | P1 |
| Update help text | `apps/cli/src/commands/kit.ts` | P1 |
| Update version | `apps/cli/src/index.ts` | P1 |

### 9.4 Phase 4: Testing & Polish

| Task | Files | Priority |
|------|-------|----------|
| Unit tests for transformer | `packages/provider/test/streaming/` | P0 |
| Component tests | `apps/cli/test/components/` | P1 |
| E2E tests with streaming | `apps/cli/test/e2e/` | P1 |
| Update Docker image | `Dockerfile`, `docker.package.json` | P2 |

---

## 10. File Changes

### 10.1 New Files

| File | Purpose |
|------|---------|
| `packages/provider/src/claude-agent-sdk/streaming/types.ts` | StreamingEvent type definitions |
| `packages/provider/src/claude-agent-sdk/streaming/transformer.ts` | SDK message transformer |
| `packages/provider/src/claude-agent-sdk/streaming/progress-tracker.ts` | Progress inference logic |
| `packages/provider/src/claude-agent-sdk/streaming/index.ts` | Streaming module exports |
| `packages/provider/src/claude-agent-sdk/utils/query-wrapper-streaming.ts` | Streaming query execution |
| `apps/cli/src/components/KitBuilderUI.tsx` | Main streaming UI component |
| `apps/cli/src/components/ProgressBar.tsx` | Progress bar component |
| `apps/cli/src/components/ProgressSection.tsx` | Progress section wrapper |
| `apps/cli/src/components/ActivityLog.tsx` | Activity log component |
| `apps/cli/src/components/ActivityItem.tsx` | Single activity item |
| `apps/cli/src/components/UsageStats.tsx` | Token/cost display |
| `apps/cli/src/components/Header.tsx` | Session header |
| `apps/cli/src/components/Spinner.tsx` | Loading spinner |
| `apps/cli/src/components/ResultSection.tsx` | Final result display |
| `apps/cli/src/components/index.ts` | Component exports |
| `apps/cli/src/hooks/useStreamingQuery.ts` | Streaming query hook |
| `apps/cli/src/hooks/useActivityLog.ts` | Activity log state hook |
| `apps/cli/src/utils/terminal.ts` | Terminal detection utilities |
| `docs/DESIGN-0.3.4.md` | This document |

### 10.2 Modified Files

| File | Changes |
|------|---------|
| `packages/provider/package.json` | Bump to 0.3.4 |
| `packages/provider/src/claude-agent-sdk/writing-kit-provider.ts` | Add `buildKitStreaming` method |
| `packages/provider/src/claude-agent-sdk/index.ts` | Export streaming module |
| `packages/provider/src/ports/writing-kit-provider.ts` | Add streaming method to interface |
| `apps/cli/package.json` | Add ink, react dependencies; bump to 0.3.4 |
| `apps/cli/src/commands/kit.ts` | Integrate streaming UI |
| `apps/cli/src/commands/summarize.ts` | Add streaming support |
| `apps/cli/src/index.ts` | Update VERSION to "0.3.4" |
| `apps/cli/tsconfig.json` | Add JSX support for Ink |
| `packages/core/package.json` | Bump to 0.3.4 |

### 10.3 tsconfig.json Updates

```json
// apps/cli/tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    // ... existing options
  }
}
```

---

## 11. Usage Guide

### 11.1 Basic Usage (Streaming Enabled)

```bash
# Interactive streaming UI (default when TTY)
$ looplia kit --file ./article.md

┌─────────────────────────────────────────────────────┐
│ Looplia Kit Builder                                 │
│ Session: article-2025-12-09-abc123                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Progress: ████████████████░░░░░░░░ 65%             │
│ Current: Generating writing ideas...                │
│                                                     │
│ Activity:                                           │
│   ✓ Read content.md (1,234 chars)                  │
│   ✓ content-analyzer (3,421ms)                     │
│   ⏳ idea-generator...                              │
│   ○ writing-kit-builder                            │
│                                                     │
│ Tokens: 2,345 in / 892 out | Cost: $0.0156         │
└─────────────────────────────────────────────────────┘
```

### 11.2 Non-Streaming Mode

```bash
# Explicit non-streaming (for scripts)
$ looplia kit --file ./article.md --no-streaming
✓ New session created: article-2025-12-09-abc123
⏳ Building writing kit...
{"contentId": "...", "summary": {...}, ...}

# Automatically disabled when piping
$ looplia kit --file ./article.md | jq .summary.headline
"AI Writing Tools: A Complete Guide"

# Disabled in CI environments
$ CI=true looplia kit --file ./article.md
```

### 11.3 Output Formats

```bash
# JSON output (default)
$ looplia kit --file ./article.md --format json

# Markdown output
$ looplia kit --file ./article.md --format markdown

# Save to file
$ looplia kit --file ./article.md -o writing-kit.json
```

---

## 12. Testing Strategy

### 12.1 Unit Tests - Streaming Module

```typescript
// packages/provider/test/streaming/transformer.test.ts

describe("transformSdkMessage", () => {
  let mockContext: TransformContext;

  beforeEach(() => {
    mockContext = {
      model: "claude-haiku-4-5-20251001",
      sessionId: "",
      startTime: Date.now(),
      pendingTools: new Map(),
      cumulativeUsage: { inputTokens: 0, outputTokens: 0 },
    };
  });

  it("transforms system init message to session_start event", () => {
    const message = {
      type: "system",
      subtype: "init",
      session_id: "abc123",
      model: "claude-haiku-4-5-20251001",
      tools: ["Read", "Skill"],
    };
    const events = [...transformSdkMessage(message, mockContext)];

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "session_start",
      sessionId: "abc123",
      model: "claude-haiku-4-5-20251001",
      availableTools: ["Read", "Skill"],
      timestamp: expect.any(Number),
    });
    expect(mockContext.sessionId).toBe("abc123");
  });

  it("extracts tool_use blocks from assistant message", () => {
    const message = {
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", id: "toolu_123", name: "Read", input: { file_path: "content.md" } },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };
    const events = [...transformSdkMessage(message, mockContext)];

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "tool_start",
      toolUseId: "toolu_123",
      tool: "Read",
      input: { path: "content.md" },
    });
    expect(mockContext.pendingTools.has("toolu_123")).toBe(true);
  });

  it("extracts tool_result blocks from user message", () => {
    // Setup: add pending tool
    mockContext.pendingTools.set("toolu_123", { name: "Read", startTime: Date.now() - 100 });

    const message = {
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "toolu_123", content: "file contents", is_error: false },
        ],
      },
    };
    const events = [...transformSdkMessage(message, mockContext)];

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "tool_end",
      toolUseId: "toolu_123",
      tool: "Read",
      success: true,
    });
    expect(mockContext.pendingTools.has("toolu_123")).toBe(false);
  });

  it("handles assistant message with multiple content blocks", () => {
    const message = {
      type: "assistant",
      message: {
        content: [
          { type: "thinking", thinking: "Let me analyze this..." },
          { type: "text", text: "I found the following:" },
          { type: "tool_use", id: "toolu_456", name: "Skill", input: { skill: "content-analyzer" } },
        ],
        usage: { input_tokens: 200, output_tokens: 100 },
      },
    };
    const events = [...transformSdkMessage(message, mockContext)];

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("thinking");
    expect(events[1].type).toBe("text");
    expect(events[2].type).toBe("tool_start");
  });

  it("transforms result message with metrics", () => {
    mockContext.sessionId = "session_123";
    const message = {
      type: "result",
      subtype: "success",
      structured_output: { summary: "test" },
      usage: { input_tokens: 1000, output_tokens: 500 },
      total_cost_usd: 0.015,
      duration_ms: 5000,
      duration_api_ms: 4500,
      num_turns: 3,
    };
    const events = [...transformSdkMessage(message, mockContext)];

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "complete",
      subtype: "success",
      result: { summary: "test" },
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalCostUsd: 0.015,
      },
      metrics: {
        durationMs: 5000,
        durationApiMs: 4500,
        numTurns: 3,
      },
      sessionId: "session_123",
    });
  });

  it("yields no events for unknown message types", () => {
    const message = { type: "unknown_type" };
    const events = [...transformSdkMessage(message, mockContext)];
    expect(events).toHaveLength(0);
  });
});
```

### 12.2 Unit Tests - Progress Tracker

```typescript
// packages/provider/test/streaming/progress-tracker.test.ts

describe("ProgressTracker", () => {
  it("updates progress on content-analyzer skill", () => {
    const tracker = new ProgressTracker();
    const event = tracker.onToolStart("Skill", { skill: "content-analyzer" });

    expect(event).toEqual({
      type: "progress",
      step: "analyzing",
      percent: 25,
      message: "Analyzing content...",
      timestamp: expect.any(Number),
    });
  });

  it("returns 100% on complete", () => {
    const tracker = new ProgressTracker();
    const event = tracker.onComplete();

    expect(event.percent).toBe(100);
  });
});
```

### 12.3 Component Tests

```typescript
// apps/cli/test/components/ProgressBar.test.tsx

import { render } from "ink-testing-library";
import { ProgressBar } from "../../src/components/ProgressBar";

describe("ProgressBar", () => {
  it("renders correct fill for 50%", () => {
    const { lastFrame } = render(<ProgressBar percent={50} width={10} />);
    expect(lastFrame()).toContain("█████");
    expect(lastFrame()).toContain("░░░░░");
    expect(lastFrame()).toContain("50%");
  });

  it("renders 100% as complete", () => {
    const { lastFrame } = render(<ProgressBar percent={100} width={10} />);
    expect(lastFrame()).toContain("██████████");
    expect(lastFrame()).not.toContain("░");
  });
});
```

### 12.4 E2E Tests

```bash
# E2E test: Streaming mode produces valid output
$ looplia kit --file ./test/fixtures/article.md --format json > output.json
$ jq -e '.contentId' output.json && echo "PASS" || echo "FAIL"

# E2E test: Non-streaming mode works
$ looplia kit --file ./test/fixtures/article.md --no-streaming --format json > output.json
$ jq -e '.summary.headline' output.json && echo "PASS" || echo "FAIL"

# E2E test: Pipe mode auto-disables streaming
$ looplia kit --file ./test/fixtures/article.md | jq -e '.contentId' && echo "PASS" || echo "FAIL"
```

### 12.5 Visual Testing

Manual testing checklist for streaming UI:

- [ ] Progress bar updates smoothly
- [ ] Activity items appear in correct order
- [ ] Spinners animate correctly
- [ ] Colors render correctly in light/dark terminals
- [ ] Terminal resize handled gracefully
- [ ] Ctrl+C interrupts cleanly
- [ ] Final result displays correctly

---

## 13. Future Considerations

### 13.1 Potential Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| **Interactive Mode** | Allow user input during execution (pause, skip, modify) | P2 |
| **Parallel Builds** | Process multiple files simultaneously | P2 |
| **Progress Persistence** | Resume interrupted builds from checkpoint | P3 |
| **Web Dashboard** | Browser-based progress monitoring | P3 |
| **Notification Hooks** | Desktop notifications on completion | P3 |

### 13.2 Performance Considerations

- **Memory**: Ink uses React reconciliation; keep activity log bounded
- **CPU**: Limit UI update frequency to 60fps max
- **Network**: Streaming doesn't reduce latency, only improves perceived performance

### 13.3 Accessibility

- Consider color-blind friendly progress indicators
- Provide text-only mode for screen readers
- Support high-contrast themes

---

## Appendix A: Design Review Notes

### A.1 SDK Message Structure Corrections

The initial design incorrectly assumed `tool_use` and `tool_result` were top-level message types. After reviewing the official Claude Agent SDK documentation, the following corrections were made:

| Original Assumption | Corrected Understanding |
|---------------------|-------------------------|
| `tool_use` is a message type | `tool_use` is a **content block** inside `assistant.message.content[]` |
| `tool_result` is a message type | `tool_result` is a **content block** inside `user.message.content[]` |
| Tool timing is tracked per-message | Tool timing requires correlating `tool_use_id` across messages |
| Streaming works by default | Requires `includePartialMessages: true` for `stream_event` messages |

### A.2 Key SDK Message Types

The SDK returns these top-level message types:

1. **`system`** (subtypes: `init`, `compact_boundary`) - Session initialization
2. **`assistant`** - Agent responses containing content blocks (text, thinking, tool_use)
3. **`user`** - Tool results containing tool_result blocks
4. **`stream_event`** - Real-time deltas (only with `includePartialMessages: true`)
5. **`result`** - Final output with structured_output and metrics

### A.3 Tool Correlation Pattern

Tools are correlated across messages using `tool_use_id`:

```
assistant message:
  content: [
    { type: 'tool_use', id: 'toolu_123', name: 'Read', input: {...} }
  ]
    ↓ (later)
user message:
  content: [
    { type: 'tool_result', tool_use_id: 'toolu_123', content: '...', is_error: false }
  ]
```

The transformer maintains a `pendingTools` Map to track timing and correlate results.

### A.4 Streaming Mode Considerations

| Mode | SDK Option | Events Received |
|------|------------|-----------------|
| Batch | (default) | Complete assistant/user messages only |
| Streaming | `includePartialMessages: true` | Additional `stream_event` messages with deltas |

For real-time UI updates, streaming mode is required. However, batch mode may be sufficient for simpler progress indicators based on tool_use blocks.

### A.5 Result Message Fields

The SDK result message provides rich execution metrics:

```typescript
{
  type: 'result',
  subtype: 'success' | 'error_max_turns' | 'error_during_execution',
  structured_output: T,        // JSON schema output
  duration_ms: number,         // Total time including SDK overhead
  duration_api_ms: number,     // API-only time
  num_turns: number,           // Agent iterations
  total_cost_usd: number,      // Estimated cost
  usage: { input_tokens, output_tokens, cache_* },
  permission_denials: [...],   // Blocked tool calls
}
```

These metrics should be displayed in the UsageStats component.

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.3.4.0 | 2025-12-09 | Design review: Corrected SDK message structure, added `includePartialMessages`, fixed transformer to handle content blocks |
| 0.3.4.0-draft | 2025-12-09 | Initial design: Streaming CLI UI with Ink |
