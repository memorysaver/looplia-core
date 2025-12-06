# Looplia Core – Technical Design Document v0.2

**Version:** 0.2
**Status:** Draft
**Last Updated:** 2025-12-06

---

## Table of Contents

1. [Overview](#1-overview)
2. [What's New in v0.2](#2-whats-new-in-v02)
3. [Provider Architecture](#3-provider-architecture)
4. [Claude Agent SDK Integration](#4-claude-agent-sdk-integration)
5. [Workspace Design](#5-workspace-design)
6. [Package Structure](#6-package-structure)
7. [API Design](#7-api-design)
8. [Implementation Details](#8-implementation-details)
9. [Prompts & Templates](#9-prompts--templates)
10. [Configuration](#10-configuration)
11. [Testing Strategy](#11-testing-strategy)
12. [Future Roadmap](#12-future-roadmap)

---

## 1. Overview

### 1.1 Purpose

Looplia v0.2 introduces the **real provider ecosystem** with **Claude Agent SDK integration**. This version bridges the gap between the vendor-neutral core (v0.1) and production-ready LLM providers.

### 1.2 Goals

- Implement `@looplia-core/provider` package with Claude Agent SDK integration
- Use `~/.looplia/` as the primary workspace, seeded from bundled templates
- Enable agents, skills, and plugins via Claude Agent SDK with workspace overrides
- Maintain backward compatibility with v0.1 core APIs
- Provide customizable prompts and configuration
- Track usage metrics (tokens, cost)

### 1.3 Non-Goals

- Support for other LLM providers in v0.2 (planned for v0.3)
- Streaming support (v0.2+)
- Batch processing (v0.2+)
- CLI provider management (deferred)

---

## 2. What's New in v0.2

### 2.1 New Packages

| Package | Purpose | Status |
|---------|---------|--------|
| `@looplia-core/provider` | Real provider implementations with subpath exports | NEW |
| `@looplia-core/provider/claude-agent-sdk` | Claude Agent SDK integration | NEW |

### 2.2 Key Features

- **Claude Agent SDK Support**: Use `query()` function with structured JSON outputs
- **Workspace-First Design**: Install bundled agents/skills/prompts into `~/.looplia/` on first run
- **Subagents**: Programmatic definitions mirrored to filesystem for customization
- **Agent Skills**: Workspace skills seeded from bundled templates, editable by users
- **Plugins**: Local plugins loaded from workspace (template copies provided)
- **Usage Metrics**: Track per-request (per call) input/output tokens and cost
- **Customizable Prompts**: Override default prompts via config arguments

### 2.3 Breaking Changes

None. v0.2 is fully backward compatible with v0.1 core.

---

## 3. Provider Architecture

### 3.1 Design Principles

The provider ecosystem follows these principles:

1. **Single Responsibility**: Each provider implements one interface
2. **Stateless**: Providers are pure functions (except configuration)
3. **Error Standardization**: All errors mapped to `ProviderError` types
4. **Result Wrapping**: All operations return `ProviderResult<T>`
5. **Workspace Integration**: SDK always operates in `~/.looplia/`, seeding defaults when missing

### 3.2 Provider Interfaces (from v0.1)

Providers implement these three core interfaces:

```typescript
interface SummarizerProvider {
  summarize(content: ContentItem, user?: UserProfile): Promise<ProviderResult<ContentSummary>>;
}

interface IdeaProvider {
  generateIdeas(summary: ContentSummary, user: UserProfile): Promise<ProviderResult<WritingIdeas>>;
}

interface OutlineProvider {
  generateOutline(summary: ContentSummary, ideas: WritingIdeas, user: UserProfile): Promise<ProviderResult<OutlineSection[]>>;
}
```

### 3.3 Provider Result with Usage Metrics

```typescript
type ProviderResult<T> =
  | { success: true; data: T; usage?: ProviderUsage }
  | { success: false; error: ProviderError };

type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
};
```

---

## 4. Claude Agent SDK Integration

### 4.1 SDK Overview

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) provides:

- **`query()` Function**: Async generator that streams messages
- **Structured Output**: JSON Schema support for deterministic output format
- **Filesystem Context**: Loads agents, skills, plugins from `~/.looplia/` (seeded from templates on init)
- **Workspace Support**: Operates with custom `cwd` (default: `~/.looplia/`, override via config)
- **Setting Sources**: Always read from `~/.looplia/` (project-level configs are future work)

### 4.2 SDK Feature Support

| Feature | Support | Implementation |
|---------|---------|----------------|
| **Subagents** | ✅ Filesystem-first | Bundled templates copied into `~/.looplia/agents/*.md` |
| **Agent Skills** | ✅ Filesystem-first | Templates copied into `~/.looplia/skills/*/SKILL.md` |
| **Plugins** | ✅ Local workspace | `~/.looplia/plugins/` folders with template stubs |
| **Structured Output** | ✅ JSON Schema | `outputFormat: { type: 'json_schema', schema }` |
| **Custom Workspace** | ✅ (default `~/.looplia/`) | Override via `workspace` config; templates copied there |

### 4.3 Core API Pattern

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const result = query({
  prompt: "Your prompt here",
  options: {
    model: "claude-haiku-4-5-20251001",
    cwd: "~/.looplia",
    systemPrompt: "You are...",
    outputFormat: { type: "json_schema", schema: ContentSummarySchema },
    permissionMode: "bypassPermissions",
    allowedTools: ["Skill"],
    agents: { /* programmatic agent definitions */ }
  }
});

for await (const message of result) {
  if (message.type === "result" && message.subtype === "success") {
    const output = message.structured_output;  // Parsed JSON
    const usage = message.usage;  // Token usage
    const cost = message.total_cost_usd;
  }
}
```

---

## 5. Workspace Design

### 5.1 Workspace Structure

v0.2 treats `~/.looplia/` (or configured `workspace`) as the canonical source of truth. On first run, the provider copies bundled agents/skills/prompts into that directory; subsequent edits are preserved. When the CLI updates, re-bootstrap to copy new templates over existing ones (back up or version user-edited files before overwriting). The workspace structure is:

```
~/.looplia/
├── agents/
│   ├── summarizer.md           # Subagent definition
│   ├── idea-generator.md       # Subagent definition
│   └── outline-generator.md    # Subagent definition
├── skills/
│   └── content-analysis/
│       └── SKILL.md            # Agent Skill
├── plugins/                    # User-installed plugins
└── settings.json               # Provider + SDK settings (optional)
```

### 5.2 Agent Definitions

Subagents are Markdown files with YAML frontmatter (copied from templates during workspace bootstrap, then user-editable):

```markdown
---
name: summarizer
description: Expert content summarizer. Use for extracting key insights, creating TLDRs, and identifying main themes from articles, videos, and podcasts.
tools: Read
model: haiku
---

You are an expert content analyst specializing in summarization.

When summarizing content:
- Extract the most important insights
- Create a compelling headline (10-200 chars)
- Write a concise TL;DR (3-5 sentences)
- Identify key bullet points (1-10 items)
- Tag with relevant topics
- Assess sentiment (positive/neutral/negative)
- Score relevance to user interests (0-1)

Always output valid JSON matching the ContentSummary schema.
```

### 5.3 Agent Skills

Skills are in `skills/SKILL_NAME/SKILL.md`:

```markdown
---
name: content-analysis
description: Analyze content for writing opportunities. Use when processing articles, videos, or podcasts to extract insights and generate writing materials.
---

# Content Analysis Skill

This skill helps analyze content and extract:
- Key themes and topics
- Writing hooks and angles
- Exploratory questions
- Article outlines

## Usage

Invoke this skill when the user wants to transform raw content into writing materials.
```

### 5.4 Workspace Initialization

```typescript
import { ensureWorkspace } from "@looplia-core/provider/claude-agent-sdk";

// Creates ~/.looplia/ (or custom dir) and copies bundled templates if missing
const workspaceDir = await ensureWorkspace({
  baseDir: "~/.looplia",  // Optional override
  installDefaults: true   // Copy bundled agents/skills/prompts/plugins
});

// When the CLI updates, re-bootstrap to copy new templates over existing ones.
// Preserve user edits by backing up or only overwriting known template files.
```

---

## 6. Package Structure

### 6.1 Monorepo Layout

```
looplia-core/
├── apps/
│   ├── cli/                    # CLI (v0.1)
│   └── docs/
├── packages/
│   ├── config/
│   ├── core/                   # Core library (v0.1)
│   └── provider/               # NEW - Provider package
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── claude-agent-sdk/
│       │   │   ├── index.ts                    # Factory functions
│       │   │   ├── config.ts                   # Configuration types
│       │   │   ├── workspace.ts                # Workspace setup
│       │   │   ├── summarizer.ts               # SummarizerProvider
│       │   │   ├── idea-generator.ts           # IdeaProvider
│       │   │   ├── outline-generator.ts        # OutlineProvider
│       │   │   ├── agents/                     # Bundled agents
│       │   │   │   ├── summarizer.md
│       │   │   │   ├── idea-generator.md
│       │   │   │   └── outline-generator.md
│       │   │   ├── skills/                     # Bundled skills
│       │   │   │   └── content-analysis/
│       │   │   │       └── SKILL.md
│       │   │   ├── prompts/
│       │   │   │   ├── summarize.ts
│       │   │   │   ├── ideas.ts
│       │   │   │   └── outline.ts
│       │   │   └── utils/
│       │   │       ├── query-wrapper.ts
│       │   │       ├── error-mapper.ts
│       │   │       └── schema-converter.ts
│       │   └── (future: openai/, ollama/, etc.)
│       └── test/
│           └── claude-agent-sdk/
│
├── docs/
│   ├── DESIGN-0.1.md
│   └── DESIGN-0.2.md           # This file
└── turbo.json
```

### 6.2 Package.json Configuration

```json
{
  "name": "@looplia-core/provider",
  "version": "0.2.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./claude-agent-sdk": {
      "types": "./dist/claude-agent-sdk/index.d.ts",
      "import": "./dist/claude-agent-sdk/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "bun test",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "@looplia-core/core": "workspace:*",
    "zod-to-json-schema": "^3.23.0"
  },
  "devDependencies": {
    "@looplia-core/config": "workspace:*"
  }
}
```

### 6.3 Build Order

```
1. packages/config       (no dependencies)
2. packages/core        (depends on config)
3. packages/provider    (depends on core)
4. apps/cli             (depends on core, optionally provider)
```

Update `turbo.json` to include provider:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

---

## 7. API Design

### 7.1 Configuration Type

```typescript
// packages/provider/src/claude-agent-sdk/config.ts

export type ClaudeAgentConfig = {
  /** Model to use (default: claude-haiku-4-5-20251001) */
  model?: string;

  /** API key (default: ANTHROPIC_API_KEY env) */
  apiKey?: string;

  /** Workspace directory (default: ~/.looplia) */
  workspace?: string;

  /** Whether to seed + read filesystem agents/skills (default: true) */
  useFilesystemExtensions?: boolean;

  /** Additional plugins to load */
  plugins?: Array<{ type: "local"; path: string }>;

  /** Custom system prompt (overrides default) */
  systemPrompt?: string;

  /** Custom user prompt template function */
  promptBuilder?: (input: unknown) => string;

  /** Max retries on transient errors (default: 3) */
  maxRetries?: number;

  /** Request timeout in ms (default: 60000) */
  timeout?: number;
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
};

export type ProviderResultWithUsage<T> = ProviderResult<T> & {
  usage?: ProviderUsage;
};
```

### 7.2 Factory Functions

```typescript
// packages/provider/src/claude-agent-sdk/index.ts

import type {
  SummarizerProvider,
  IdeaProvider,
  OutlineProvider,
  WritingKitProviders
} from "@looplia-core/core";

import type { ClaudeAgentConfig } from "./config";

/** Create a Claude-powered summarizer */
export function createClaudeSummarizer(
  config?: ClaudeAgentConfig
): SummarizerProvider;

/** Create a Claude-powered idea generator */
export function createClaudeIdeaGenerator(
  config?: ClaudeAgentConfig
): IdeaProvider;

/** Create a Claude-powered outline generator */
export function createClaudeOutlineGenerator(
  config?: ClaudeAgentConfig
): OutlineProvider;

/** Create all three providers as a bundle */
export function createClaudeProviders(
  config?: ClaudeAgentConfig
): WritingKitProviders;

/** Initialize or get the workspace */
export async function ensureWorkspace(config?: {
  baseDir?: string;
  installDefaults?: boolean;
}): Promise<string>;
```

### 7.3 Usage Example

```typescript
import { createClaudeProviders } from "@looplia-core/provider/claude-agent-sdk";
import { buildWritingKit } from "@looplia-core/core";

// Create all providers with default config
const providers = createClaudeProviders({
  model: "claude-haiku-4-5-20251001",
  workspace: "~/.looplia"
});

// Use with core service
const result = await buildWritingKit(content, user, providers);

if (result.success) {
  console.log("Kit:", result.data);
  console.log("Usage:", result.usage);  // Token and cost metrics
} else {
  console.error("Error:", result.error);
}
```

---

## 8. Implementation Details

### 8.1 Query Wrapper

The query wrapper handles the Claude Agent SDK interaction and always runs against the workspace (seeded or re-seeded before each call):

```typescript
// packages/provider/src/claude-agent-sdk/utils/query-wrapper.ts

import { query } from "@anthropic-ai/claude-agent-sdk";
import { ensureWorkspace } from "./workspace";
import { mapException, mapSdkError } from "./error-mapper";
import type { ClaudeAgentConfig, ProviderResultWithUsage, ProviderUsage } from "../config";

export async function executeQuery<T>(
  prompt: string,
  systemPrompt: string,
  jsonSchema: object,
  config: ClaudeAgentConfig
): Promise<ProviderResultWithUsage<T>> {
  try {
    const workspace = await ensureWorkspace({
      baseDir: config.workspace ?? "~/.looplia",
      installDefaults: true // re-bootstrap on CLI upgrades to refresh templates
    });

    const result = query({
      prompt,
      options: {
        model: config.model ?? "claude-haiku-4-5-20251001",
        cwd: workspace,
        systemPrompt,
        permissionMode: "bypassPermissions",
        allowedTools: config.useFilesystemExtensions === false ? [] : ["Skill"],
        outputFormat: {
          type: "json_schema",
          schema: jsonSchema
        },
        timeout: config.timeout ?? 60000
      }
    });

    for await (const message of result) {
      if (message.type === "result") {
        const usage: ProviderUsage = {
          inputTokens: message.usage?.input_tokens ?? 0,
          outputTokens: message.usage?.output_tokens ?? 0,
          totalCostUsd: message.total_cost_usd ?? 0
        };

        if (message.subtype === "success") {
          return {
            success: true,
            data: message.structured_output as T,
            usage
          };
        }

        return {
          ...mapSdkError(message),
          usage
        };
      }
    }

    return {
      success: false,
      error: { type: "unknown", message: "No result received" }
    };
  } catch (error) {
    return mapException(error);
  }
}
```

### 8.2 Error Mapping

Map SDK errors to Looplia `ProviderError` types:

```typescript
// packages/provider/src/claude-agent-sdk/utils/error-mapper.ts

import type { ProviderError } from "@looplia-core/core";

export function mapSdkError(message: SDKResultMessage): ProviderError {
  switch (message.subtype) {
    case "error_max_turns":
      return {
        type: "unknown",
        message: "Max conversation turns exceeded"
      };

    case "error_max_budget_usd":
      return {
        type: "rate_limit",
        retryAfterMs: 0,
        message: "Usage budget exceeded"
      };

    case "error_during_execution":
      return {
        type: "unknown",
        message: message.errors?.join(", ") ?? "Execution error"
      };

    default:
      return {
        type: "unknown",
        message: "Unknown SDK error"
      };
  }
}

export function mapException(error: unknown): ProviderError {
  if (error instanceof Error) {
    if (error.message.includes("API key")) {
      return {
        type: "validation_error",
        field: "apiKey",
        message: "Invalid or missing API key"
      };
    }

    if (error.message.includes("network") || error.message.includes("fetch")) {
      return {
        type: "network_error",
        message: error.message,
        cause: error
      };
    }
  }

  return {
    type: "unknown",
    message: String(error),
    cause: error instanceof Error ? error : undefined
  };
}
```

### 8.3 Schema Conversion

Convert Zod schemas to JSON Schema for Claude Agent SDK:

```typescript
// packages/provider/src/claude-agent-sdk/utils/schema-converter.ts

import { zodToJsonSchema } from "zod-to-json-schema";
import {
  ContentSummarySchema,
  WritingIdeasSchema
} from "@looplia-core/core";

export const SUMMARYOUTPUT_SCHEMA = zodToJsonSchema(ContentSummarySchema);
export const IDEAS_OUTPUT_SCHEMA = zodToJsonSchema(WritingIdeasSchema);

// For outline (array)
export const OUTLINE_OUTPUT_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      heading: { type: "string" },
      notes: { type: "string" },
      estimatedWords: { type: "number", optional: true }
    },
    required: ["heading", "notes"]
  }
};
```

---

## 9. Prompts & Templates

### 9.1 System Prompts

Each provider has a system prompt that defines its expertise:

```typescript
// packages/provider/src/claude-agent-sdk/prompts/summarize.ts

export const SUMMARIZE_SYSTEM_PROMPT = `You are an expert content analyst specializing in summarization and content intelligence.

Your expertise includes:
- Extracting key insights and themes from various content formats
- Creating compelling headlines and summaries
- Identifying relevant topics and tags
- Analyzing sentiment and tone
- Scoring content relevance to user interests

When analyzing content:
1. Read carefully and identify the core message
2. Extract key points and supporting details
3. Consider the audience and context
4. Evaluate emotional and factual elements
5. Assess topic relevance

Always output valid JSON matching the provided schema.
Ensure all fields are populated with accurate, concise information.`;

export function buildSummarizePrompt(
  content: ContentItem,
  user?: UserProfile
): string {
  const userContext = user
    ? `\n\nUser Context:\n- Topics: ${user.topics.map(t => t.topic).join(", ")}\n- Tone: ${user.style.tone}\n- Word Count Target: ${user.style.targetWordCount}`
    : "";

  return `Analyze and summarize the following content:

Title: ${content.title}
URL: ${content.url}
Source: ${content.source.label ?? content.source.type}
${content.metadata.language ? `Language: ${content.metadata.language}` : ""}

Content:
${content.rawText.substring(0, 5000)}${content.rawText.length > 5000 ? "...[truncated]" : ""}
${userContext}

Provide a comprehensive summary with:
1. A compelling headline (10-200 chars)
2. A concise TL;DR (3-5 sentences, 20-500 chars)
3. Key bullet points (1-10 items)
4. Relevant topic tags (1-20 tags)
5. Sentiment assessment (positive/neutral/negative)
6. Content category (e.g., article, video, podcast)
7. Relevance score to user interests (0-1)

Ensure output matches the ContentSummary JSON schema exactly.`;
}
```

### 9.2 Customizable Prompts

Users can override default prompts via function arguments (environment/workspace overrides are ignored in v0.2):

```typescript
const providers = createClaudeProviders({
  systemPrompt: `You are a specialized content analyst for AI topics...`,
  promptBuilder: (input: unknown) => {
    if (typeof input === "string") {
      return `Analyze this in the context of machine learning: ${input}`;
    }
    return String(input);
  }
});
```

---

## 10. Configuration

### 10.1 Environment Variables

```bash
# API Configuration
ANTHROPIC_API_KEY=sk-ant-...           # Claude API key (required)
LOOPLIA_HOME=~/.looplia               # Optional workspace override
```

### 10.2 Source Precedence

Configuration is resolved in this order: bundled defaults (for initial copy only) < function arguments (used only to seed missing defaults) < workspace files (`~/.looplia/`) at runtime. After bootstrap, workspace content always wins over function arguments.

### 10.3 Workspace Bootstrapping

```typescript
const providers = createClaudeProviders({
  workspace: process.env.LOOPLIA_HOME ?? "~/.looplia",
  useFilesystemExtensions: true
});
```

On initialization, the provider copies bundled agents/skills/prompts/plugins into the target workspace. When the CLI updates, re-bootstrap to refresh template files (back up or version templates before overwriting user edits).

---

## 11. Testing Strategy

### 11.1 Unit Tests

Test individual provider implementations. Use mocked SDK responses and a temp workspace directory per test (e.g., `tmpdir`) to avoid real network calls and accidental writes to `~/.looplia`:

```typescript
// packages/provider/test/claude-agent-sdk/summarizer.test.ts

import { describe, it, expect, mock } from "bun:test";
import { createClaudeSummarizer } from "../../src/claude-agent-sdk";
import { createTempWorkspace } from "./fixtures/test-data"; // helper that creates an isolated temp dir

const tmpWorkspaceDir = createTempWorkspace();

describe("createClaudeSummarizer", () => {
  it("should return valid ContentSummary", async () => {
    const summarizer = createClaudeSummarizer({
      model: "claude-haiku-4-5-20251001",
      workspace: tmpWorkspaceDir
    });

    const result = await summarizer.summarize(testContent, testUser);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headline).toBeDefined();
      expect(result.data.headline.length).toBeGreaterThanOrEqual(10);
      expect(result.data.headline.length).toBeLessThanOrEqual(200);
      expect(result.usage?.inputTokens).toBeGreaterThan(0);
    }
  });

  it("should handle API errors gracefully", async () => {
    const summarizer = createClaudeSummarizer({
      apiKey: "invalid-key"
    });

    const result = await summarizer.summarize(testContent);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("validation_error");
    }
  });
});
```

### 11.2 Integration Tests

Test full pipeline with mock SDK responses and an isolated workspace:

```typescript
// packages/provider/test/claude-agent-sdk/integration.test.ts

import { describe, it, expect } from "bun:test";
import { createClaudeProviders } from "../../src/claude-agent-sdk";
import { buildWritingKit } from "@looplia-core/core";
import { createTempWorkspace } from "./fixtures/test-data";

const tmpWorkspaceDir = createTempWorkspace();

describe("Full Pipeline Integration", () => {
  it("should build complete writing kit", async () => {
    const providers = createClaudeProviders({
      model: "claude-haiku-4-5-20251001",
      workspace: tmpWorkspaceDir
    });

    const result = await buildWritingKit(testContent, testUser, providers);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary).toBeDefined();
      expect(result.data.ideas).toBeDefined();
      expect(result.data.suggestedOutline).toBeDefined();
      expect(result.usage?.totalCostUsd).toBeGreaterThan(0);
    }
  });
});
```

### 11.3 Test Structure

```
packages/provider/test/
├── claude-agent-sdk/
│   ├── summarizer.test.ts
│   ├── idea-generator.test.ts
│   ├── outline-generator.test.ts
│   ├── workspace.test.ts
│   ├── config.test.ts
│   ├── integration.test.ts
│   └── fixtures/
│       └── test-data.ts
```

---

## 12. Future Roadmap

### 12.1 v0.2.1 - Polish & Optimization

- [ ] Caching layer for expensive operations
- [ ] Retry logic with exponential backoff
- [ ] Request deduplication
- [ ] Usage metrics aggregation

### 12.2 v0.3 - Multi-Provider Ecosystem

- [ ] `@looplia-core/provider/openai` - OpenAI integration
- [ ] `@looplia-core/provider/ollama` - Local model support
- [ ] `@looplia-core/provider/deepseek` - DeepSeek integration
- [ ] Provider selection via CLI flag

### 12.3 v0.4 - Streaming & Advanced Features

- [ ] Streaming support (progressive results)
- [ ] Batch processing (multiple content items)
- [ ] Token budget management
- [ ] Cost tracking and analytics

### 12.4 v0.5 - Enterprise Features

- [ ] Plugin system for extensibility
- [ ] Advanced scheduling/cron support
- [ ] Database persistence options
- [ ] Multi-user workspace management

---

## Appendix: Files to Create

### Phase 1: Core Provider (v0.2.0)

```
packages/provider/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── claude-agent-sdk/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── workspace.ts
│   │   ├── summarizer.ts
│   │   ├── idea-generator.ts
│   │   ├── outline-generator.ts
│   │   ├── agents/
│   │   │   ├── summarizer.md
│   │   │   ├── idea-generator.md
│   │   │   └── outline-generator.md
│   │   ├── skills/
│   │   │   └── content-analysis/
│   │   │       └── SKILL.md
│   │   ├── prompts/
│   │   │   ├── summarize.ts
│   │   │   ├── ideas.ts
│   │   │   └── outline.ts
│   │   └── utils/
│   │       ├── query-wrapper.ts
│   │       ├── error-mapper.ts
│   │       └── schema-converter.ts
│   └── claude-agent-sdk/index.ts
└── test/
    └── claude-agent-sdk/
        ├── summarizer.test.ts
        ├── idea-generator.test.ts
        ├── outline-generator.test.ts
        ├── workspace.test.ts
        ├── integration.test.ts
        └── fixtures/
            └── test-data.ts
```

### Phase 2: CLI Integration (optional v0.2.x)

- Update `apps/cli/` to support `--provider` flag
- Default to mock providers if no provider specified
- Support switching to Claude providers via flag

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2025-12-05 | Initial design document |
| 0.2 | 2025-12-06 | Provider architecture, Claude Agent SDK integration, workspace design |
