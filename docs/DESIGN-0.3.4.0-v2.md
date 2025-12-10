# Looplia Core – Technical Design Document v0.3.4.0-v2

**Version:** 0.3.4.0-v2
**Status:** Proposed
**Last Updated:** 2025-12-10

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Analysis](#2-problem-analysis)
3. [Design Principles](#3-design-principles)
4. [Architecture Overview](#4-architecture-overview)
5. [Layer 1: CLI Commands](#5-layer-1-cli-commands)
6. [Layer 2: Looplia Runtime](#6-layer-2-looplia-runtime)
7. [Layer 3: Providers](#7-layer-3-providers)
8. [Layer 4: Agent (SDK)](#8-layer-4-agent-sdk)
9. [Streaming UI Integration](#9-streaming-ui-integration)
10. [File Structure](#10-file-structure)
11. [Implementation Plan](#11-implementation-plan)
12. [Migration Guide](#12-migration-guide)
13. [Testing Strategy](#13-testing-strategy)

---

## 1. Executive Summary

### 1.1 The Real Problem

v0.3.4.0 introduced streaming UI components (Ink/React), but revealed a deeper issue: **the CLI architecture doesn't align with the agentic concept**.

Current commands (kit.ts, summarize.ts) have cognitive complexity of 25-26 (limit: 15) because they handle:
- Argument parsing and validation
- API key checking
- Workspace setup
- User profile loading with CLI overrides
- Content loading (file vs session-id branching)
- Provider selection (mock vs real)
- Execution mode (streaming vs batch)
- Output formatting

**This violates AGENTIC_CONCEPT.md**: "The agent makes all decisions. The CLI just triggers and displays."

### 1.2 The Solution

Introduce a **Looplia Runtime** layer that encapsulates execution context:

```
┌─────────────────────────────────────────────────────────────────┐
│ CLI COMMAND (complexity ≤5)                                      │
│ Role: Parse args → Call Runtime → Render result                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│ LOOPLIA RUNTIME (complexity ≤10 per method)                      │
│ Role: Environment setup → Session management → Execute provider  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│ PROVIDER (complexity ≤8)                                         │
│ Role: Build ONE prompt → Call SDK → Return structured result     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│ AGENT (via Claude SDK)                                           │
│ Role: Read CLAUDE.md → Make decisions → Invoke subagents         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Outcomes

| Metric | Before (v0.3.4.0) | After (v0.3.4.0-v2) |
|--------|-------------------|---------------------|
| `runKitCommand` complexity | 25 | ≤5 |
| `runSummarizeCommand` complexity | 26 | ≤5 |
| Lines per command file | 350+ | ~30 |
| New command effort | High (copy/paste, adapt) | Low (parser + renderer) |
| Testability | Coupled to CLI | Runtime testable independently |

---

## 2. Problem Analysis

### 2.1 Architectural Mismatch

**AGENTIC_CONCEPT.md defines the flow:**
```
CLI Command (minimal) → ONE prompt → Agent (autonomous)
```

**Current implementation flow:**
```
CLI Command (fat orchestrator)
    ├─► Parse args (8 different flags)
    ├─► Check API key (3 conditions)
    ├─► Setup workspace (async with options)
    ├─► Load user profile (merge with CLI args)
    ├─► Load content (file vs session-id branch)
    ├─► Create provider (mock vs real branch)
    ├─► Execute (streaming vs batch branch)
    └─► Format output (json vs markdown)
```

### 2.2 Complexity Sources in kit.ts

| Source | Lines | Complexity Added |
|--------|-------|------------------|
| Argument validation (file XOR session-id) | 252-263 | +4 |
| API key checking | 130-145 | +3 |
| Content loading branch (file vs session-id) | 288-313 | +6 |
| Streaming vs non-streaming | 321-357 | +5 |
| User profile loading with overrides | 210-232 | +3 |
| Format conditional (json vs markdown) | 335-338, 351-354 | +2 |
| Error handling branches | scattered | +4 |
| **Total** | | **~27** |

### 2.3 Complexity Sources in summarize.ts

| Source | Lines | Complexity Added |
|--------|-------|------------------|
| API key checking (inline, complex negation) | 85-98 | +4 |
| Streaming vs non-streaming | 118-182 | +6 |
| Session info display (nested conditionals) | 136-142, 165-179 | +4 |
| Provider selection (mock vs real) | 150-152 | +2 |
| Result handling | 159-181 | +4 |
| **Total** | | **~26** |

### 2.4 The Root Cause

The CLI is doing **orchestration work** that should be delegated to:
1. **Runtime layer** - Environment and execution management
2. **Agent itself** - Business logic decisions

---

## 3. Design Principles

### 3.1 Single Responsibility Per Layer

| Layer | Single Responsibility |
|-------|----------------------|
| CLI Command | Parse args, delegate to runtime, format output |
| Runtime | Manage execution context, orchestrate lifecycle |
| Provider | Transform input to prompt, call SDK |
| Agent | Make all business decisions autonomously |

### 3.2 Bounded Complexity

| Component | Max Complexity | Rationale |
|-----------|---------------|-----------|
| Command functions | 5 | Thin wrapper only |
| Parser functions | 8 | Straightforward arg extraction |
| Renderer functions | 8 | Output formatting only |
| Runtime methods | 10 | Core orchestration |
| Provider methods | 8 | Minimal prompt building |

### 3.3 Extensibility Pattern

Adding a new command should require:
1. **Parser** - `parsers/new-command-parser.ts` (~50 lines)
2. **Renderer** - `renderers/new-command-renderer.ts` (~50 lines)
3. **Runtime method** - Add `executeNewCommand()` to Runtime (~30 lines)
4. **Command** - `commands/new-command.ts` (~20 lines)

Total: ~150 lines for a new command vs 350+ lines today.

### 3.4 Alignment with Agentic Concept

The CLI should embody: **"One command = One prompt = One agent session"**

```typescript
// IDEAL: Command is trivial
export async function runKitCommand(args: string[]): Promise<void> {
  const config = parseKitArgs(args);
  if (config.help) { printKitHelp(); return; }

  const runtime = createRuntime(config);
  const result = await runtime.executeKit(config);

  renderKitResult(result, config);
}
```

---

## 4. Architecture Overview

### 4.1 Layered Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER TERMINAL                                       │
│                                                                                 │
│  $ looplia kit --file article.md --topics "ai,safety" --tone expert            │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: CLI COMMAND (apps/cli/src/commands/kit.ts)                            │
│  ───────────────────────────────────────────────────────────────────────────── │
│  Complexity: ≤5                                                                 │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  async function runKitCommand(args: string[]) {                          │   │
│  │    const config = parseKitArgs(args);      // → Parser                   │   │
│  │    if (config.help) { printKitHelp(); return; }                          │   │
│  │    validateKitInput(config);               // → Throws on invalid        │   │
│  │                                                                          │   │
│  │    const runtime = createRuntime(config);  // → Runtime factory          │   │
│  │    const result = await runtime.executeKit(config);                      │   │
│  │                                                                          │   │
│  │    renderKitResult(result, config);        // → Renderer                 │   │
│  │  }                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Imports: parseKitArgs, validateKitInput, printKitHelp (from parsers/)         │
│           createRuntime (from runtime/)                                         │
│           renderKitResult (from renderers/)                                     │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ KitConfig
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: LOOPLIA RUNTIME (apps/cli/src/runtime/looplia-runtime.ts)             │
│  ───────────────────────────────────────────────────────────────────────────── │
│  Complexity: ≤10 per method                                                     │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  class LoopliaRuntime {                                                  │   │
│  │    private context: ExecutionContext;                                    │   │
│  │    private sessionManager: SessionManager;                               │   │
│  │                                                                          │   │
│  │    constructor(config: RuntimeConfig) {                                  │   │
│  │      this.validateEnvironment(config);  // API key check                 │   │
│  │      this.context = buildContext(config);                                │   │
│  │      this.sessionManager = new SessionManager(this.context.workspace);   │   │
│  │    }                                                                     │   │
│  │                                                                          │   │
│  │    async executeKit(config: KitConfig): Promise<ExecutionResult> {       │   │
│  │      const sessionId = await this.sessionManager.prepare(config);        │   │
│  │      const userProfile = await this.loadUserProfile(config);             │   │
│  │      const provider = this.createKitProvider();                          │   │
│  │                                                                          │   │
│  │      return this.execute(                                                │   │
│  │        () => provider.buildKitStreaming(sessionId, userProfile),         │   │
│  │        { title: 'Writing Kit Builder', subtitle: config.title }          │   │
│  │      );                                                                   │   │
│  │    }                                                                     │   │
│  │                                                                          │   │
│  │    async executeSummarize(config: SummarizeConfig): Promise<...> { ... } │   │
│  │                                                                          │   │
│  │    private async execute<T>(generator, options): Promise<...> {          │   │
│  │      if (this.context.mode === 'streaming') {                            │   │
│  │        return renderStreamingQuery({...});                               │   │
│  │      }                                                                   │   │
│  │      return this.executeBatch(generator);                                │   │
│  │    }                                                                     │   │
│  │  }                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Dependencies: SessionManager, ExecutionContext, renderStreamingQuery           │
│  Handles: Workspace, API key, streaming vs batch, provider creation            │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ AsyncGenerator<StreamingEvent, T>
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: PROVIDER (packages/provider/src/claude-agent-sdk/)                    │
│  ───────────────────────────────────────────────────────────────────────────── │
│  Complexity: ≤8                                                                 │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  // writing-kit-provider.ts                                              │   │
│  │  async *buildKitStreaming(sessionId, userProfile) {                      │   │
│  │    const prompt = buildMinimalPrompt(sessionId, userProfile);            │   │
│  │    //            ↑ "Build WritingKit for session: contentItem/{id}"      │   │
│  │    //              Agent reads CLAUDE.md for full instructions           │   │
│  │                                                                          │   │
│  │    return yield* executeAgenticQueryStreaming(prompt, schema, config);   │   │
│  │  }                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Key: Provider builds MINIMAL prompt. Agent decides workflow.                   │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ ONE prompt
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: AGENT (via Claude SDK)                                                │
│  ───────────────────────────────────────────────────────────────────────────── │
│  Complexity: Defined in markdown (CLAUDE.md, agents/*.md, skills/*.md)          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Main Agent receives: "Build WritingKit for session: contentItem/{id}"   │   │
│  │                                                                          │   │
│  │  Agent autonomously:                                                     │   │
│  │    1. Reads CLAUDE.md (full instructions)                                │   │
│  │    2. Checks session state (which files exist?)                          │   │
│  │    3. Invokes content-analyzer subagent (if summary.json missing)        │   │
│  │    4. Invokes idea-generator subagent (if ideas.json missing)            │   │
│  │    5. Invokes writing-kit-builder subagent (if writing-kit.json missing) │   │
│  │    6. Returns structured JSON output                                     │   │
│  │                                                                          │   │
│  │  Key: Agent makes ALL workflow decisions. Not hardcoded in TypeScript.   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Tools available: Read, Write, Skill, Glob, Task, AgentOutputTool              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow Summary

```
User Input: looplia kit --file article.md --tone expert
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. PARSER (parseKitArgs)                                       │
│    Input:  ["--file", "article.md", "--tone", "expert"]       │
│    Output: KitConfig { file: "article.md", tone: "expert" }    │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. RUNTIME (executeKit)                                        │
│    ├─ Validate environment (API key)                          │
│    ├─ Setup workspace (~/.looplia)                            │
│    ├─ Prepare session (write content.md)                      │
│    ├─ Load user profile (merge with CLI args)                 │
│    ├─ Create provider                                          │
│    └─ Execute (streaming or batch)                            │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. PROVIDER (buildKitStreaming)                                │
│    ├─ Build minimal prompt                                     │
│    └─ Call SDK query() → AsyncGenerator<StreamingEvent>       │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. AGENT (autonomous execution)                                │
│    ├─ Read CLAUDE.md                                          │
│    ├─ Check session state                                      │
│    ├─ Invoke subagents as needed                              │
│    └─ Return WritingKit JSON                                   │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 5. RENDERER (renderKitResult)                                  │
│    ├─ Format as JSON or Markdown                              │
│    ├─ Write to file or stdout                                 │
│    └─ Display session info and next steps                     │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Layer 1: CLI Commands

### 5.1 Design Goal

Commands should be **thin wrappers** that:
1. Parse arguments
2. Validate input
3. Delegate to Runtime
4. Render output

**Target complexity: ≤5**

### 5.2 Kit Command (After)

```typescript
// apps/cli/src/commands/kit.ts (~30 lines)

import { createRuntime } from "../runtime";
import { parseKitArgs, validateKitInput, printKitHelp } from "../parsers/kit-parser";
import { renderKitResult } from "../renderers/kit-renderer";

export async function runKitCommand(args: string[]): Promise<void> {
  const config = parseKitArgs(args);

  if (config.help) {
    printKitHelp();
    return;
  }

  try {
    validateKitInput(config);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    printKitHelp();
    process.exit(1);
  }

  const runtime = createRuntime(config);
  const result = await runtime.executeKit(config);

  renderKitResult(result, config);
}
```

### 5.3 Summarize Command (After)

```typescript
// apps/cli/src/commands/summarize.ts (~30 lines)

import { createRuntime } from "../runtime";
import { parseSummarizeArgs, validateSummarizeInput, printSummarizeHelp } from "../parsers/summarize-parser";
import { renderSummarizeResult } from "../renderers/summarize-renderer";

export async function runSummarizeCommand(args: string[]): Promise<void> {
  const config = parseSummarizeArgs(args);

  if (config.help) {
    printSummarizeHelp();
    return;
  }

  try {
    validateSummarizeInput(config);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    printSummarizeHelp();
    process.exit(1);
  }

  const runtime = createRuntime(config);
  const result = await runtime.executeSummarize(config);

  renderSummarizeResult(result, config);
}
```

### 5.4 Command Template Pattern

All commands follow the same pattern:
```typescript
export async function runXxxCommand(args: string[]): Promise<void> {
  const config = parseXxxArgs(args);
  if (config.help) { printXxxHelp(); return; }

  try { validateXxxInput(config); }
  catch (e) { console.error(...); process.exit(1); }

  const runtime = createRuntime(config);
  const result = await runtime.executeXxx(config);

  renderXxxResult(result, config);
}
```

---

## 6. Layer 2: Looplia Runtime

### 6.1 Design Goal

The Runtime encapsulates **execution context** and provides a **unified interface** for all commands.

**Target complexity: ≤10 per method**

### 6.2 Core Types

```typescript
// apps/cli/src/runtime/types.ts

/**
 * Base configuration for all commands
 */
export type BaseConfig = {
  format: "json" | "markdown";
  outputPath?: string;
  noStreaming: boolean;
  mock: boolean;
};

/**
 * Kit-specific configuration
 */
export type KitConfig = BaseConfig & {
  help: boolean;
  file?: string;
  sessionId?: string;
  topics?: string[];
  tone?: string;
  wordCount?: number;
};

/**
 * Summarize-specific configuration
 */
export type SummarizeConfig = BaseConfig & {
  help: boolean;
  file: string;
};

/**
 * Execution context built from config
 */
export type ExecutionContext = {
  workspace: string;
  mode: "streaming" | "batch";
  mock: boolean;
};

/**
 * NOTE: We re-export AgenticQueryResult from provider, not create our own.
 * This ensures type compatibility with provider APIs.
 */
export type { AgenticQueryResult } from "@looplia-core/provider/claude-agent-sdk";

/**
 * Type chain (for reference):
 *
 * // From @looplia-core/core
 * type ProviderResult<T> =
 *   | { success: true; data: T }
 *   | { success: false; error: ProviderError };
 *
 * // From @looplia-core/provider/claude-agent-sdk
 * type ProviderUsage = { inputTokens: number; outputTokens: number; totalCostUsd: number; };
 * type ProviderResultWithUsage<T> = ProviderResult<T> & { usage?: ProviderUsage; };
 * type AgenticQueryResult<T> = ProviderResultWithUsage<T> & { sessionId?: string; };
 *
 * // Effective shape:
 * type AgenticQueryResult<T> =
 *   | { success: true; data: T; usage?: ProviderUsage; sessionId?: string }
 *   | { success: false; error: ProviderError; usage?: ProviderUsage; sessionId?: string };
 */
```

### 6.3 Looplia Runtime Class

```typescript
// apps/cli/src/runtime/looplia-runtime.ts

import type { ContentItem, WritingKit, ContentSummary, UserProfile } from "@looplia-core/core";
import type { WritingKitProvider } from "@looplia-core/provider";
import type { ClaudeSummarizerProvider } from "@looplia-core/provider/claude-agent-sdk";
import type { AgenticQueryResult } from "@looplia-core/provider/claude-agent-sdk";
import type { StreamingEvent } from "@looplia-core/provider/claude-agent-sdk";
import { createClaudeWritingKitProvider, createClaudeSummarizer } from "@looplia-core/provider/claude-agent-sdk";
import { createMockWritingKitProvider, createMockSummarizer } from "@looplia-core/core";
import { ensureWorkspace, readUserProfile } from "@looplia-core/provider/claude-agent-sdk";
import { renderStreamingQuery } from "../components";
import { SessionManager } from "./session-manager";
import type { ExecutionContext, KitConfig, SummarizeConfig, BaseConfig } from "./types";
import { isInteractive } from "../utils/terminal";

export class LoopliaRuntime {
  private context: ExecutionContext;
  private sessionManager: SessionManager;

  constructor(config: BaseConfig) {
    this.validateEnvironment(config);
    this.context = this.buildContext(config);
    this.sessionManager = new SessionManager(this.context.workspace);
  }

  /**
   * Execute kit building workflow
   *
   * NOTE: Provider API is buildKitStreaming(content: ContentItem, user: UserProfile)
   * SessionManager.prepare() returns ContentItem, not sessionId
   */
  async executeKit(config: KitConfig): Promise<AgenticQueryResult<WritingKit>> {
    // SessionManager returns ContentItem (loads from file or existing session)
    const content = await this.sessionManager.prepare({
      file: config.file,
      sessionId: config.sessionId,
    });

    const userProfile = await this.loadUserProfile(config);
    const provider = this.createKitProvider();

    // Provider takes ContentItem and UserProfile, not sessionId
    return this.execute<WritingKit>(
      () => provider.buildKitStreaming(content, userProfile),
      { title: "Writing Kit Builder", subtitle: content.title }
    );
  }

  /**
   * Execute summarization workflow
   *
   * NOTE: Provider API is summarizeStreaming(content: ContentItem, user?: UserProfile)
   */
  async executeSummarize(config: SummarizeConfig): Promise<AgenticQueryResult<ContentSummary>> {
    const content = await this.sessionManager.prepareFromFile(config.file);
    const provider = this.createSummarizeProvider();

    // Provider takes ContentItem, not sessionId
    return this.execute<ContentSummary>(
      () => provider.summarizeStreaming(content),
      { title: "Content Summarizer", subtitle: content.title }
    );
  }

  /**
   * Generic execute method - handles streaming vs batch
   *
   * NOTE: Generator return type is AgenticQueryResult<T> from provider
   */
  private async execute<T>(
    generator: () => AsyncGenerator<StreamingEvent, AgenticQueryResult<T>>,
    options: { title: string; subtitle?: string }
  ): Promise<AgenticQueryResult<T>> {
    if (this.context.mode === "streaming") {
      // renderStreamingQuery wraps the generator and returns result
      const { result, error } = await renderStreamingQuery<T>({
        title: options.title,
        subtitle: options.subtitle,
        streamGenerator: generator,
      });

      if (error) {
        return { success: false, error, sessionId: "" };
      }

      // Result from renderStreamingQuery needs to be unwrapped
      return result as AgenticQueryResult<T>;
    }

    // Batch mode - consume generator without UI
    return this.executeBatch(generator);
  }

  /**
   * Execute in batch mode (non-streaming)
   */
  private async executeBatch<T>(
    generator: () => AsyncGenerator<StreamingEvent, AgenticQueryResult<T>>
  ): Promise<AgenticQueryResult<T>> {
    console.error("⏳ Processing...");
    const stream = generator();
    let result = await stream.next();

    while (!result.done) {
      result = await stream.next();
    }

    return result.value;
  }

  /**
   * Validate environment (API key)
   */
  private validateEnvironment(config: BaseConfig): void {
    if (config.mock) return;

    if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      console.error("Error: ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN required");
      console.error("Get your API key from: https://console.anthropic.com");
      console.error("Or use --mock flag to run without API key");
      process.exit(1);
    }
  }

  /**
   * Build execution context from config
   */
  private buildContext(config: BaseConfig): ExecutionContext {
    const shouldStream = isInteractive() && !config.noStreaming && !config.mock;

    return {
      workspace: "", // Will be set by ensureWorkspace in SessionManager
      mode: shouldStream ? "streaming" : "batch",
      mock: config.mock,
    };
  }

  /**
   * Load user profile with CLI overrides
   */
  private async loadUserProfile(config: KitConfig): Promise<UserProfile> {
    // Load base profile from workspace
    let profile = await readUserProfile(this.context.workspace).catch(() => ({
      userId: "cli-user",
      topics: [],
      style: { tone: "intermediate", targetWordCount: 1000, voice: "first-person" },
    }));

    // Apply CLI overrides
    if (config.topics) {
      profile.topics = config.topics.map(t => ({ topic: t, interestLevel: 3 }));
    }
    if (config.tone) {
      profile.style.tone = config.tone;
    }
    if (config.wordCount) {
      profile.style.targetWordCount = config.wordCount;
    }

    return profile;
  }

  /**
   * Create kit provider (mock or real)
   */
  private createKitProvider(): WritingKitProvider {
    if (this.context.mock) {
      return createMockWritingKitProvider();
    }
    return createClaudeWritingKitProvider({ workspace: this.context.workspace });
  }

  /**
   * Create summarize provider (mock or real)
   */
  private createSummarizeProvider(): ClaudeSummarizerProvider {
    if (this.context.mock) {
      return createMockSummarizer();
    }
    return createClaudeSummarizer({ workspace: this.context.workspace });
  }
}

/**
 * Factory function for creating runtime
 */
export function createRuntime(config: BaseConfig): LoopliaRuntime {
  return new LoopliaRuntime(config);
}
```

### 6.4 Session Manager

```typescript
// apps/cli/src/runtime/session-manager.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ContentItem, validateContentItem } from "@looplia-core/core";
import { writeContentItem, ensureWorkspace } from "@looplia-core/provider/claude-agent-sdk";
import { createContentItemFromFile, readContentFile } from "../utils/file";

// Regex for parsing content.md frontmatter
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const TITLE_REGEX = /title:\s*"?([^"\n]+)"?/;

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session "${sessionId}" not found. Use --file to create a new session.`);
    this.name = "SessionNotFoundError";
  }
}

export class ContentValidationError extends Error {
  constructor(message: string) {
    super(`Content validation failed: ${message}`);
    this.name = "ContentValidationError";
  }
}

export class SessionManager {
  private workspace: string;

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  /**
   * Prepare ContentItem from file or session-id
   *
   * NOTE: Returns ContentItem for provider API, not sessionId
   */
  async prepare(config: { file?: string; sessionId?: string }): Promise<ContentItem> {
    // Ensure workspace exists
    this.workspace = await ensureWorkspace();

    if (config.file) {
      return this.createNewSession(config.file);
    }

    if (config.sessionId) {
      return this.loadExistingSession(config.sessionId);
    }

    throw new Error("Either file or sessionId is required");
  }

  /**
   * Prepare ContentItem from file (for summarize command)
   */
  async prepareFromFile(filePath: string): Promise<ContentItem> {
    this.workspace = await ensureWorkspace();
    return this.createNewSession(filePath);
  }

  /**
   * Create a new session from file, return validated ContentItem
   */
  private async createNewSession(filePath: string): Promise<ContentItem> {
    const rawText = readContentFile(filePath);
    const content = createContentItemFromFile(filePath, rawText);

    const validation = validateContentItem(content);
    if (!validation.success) {
      throw new ContentValidationError(validation.error.message);
    }

    const sessionId = await writeContentItem(validation.data, this.workspace);
    console.error(`✓ New session created: ${sessionId}`);

    // Return the validated content item with updated id
    return { ...validation.data, id: sessionId };
  }

  /**
   * Load ContentItem from existing session
   *
   * NOTE: Reconstructs ContentItem from content.md frontmatter
   */
  private loadExistingSession(sessionId: string): ContentItem {
    const contentPath = join(this.workspace, "contentItem", sessionId, "content.md");

    if (!existsSync(contentPath)) {
      throw new SessionNotFoundError(sessionId);
    }

    // Read content.md and extract metadata from frontmatter
    const contentMd = readFileSync(contentPath, "utf-8");
    const frontmatterMatch = contentMd.match(FRONTMATTER_REGEX);

    let title = "Untitled";
    let rawText = contentMd;

    if (frontmatterMatch?.[1] && frontmatterMatch[2]) {
      const frontmatter = frontmatterMatch[1];
      rawText = frontmatterMatch[2].trim();

      // Extract title from frontmatter
      const titleMatch = frontmatter.match(TITLE_REGEX);
      if (titleMatch?.[1]) {
        title = titleMatch[1].trim();
      }
    }

    console.error(`✓ Resuming session: ${sessionId}`);

    return {
      id: sessionId,
      title,
      rawText,
      url: "",
      source: {
        id: sessionId,
        type: "custom",
        url: "",
      },
      metadata: {},
    };
  }
}
```

---

## 7. Layer 3: Providers

### 7.1 Design Goal

Providers should:
1. Build a **minimal prompt** (agent reads CLAUDE.md for details)
2. Call the SDK
3. Return structured result

**Target complexity: ≤8**

### 7.2 Minimal Prompt Pattern

```typescript
// Current (v0.3.4.0) - Provider builds detailed prompt
const prompt = `
You are a content analysis agent. Your task is to...
[200+ lines of instructions]
...
Analyze the content at ${filePath} and produce a summary with these fields:
- headline
- tldr
- bullets
[etc.]
`;

// After (v0.3.4.0-v2) - Provider builds MINIMAL prompt
const prompt = `Build WritingKit for session: contentItem/${sessionId}`;
// Agent reads ~/.looplia/CLAUDE.md for full instructions
// Agent checks session state and decides which subagents to invoke
```

### 7.3 Existing Provider API (No Changes)

The provider API is already correct - it takes `ContentItem` and `UserProfile`:

```typescript
// packages/provider/src/claude-agent-sdk/writing-kit-provider.ts (EXISTING)

export type WritingKitProvider = {
  /**
   * Build a complete writing kit from content
   * @param content - Content item to process (NOT sessionId)
   * @param user - User profile for preferences
   */
  buildKit(content: ContentItem, user: UserProfile): Promise<AgenticQueryResult<WritingKit>>;

  /**
   * Streaming version
   * @param content - Content item to process (NOT sessionId)
   * @param user - User profile for preferences
   * @returns AsyncGenerator yielding StreamingEvent, returning AgenticQueryResult
   */
  buildKitStreaming(
    content: ContentItem,
    user: UserProfile
  ): AsyncGenerator<StreamingEvent, AgenticQueryResult<WritingKit>>;
};

// packages/provider/src/claude-agent-sdk/summarizer.ts (EXISTING)

export type ClaudeSummarizerProvider = {
  summarize(content: ContentItem, user?: UserProfile): Promise<AgenticQueryResult<ContentSummary>>;

  summarizeStreaming(
    content: ContentItem,
    user?: UserProfile
  ): AsyncGenerator<StreamingEvent, AgenticQueryResult<ContentSummary>>;
};
```

**Key insight:** The provider handles workspace setup, content writing, and prompt building internally.
The CLI Runtime just needs to prepare `ContentItem` and pass it to the provider.

---

## 8. Layer 4: Agent (SDK)

### 8.1 Design Goal

The agent should make **ALL business decisions**:
- Which subagents to invoke
- What order to execute
- How to handle errors
- When to stop

**Complexity: Defined in markdown, not TypeScript**

### 8.2 Agent Decision Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  MAIN AGENT RECEIVES: "Build WritingKit for session: contentItem/abc123"        │
│                                                                                 │
│  Agent's Autonomous Decision Process:                                           │
│                                                                                 │
│  1. Read CLAUDE.md for full task instructions                                   │
│     └─► Understands: goal, subagents available, output format                   │
│                                                                                 │
│  2. Check session state: Glob contentItem/abc123/*.json                         │
│     ├─► Found: [content.md]              → Need all subagents                   │
│     ├─► Found: [content.md, summary.json] → Skip content-analyzer               │
│     ├─► Found: [+ ideas.json]             → Skip content-analyzer, idea-gen     │
│     └─► Found: [+ writing-kit.json]       → Return existing kit directly        │
│                                                                                 │
│  3. Invoke subagents via Task tool (if needed):                                 │
│     ├─► Task: content-analyzer → produces summary.json                          │
│     ├─► Task: idea-generator → produces ideas.json                              │
│     └─► Task: writing-kit-builder → produces writing-kit.json                   │
│                                                                                 │
│  4. Read final writing-kit.json                                                 │
│                                                                                 │
│  5. Return via StructuredOutput tool                                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Why Agent-Controlled?

| Aspect | Hardcoded (TypeScript) | Agent-Controlled |
|--------|------------------------|------------------|
| Flow changes | Requires code change | Edit CLAUDE.md |
| Error handling | Fixed strategy | Agent adapts |
| Debugging | Read code | Agent explains in logs |
| Testing | Unit tests | Integration tests |
| Flexibility | Low | High |

---

## 9. Streaming UI Integration

### 9.1 Streaming Components (from v0.3.4.0)

The streaming UI components remain unchanged from v0.3.4.0:

```
apps/cli/src/
├── components/
│   ├── streaming-query-ui.tsx    # Generic streaming UI
│   ├── header.tsx                # Session info header
│   ├── progress-bar.tsx          # Visual progress indicator
│   ├── progress-section.tsx      # Progress + current step
│   ├── activity-log.tsx          # Scrolling activity items
│   ├── activity-item.tsx         # Single activity entry
│   ├── usage-stats.tsx           # Token/cost display
│   ├── agent-output.tsx          # Agent text/thinking display
│   ├── result-section.tsx        # Final result display
│   ├── spinner.tsx               # Loading indicator
│   └── index.ts                  # Exports
├── hooks/
│   └── use-streaming-query.ts    # Streaming state hook
└── utils/
    └── streaming-state.ts        # Shared state management
```

### 9.2 Integration with Runtime

The Runtime calls `renderStreamingQuery` directly:

```typescript
// In LoopliaRuntime.execute()
if (this.context.mode === "streaming") {
  return renderStreamingQuery<T>({
    title: options.title,
    subtitle: options.subtitle,
    streamGenerator: generator,
  });
}
```

### 9.3 Streaming Event Flow

```
Provider.buildKitStreaming()
    │
    └─► yields StreamingEvent[]
           │
           ├─► session_start → Update header
           ├─► thinking      → Update agent output
           ├─► text          → Update agent output
           ├─► tool_start    → Add activity (running)
           ├─► tool_end      → Update activity (complete)
           ├─► progress      → Update progress bar
           └─► complete      → Show result, cleanup
```

---

## 10. File Structure

### 10.1 New Directory Structure

```
apps/cli/src/
├── commands/                     # LAYER 1: Thin command wrappers
│   ├── kit.ts                    # ~30 lines
│   ├── summarize.ts              # ~30 lines
│   ├── bootstrap.ts              # (unchanged)
│   └── config.ts                 # (unchanged)
│
├── parsers/                      # NEW: Argument parsing
│   ├── kit-parser.ts             # parseKitArgs, validateKitInput, printKitHelp
│   ├── summarize-parser.ts       # parseSummarizeArgs, validateSummarizeInput
│   ├── types.ts                  # Shared parser types
│   └── index.ts                  # Exports
│
├── renderers/                    # NEW: Output rendering
│   ├── kit-renderer.ts           # renderKitResult
│   ├── summarize-renderer.ts     # renderSummarizeResult
│   └── index.ts                  # Exports
│
├── runtime/                      # NEW: LAYER 2: Execution runtime
│   ├── looplia-runtime.ts        # LoopliaRuntime class
│   ├── session-manager.ts        # SessionManager class
│   ├── types.ts                  # ExecutionContext, ExecutionResult, configs
│   └── index.ts                  # Exports: createRuntime
│
├── components/                   # (unchanged from v0.3.4.0)
│   ├── streaming-query-ui.tsx
│   ├── header.tsx
│   ├── progress-bar.tsx
│   └── ... (other components)
│
├── hooks/                        # (unchanged from v0.3.4.0)
│   └── use-streaming-query.ts
│
├── utils/                        # (mostly unchanged)
│   ├── streaming-state.ts        # Shared streaming utilities
│   ├── terminal.ts               # TTY detection
│   ├── file.ts                   # File utilities
│   ├── format.ts                 # Formatting utilities
│   ├── args.ts                   # Argument parsing utilities
│   └── index.ts                  # Exports
│
└── index.ts                      # CLI entry point
```

### 10.2 File Responsibilities

| File | Responsibility | Complexity |
|------|----------------|------------|
| `commands/kit.ts` | Parse → Runtime → Render | ≤5 |
| `commands/summarize.ts` | Parse → Runtime → Render | ≤5 |
| `parsers/kit-parser.ts` | Arg extraction, validation, help text | ≤8 |
| `parsers/summarize-parser.ts` | Arg extraction, validation, help text | ≤5 |
| `renderers/kit-renderer.ts` | Format output, write file, display info | ≤8 |
| `renderers/summarize-renderer.ts` | Format output, write file, display info | ≤8 |
| `runtime/looplia-runtime.ts` | Execution orchestration | ≤10/method |
| `runtime/session-manager.ts` | File vs session-id handling | ≤10 |

---

## 11. Implementation Plan

### 11.1 Phase 1: Foundation (Runtime + Types)

| Task | File | Priority |
|------|------|----------|
| Create runtime types | `runtime/types.ts` | P0 |
| Create SessionManager | `runtime/session-manager.ts` | P0 |
| Create LoopliaRuntime | `runtime/looplia-runtime.ts` | P0 |
| Export runtime | `runtime/index.ts` | P0 |

**Deliverable:** `createRuntime(config)` returns working runtime

### 11.2 Phase 2: Parsers

| Task | File | Priority |
|------|------|----------|
| Create kit parser | `parsers/kit-parser.ts` | P0 |
| Create summarize parser | `parsers/summarize-parser.ts` | P0 |
| Create shared types | `parsers/types.ts` | P0 |
| Export parsers | `parsers/index.ts` | P0 |

**Deliverable:** `parseKitArgs(args)` returns typed `KitConfig`

### 11.3 Phase 3: Renderers

| Task | File | Priority |
|------|------|----------|
| Create kit renderer | `renderers/kit-renderer.ts` | P0 |
| Create summarize renderer | `renderers/summarize-renderer.ts` | P0 |
| Export renderers | `renderers/index.ts` | P0 |

**Deliverable:** `renderKitResult(result, config)` displays output

### 11.4 Phase 4: Refactor Commands

| Task | File | Priority |
|------|------|----------|
| Refactor kit.ts | `commands/kit.ts` | P0 |
| Refactor summarize.ts | `commands/summarize.ts` | P0 |

**Deliverable:** Commands reduced to ~30 lines each

### 11.5 Phase 5: Testing & Validation

| Task | Priority |
|------|----------|
| Run existing tests (should pass) | P0 |
| Run ultracite (should pass) | P0 |
| Manual E2E testing | P0 |
| Update documentation | P1 |

---

## 12. Migration Guide

### 12.1 Backward Compatibility

All existing CLI options continue to work:
- `looplia kit --file <path>` ✓
- `looplia kit --session-id <id>` ✓
- `looplia summarize --file <path>` ✓
- `--format json|markdown` ✓
- `--output <path>` ✓
- `--no-streaming` ✓
- `--mock` ✓

### 12.2 Breaking Changes

**None.** This is a pure refactoring with no API changes.

### 12.3 Internal Changes

| Component | Before | After |
|-----------|--------|-------|
| Command complexity | 25-26 | ≤5 |
| Argument parsing | Inline in command | Separate parser file |
| Output rendering | Inline in command | Separate renderer file |
| Execution logic | Inline in command | Runtime class |
| Session management | Inline in command | SessionManager class |

---

## 13. Testing Strategy

### 13.1 Unit Tests

```typescript
// runtime/looplia-runtime.test.ts
describe("LoopliaRuntime", () => {
  it("validates environment requires API key", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createRuntime({ mock: false, ... })).toThrow();
  });

  it("skips API key check in mock mode", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createRuntime({ mock: true, ... })).not.toThrow();
  });

  it("uses streaming mode when interactive", () => {
    // Mock isInteractive() to return true
    const runtime = createRuntime({ noStreaming: false, mock: false, ... });
    expect(runtime.context.mode).toBe("streaming");
  });
});

// parsers/kit-parser.test.ts
describe("parseKitArgs", () => {
  it("parses --file flag", () => {
    const config = parseKitArgs(["--file", "article.md"]);
    expect(config.file).toBe("article.md");
  });

  it("parses --session-id flag", () => {
    const config = parseKitArgs(["--session-id", "abc123"]);
    expect(config.sessionId).toBe("abc123");
  });

  it("parses topics as array", () => {
    const config = parseKitArgs(["--file", "x.md", "--topics", "ai,safety"]);
    expect(config.topics).toEqual(["ai", "safety"]);
  });
});

// runtime/session-manager.test.ts
describe("SessionManager", () => {
  it("throws SessionNotFoundError for missing session", () => {
    const manager = new SessionManager("/tmp/workspace");
    expect(() => manager.loadExistingSession("nonexistent"))
      .toThrow(SessionNotFoundError);
  });
});
```

### 13.2 Integration Tests

```bash
# E2E: Kit command with file
looplia kit --file ./test/fixtures/article.md --mock
# Expected: Returns WritingKit JSON

# E2E: Kit command with session-id
looplia kit --session-id existing-session --mock
# Expected: Returns WritingKit JSON or error if not found

# E2E: Summarize command
looplia summarize --file ./test/fixtures/article.md --mock
# Expected: Returns ContentSummary JSON

# E2E: Non-streaming mode
looplia kit --file ./test/fixtures/article.md --no-streaming --mock | jq .contentId
# Expected: Outputs contentId
```

### 13.3 Lint Validation

```bash
# Run ultracite to verify complexity
npx ultracite check

# Expected: All files pass with complexity ≤15
# Before: kit.ts (25), summarize.ts (26)
# After: kit.ts (≤5), summarize.ts (≤5)
```

---

## Appendix A: Complexity Budget

### A.1 Detailed Breakdown

| Component | Target | Rationale |
|-----------|--------|-----------|
| `runKitCommand` | ≤5 | Parse, validate, execute, render |
| `runSummarizeCommand` | ≤5 | Parse, validate, execute, render |
| `parseKitArgs` | ≤8 | 8 flags to parse |
| `parseSummarizeArgs` | ≤5 | 5 flags to parse |
| `validateKitInput` | ≤3 | file XOR session-id check |
| `validateSummarizeInput` | ≤2 | file required check |
| `renderKitResult` | ≤8 | Format, write, display |
| `renderSummarizeResult` | ≤8 | Format, write, display |
| `LoopliaRuntime.executeKit` | ≤10 | Session + profile + execute |
| `LoopliaRuntime.executeSummarize` | ≤8 | Session + execute |
| `LoopliaRuntime.execute` | ≤5 | Streaming vs batch |
| `SessionManager.prepare` | ≤10 | File vs session-id handling |

### A.2 Total Complexity Comparison

| Metric | Before | After |
|--------|--------|-------|
| kit.ts | 25 | ~5 |
| summarize.ts | 26 | ~5 |
| Total lines in commands | 700+ | ~60 |
| Max function complexity | 26 | 10 |

---

## Appendix B: Design Decisions

### B.1 Why Runtime Class vs Functions?

**Option A: Functions**
```typescript
const context = buildContext(config);
const sessionId = await prepareSession(config, context);
const result = await execute(generator, context);
```

**Option B: Class (chosen)**
```typescript
const runtime = createRuntime(config);
const result = await runtime.executeKit(config);
```

**Rationale:** Class encapsulates related state (context, sessionManager) and provides cleaner API.

### B.2 Why Separate Parsers and Renderers?

**Option A: Inline in commands**
- Pro: All logic in one place
- Con: Commands become fat, hard to test

**Option B: Separate files (chosen)**
- Pro: Single responsibility, testable, reusable
- Con: More files

**Rationale:** Aligns with single responsibility principle. Parsers and renderers are testable independently.

### B.3 Why Not Use Dependency Injection?

For this scale, DI adds complexity without significant benefit. The Runtime class creates its own dependencies internally, which is sufficient for testing via mock config.

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.3.4.0-v2 | 2025-12-10 | New design: Runtime layer, simplified commands, aligned with agentic concept |
| 0.3.4.0-v2 (rev1) | 2025-12-10 | Corrected API types: SessionManager returns ContentItem (not sessionId), use AgenticQueryResult from provider |
| 0.3.4.0 | 2025-12-09 | Original design: Streaming UI with Ink |
