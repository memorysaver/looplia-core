# Looplia Core – Technical Design Document

**Version:** 0.1
**Status:** Draft
**Last Updated:** 2025-12-05

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Monorepo Architecture](#3-monorepo-architecture)
4. [Domain Model](#4-domain-model)
5. [Ports (Provider Interfaces)](#5-ports-provider-interfaces)
6. [Services (Engines)](#6-services-engines)
7. [Adapters](#7-adapters)
8. [CLI Design](#8-cli-design)
9. [Error Handling](#9-error-handling)
10. [Validation](#10-validation)
11. [Testing Strategy](#11-testing-strategy)
12. [Future Evolution](#12-future-evolution)

---

## 1. Overview

### 1.1 Purpose

Looplia Core is an **LLM-agnostic content intelligence engine** that transforms raw content into structured writing materials:

```
ContentItem → ContentSummary → WritingIdeas → WritingKit
```

It provides:
- **Domain models** for content processing pipelines
- **Provider interfaces** for LLM integration (without binding to any vendor)
- **Pure engines** that orchestrate the transformation
- **Mock adapters** for testing and demonstration

### 1.2 Goals

- Provide a vendor-neutral abstraction layer for content intelligence
- Enable easy integration with any LLM provider (Claude, OpenAI, DeepSeek, local models)
- Support both library usage and CLI demonstration
- Maintain strict separation between domain logic and external dependencies

### 1.3 Non-Goals (What Core Does NOT Do)

Core explicitly excludes:

| Responsibility | Where It Belongs |
|----------------|------------------|
| Content fetching (RSS, YouTube, podcasts) | Looplia Cloud / Application |
| LLM API calls | Provider packages (`@looplia/provider-claude`) |
| Database storage | Looplia Cloud / Application |
| User authentication | Looplia Cloud / Application |
| Caching / Rate limiting | Provider packages / Application |
| Web UI / API server | Looplia Cloud / Application |
| Scheduling / Cron jobs | Looplia Cloud / Application |

---

## 2. Design Principles

### 2.1 Layered Architecture

Dependencies flow inward only:

```
┌─────────────────────────────────────────────┐
│                   CLI                        │
│               (apps/cli)                     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│                Adapters                      │
│           (mock providers)                   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│                Services                      │
│              (engines)                       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           Ports + Domain                     │
│      (interfaces + data types)               │
└─────────────────────────────────────────────┘
```

**Rules:**
- `domain` only gets depended upon, never depends on other layers
- `ports` only depend on `domain`
- `services` only depend on `domain` + `ports`
- `adapters` can depend on `domain` + `ports` + `services`
- `cli` can depend on all layers (outermost shell)

### 2.2 Dependency Injection

All LLM interactions happen through injected providers:

```typescript
// Core never calls LLM directly
// Instead, it receives a provider that implements the interface
async function buildWritingKit(
  content: ContentItem,
  user: UserProfile,
  providers: WritingKitProviders  // ← Injected
): Promise<ProviderResult<WritingKit>>
```

### 2.3 Pure Functions

Services are stateless and deterministic (given the same provider behavior):

```typescript
// No global state, no side effects except provider calls
export async function summarizeContent(
  content: ContentItem,
  user: UserProfile | undefined,
  provider: SummarizerProvider
): Promise<ProviderResult<ContentSummary>>
```

### 2.4 Explicit Error Handling

All provider operations return `ProviderResult<T>` instead of throwing:

```typescript
type ProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: ProviderError };
```

### 2.5 DDD Alignment Addenda

To keep the monorepo layout while preserving the domain-driven intent:

- **Domain purity:** `packages/core/src/domain` contains only TypeScript types/interfaces. No runtime helpers, validation libs, or parsing live here.
- **Validation boundary:** Place Zod or other schemas in `packages/core/src/validation` (or similar) that depends on domain, never the other way around.
- **Provider contracts:** Decide per version whether services return raw types (`Promise<ContentSummary>`) or wrapped results (`ProviderResult<T>`). If wrapping, keep result/error types in `ports` (or a thin boundary module) and keep domain types clean.
- **Import rules:** Add an "allowed imports" matrix for `domain → none`, `ports → domain`, `services → domain + ports`, `adapters → domain + ports + services`, `validation → domain`, `apps/cli → all`, and enforce in CI.
- **Ubiquitous language:** Maintain a short glossary for `ContentItem`, `ContentSummary`, `WritingIdeas`, `WritingKit`, `UserProfile`, `Source` to avoid naming drift.
- **Adapter guidance:** Mock adapters are demo/test-only. Real providers (e.g., `@looplia/provider-claude`) live in separate packages consuming only `domain` + `ports` types.
- **CLI scope:** CLI stays demo-only with mock-by-default behavior; CLI concerns (flags, formats) must not leak into core APIs.
- **Exports policy:** Stable public surface = domain types, ports, services, optional mock namespace. Validation helpers are optional/secondary exports to avoid coupling consumers to a specific validation lib.

---

## 3. Monorepo Architecture

### 3.1 Repository Structure

```
looplia-core/
├── apps/
│   ├── cli/                    # CLI application
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point (bin)
│   │   │   ├── commands/
│   │   │   │   ├── summarize.ts
│   │   │   │   └── kit.ts
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── docs/                   # Starlight documentation site
│
├── packages/
│   ├── config/                 # Shared TypeScript config
│   │   ├── tsconfig.base.json
│   │   └── package.json
│   └── core/                   # Core library
│       ├── src/
│       │   ├── domain/         # Data types
│       │   ├── ports/          # Provider interfaces
│       │   ├── services/       # Engines
│       │   ├── adapters/       # Mock implementations
│       │   ├── validation/     # Zod schemas
│       │   └── index.ts        # Public exports
│       ├── test/
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                       # Design documents (this file)
│   └── DESIGN-0.1.md
│
├── turbo.json                  # Turborepo config
├── package.json                # Root workspace config
└── biome.json                  # Code quality config
```

### 3.2 Package Details

#### `@looplia-core/core`

**Location:** `packages/core/`

**Purpose:** Core library containing domain models, provider interfaces, and engines.

```json
{
  "name": "@looplia-core/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

#### `@looplia-core/cli`

**Location:** `apps/cli/`

**Purpose:** Command-line tool for testing and demonstration.

```json
{
  "name": "@looplia-core/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "looplia": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@looplia-core/core": "workspace:*"
  }
}
```

### 3.3 Build Order (Turborepo)

```
1. packages/config     (no dependencies)
2. packages/core       (depends on config)
3. apps/cli            (depends on core)
4. apps/docs           (independent)
```

---

## 4. Domain Model

### 4.1 Data Flow

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐     ┌────────────┐
│ ContentItem │ ──▶ │ ContentSummary  │ ──▶ │ WritingIdeas │ ──▶ │ WritingKit │
└─────────────┘     └─────────────────┘     └──────────────┘     └────────────┘
      ↑                    ↑                       ↑                    ↑
   Raw input          Distilled             Creative              Complete
   from source       understanding          expansion             scaffold
```

### 4.2 Type Definitions

#### `Source`

```typescript
// packages/core/src/domain/content.ts

/**
 * Content source type
 */
export type SourceType = 'rss' | 'youtube' | 'podcast' | 'twitter' | 'custom';

/**
 * Represents a content source (feed, channel, etc.)
 */
export interface Source {
  /** Unique identifier for the source */
  id: string;

  /** Type of source */
  type: SourceType;

  /** Human-readable label */
  label?: string;

  /** Source URL */
  url: string;

  /** Additional source-specific metadata */
  metadata?: Record<string, unknown>;
}
```

#### `ContentItem`

```typescript
// packages/core/src/domain/content.ts

/**
 * Raw content item to be processed
 */
export interface ContentItem {
  /** Unique identifier */
  id: string;

  /** Source this content came from */
  source: Source;

  /** Content title */
  title: string;

  /** Original URL */
  url: string;

  /** Publication date (ISO 8601) */
  publishedAt?: string;

  /** Raw text content (transcript, article body, etc.) */
  rawText: string;

  /** Content metadata */
  metadata: ContentMetadata;
}

/**
 * Well-known metadata fields for content
 */
export interface ContentMetadata {
  /** ISO 639-1 language code (e.g., 'en', 'zh') */
  language?: string;

  /** Duration in seconds (for audio/video) */
  durationSeconds?: number;

  /** Author name */
  author?: string;

  /** Word count of rawText */
  wordCount?: number;

  /** Additional provider-specific fields */
  [key: string]: unknown;
}
```

#### `ContentSummary`

```typescript
// packages/core/src/domain/summary.ts

/**
 * Summarized content with key insights
 */
export interface ContentSummary {
  /** Reference to source content */
  contentId: string;

  /** One-sentence distilled insight (10-200 chars) */
  headline: string;

  /** 3-5 sentence summary (20-500 chars) */
  tldr: string;

  /** Key points as bullet list (1-10 items) */
  bullets: string[];

  /** Topic tags (1-20 tags) */
  tags: string[];

  /** Overall sentiment */
  sentiment: 'positive' | 'neutral' | 'negative';

  /** Content category */
  category: string;

  /** Relevance scores */
  score: SummaryScore;
}

/**
 * Summary scoring metrics
 */
export interface SummaryScore {
  /** How relevant to user's interests (0-1) */
  relevanceToUser: number;
}
```

#### `WritingIdeas`

```typescript
// packages/core/src/domain/ideas.ts

/**
 * Creative expansion of summarized content into writing materials
 */
export interface WritingIdeas {
  /** Reference to source content */
  contentId: string;

  /**
   * Opening hooks to capture reader attention
   * Usage: Pick 1-2 hooks to open your article
   */
  hooks: WritingHook[];

  /**
   * Narrative angles for structuring the article
   * Usage: Pick one angle as your main perspective
   */
  angles: WritingAngle[];

  /**
   * Exploratory questions to address in the article
   * Usage: Answer 2-3 questions in your writing
   */
  questions: WritingQuestion[];
}

/**
 * An attention-grabbing opening hook
 */
export interface WritingHook {
  /** The hook text */
  text: string;

  /** Why this hook works */
  type: 'emotional' | 'curiosity' | 'controversy' | 'statistic' | 'story';
}

/**
 * A narrative angle or perspective
 */
export interface WritingAngle {
  /** Short title for the angle */
  title: string;

  /** Description of this perspective */
  description: string;

  /** How relevant to user's interests (0-1) */
  relevanceScore: number;
}

/**
 * A question to explore in writing
 */
export interface WritingQuestion {
  /** The question */
  question: string;

  /** Question category */
  type: 'analytical' | 'practical' | 'philosophical' | 'comparative';
}
```

#### `WritingKit`

```typescript
// packages/core/src/domain/writing-kit.ts

import type { ContentSummary } from './summary';
import type { WritingIdeas } from './ideas';

/**
 * Complete writing scaffold combining summary, ideas, and outline
 */
export interface WritingKit {
  /** Reference to source content */
  contentId: string;

  /** Simplified source reference */
  source: WritingKitSource;

  /** Content summary */
  summary: ContentSummary;

  /** Writing ideas */
  ideas: WritingIdeas;

  /** Suggested article outline */
  suggestedOutline: OutlineSection[];

  /** Kit metadata */
  meta: WritingKitMeta;
}

/**
 * Simplified source reference for display
 */
export interface WritingKitSource {
  id: string;
  label: string;
  url: string;
}

/**
 * An outline section
 */
export interface OutlineSection {
  /** Section heading */
  heading: string;

  /** Writing notes for this section */
  notes: string;

  /** Estimated word count for this section */
  estimatedWords?: number;
}

/**
 * Writing kit metadata
 */
export interface WritingKitMeta {
  /** Overall relevance to user (0-1) */
  relevanceToUser: number;

  /** Estimated reading time in minutes */
  estimatedReadingTimeMinutes: number;
}
```

#### `UserProfile`

```typescript
// packages/core/src/domain/user-profile.ts

/**
 * User profile for personalization
 */
export interface UserProfile {
  /** User identifier */
  userId: string;

  /** Topics of interest */
  topics: UserTopic[];

  /** Writing style preferences */
  style: WritingStyle;

  /** Example articles for voice matching (optional) */
  writingSamples?: string[];
}

/**
 * A topic the user is interested in
 */
export interface UserTopic {
  /** Topic name */
  topic: string;

  /** Interest level: 1 (low) to 5 (high) */
  interestLevel: 1 | 2 | 3 | 4 | 5;
}

/**
 * User's writing style preferences
 */
export interface WritingStyle {
  /** Target audience technical level */
  tone: 'beginner' | 'intermediate' | 'expert' | 'mixed';

  /** Target article length in words */
  targetWordCount: number;

  /** Preferred narrative voice */
  voice: 'first-person' | 'third-person' | 'instructional';
}
```

---

## 5. Ports (Provider Interfaces)

### 5.1 Common Types

```typescript
// packages/core/src/domain/errors.ts

/**
 * Result type for all provider operations
 */
export type ProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: ProviderError };

/**
 * Standardized error types across all providers
 */
export type ProviderError =
  | { type: 'rate_limit'; retryAfterMs: number; message: string }
  | { type: 'unsupported_language'; language: string; message: string }
  | { type: 'content_moderation'; reason: string; message: string }
  | { type: 'malformed_output'; expected: string; got: string; message: string }
  | { type: 'network_error'; cause?: Error; message: string }
  | { type: 'validation_error'; field: string; message: string }
  | { type: 'unknown'; cause?: Error; message: string };

/**
 * Helper to create success result
 */
export function ok<T>(data: T): ProviderResult<T> {
  return { success: true, data };
}

/**
 * Helper to create error result
 */
export function err<T>(error: ProviderError): ProviderResult<T> {
  return { success: false, error };
}
```

### 5.2 SummarizerProvider

```typescript
// packages/core/src/ports/summarizer.ts

import type { ContentItem } from '../domain/content';
import type { ContentSummary } from '../domain/summary';
import type { UserProfile } from '../domain/user-profile';
import type { ProviderResult } from '../domain/errors';

/**
 * Provider interface for content summarization
 *
 * Implementations should:
 * - Generate a headline, tldr, and bullet points
 * - Extract relevant tags
 * - Determine sentiment
 * - Calculate relevance score based on user profile
 */
export interface SummarizerProvider {
  /**
   * Summarize content item
   *
   * @param content - The content to summarize
   * @param user - Optional user profile for personalization
   * @returns Summary or error
   */
  summarize(
    content: ContentItem,
    user?: UserProfile
  ): Promise<ProviderResult<ContentSummary>>;
}
```

### 5.3 IdeaProvider

```typescript
// packages/core/src/ports/idea-generator.ts

import type { ContentSummary } from '../domain/summary';
import type { WritingIdeas } from '../domain/ideas';
import type { UserProfile } from '../domain/user-profile';
import type { ProviderResult } from '../domain/errors';

/**
 * Provider interface for generating writing ideas
 *
 * Implementations should:
 * - Generate attention-grabbing hooks
 * - Suggest narrative angles
 * - Formulate exploratory questions
 * - Consider user's interests and style
 */
export interface IdeaProvider {
  /**
   * Generate writing ideas from summary
   *
   * @param summary - The content summary
   * @param user - User profile for personalization
   * @returns Writing ideas or error
   */
  generateIdeas(
    summary: ContentSummary,
    user: UserProfile
  ): Promise<ProviderResult<WritingIdeas>>;
}
```

### 5.4 OutlineProvider

```typescript
// packages/core/src/ports/outline-generator.ts

import type { ContentSummary } from '../domain/summary';
import type { WritingIdeas } from '../domain/ideas';
import type { OutlineSection } from '../domain/writing-kit';
import type { UserProfile } from '../domain/user-profile';
import type { ProviderResult } from '../domain/errors';

/**
 * Provider interface for generating article outlines
 *
 * Implementations should:
 * - Create logical section structure
 * - Provide writing notes for each section
 * - Consider user's target word count
 * - Incorporate selected angles and hooks
 */
export interface OutlineProvider {
  /**
   * Generate article outline
   *
   * @param summary - The content summary
   * @param ideas - The generated writing ideas
   * @param user - User profile for personalization
   * @returns Outline sections or error
   */
  generateOutline(
    summary: ContentSummary,
    ideas: WritingIdeas,
    user: UserProfile
  ): Promise<ProviderResult<OutlineSection[]>>;
}
```

### 5.5 ScoringPolicy

```typescript
// packages/core/src/ports/scoring.ts

import type { ContentSummary } from '../domain/summary';
import type { UserProfile } from '../domain/user-profile';

/**
 * Policy interface for scoring and ranking content
 *
 * Note: Scoring should be stateless. Complex scoring
 * requiring historical data (like novelty detection)
 * should be handled at the application layer.
 */
export interface ScoringPolicy {
  /**
   * Calculate relevance score for content
   *
   * @param summary - The content summary
   * @param user - User profile
   * @returns Relevance score (0-1)
   */
  relevance(summary: ContentSummary, user: UserProfile): number;
}

/**
 * Default scoring policy based on topic matching
 */
export const defaultScoringPolicy: ScoringPolicy = {
  relevance(summary, user) {
    if (user.topics.length === 0) return 0.5;

    const summaryTags = new Set(summary.tags.map(t => t.toLowerCase()));

    let totalWeight = 0;
    let matchedWeight = 0;

    for (const topic of user.topics) {
      const weight = topic.interestLevel / 5;
      totalWeight += weight;

      if (summaryTags.has(topic.topic.toLowerCase())) {
        matchedWeight += weight;
      }
    }

    return totalWeight > 0 ? matchedWeight / totalWeight : 0.5;
  }
};
```

---

## 6. Services (Engines)

### 6.1 Summarization Engine

```typescript
// packages/core/src/services/summarization-engine.ts

import type { ContentItem } from '../domain/content';
import type { ContentSummary } from '../domain/summary';
import type { UserProfile } from '../domain/user-profile';
import type { ProviderResult } from '../domain/errors';
import type { SummarizerProvider } from '../ports/summarizer';
import { validateContentItem, validateContentSummary } from '../validation/schemas';

/**
 * Summarize content using the provided summarizer
 *
 * @param content - Content to summarize
 * @param user - Optional user profile
 * @param provider - Summarizer implementation
 * @returns Summary or error
 */
export async function summarizeContent(
  content: ContentItem,
  user: UserProfile | undefined,
  provider: SummarizerProvider
): Promise<ProviderResult<ContentSummary>> {
  // Validate input
  const inputValidation = validateContentItem(content);
  if (!inputValidation.success) {
    return {
      success: false,
      error: {
        type: 'validation_error',
        field: 'content',
        message: inputValidation.error.message
      }
    };
  }

  // Call provider
  const result = await provider.summarize(content, user);

  // Validate output
  if (result.success) {
    const outputValidation = validateContentSummary(result.data);
    if (!outputValidation.success) {
      return {
        success: false,
        error: {
          type: 'malformed_output',
          expected: 'ContentSummary',
          got: JSON.stringify(result.data),
          message: outputValidation.error.message
        }
      };
    }
  }

  return result;
}
```

### 6.2 Idea Engine

```typescript
// packages/core/src/services/idea-engine.ts

import type { ContentSummary } from '../domain/summary';
import type { WritingIdeas } from '../domain/ideas';
import type { UserProfile } from '../domain/user-profile';
import type { ProviderResult } from '../domain/errors';
import type { IdeaProvider } from '../ports/idea-generator';
import { validateWritingIdeas } from '../validation/schemas';

/**
 * Generate writing ideas from summary
 *
 * @param summary - Content summary
 * @param user - User profile
 * @param provider - Idea generator implementation
 * @returns Writing ideas or error
 */
export async function generateIdeas(
  summary: ContentSummary,
  user: UserProfile,
  provider: IdeaProvider
): Promise<ProviderResult<WritingIdeas>> {
  const result = await provider.generateIdeas(summary, user);

  if (result.success) {
    const validation = validateWritingIdeas(result.data);
    if (!validation.success) {
      return {
        success: false,
        error: {
          type: 'malformed_output',
          expected: 'WritingIdeas',
          got: JSON.stringify(result.data),
          message: validation.error.message
        }
      };
    }
  }

  return result;
}
```

### 6.3 Writing Kit Engine

```typescript
// packages/core/src/services/writing-kit-engine.ts

import type { ContentItem } from '../domain/content';
import type { UserProfile } from '../domain/user-profile';
import type { WritingKit } from '../domain/writing-kit';
import type { ProviderResult } from '../domain/errors';
import type { SummarizerProvider } from '../ports/summarizer';
import type { IdeaProvider } from '../ports/idea-generator';
import type { OutlineProvider } from '../ports/outline-generator';

/**
 * Provider bundle for building a complete writing kit
 */
export interface WritingKitProviders {
  summarizer: SummarizerProvider;
  idea: IdeaProvider;
  outline: OutlineProvider;
}

/**
 * Build a complete writing kit from content
 *
 * @param content - Source content
 * @param user - User profile
 * @param providers - Provider implementations
 * @returns Writing kit or error
 */
export async function buildWritingKit(
  content: ContentItem,
  user: UserProfile,
  providers: WritingKitProviders
): Promise<ProviderResult<WritingKit>> {
  // Step 1: Summarize
  const summaryResult = await providers.summarizer.summarize(content, user);
  if (!summaryResult.success) {
    return summaryResult;
  }
  const summary = summaryResult.data;

  // Step 2: Generate ideas
  const ideasResult = await providers.idea.generateIdeas(summary, user);
  if (!ideasResult.success) {
    return ideasResult;
  }
  const ideas = ideasResult.data;

  // Step 3: Generate outline
  const outlineResult = await providers.outline.generateOutline(summary, ideas, user);
  if (!outlineResult.success) {
    return outlineResult;
  }
  const outline = outlineResult.data;

  // Assemble kit
  const kit: WritingKit = {
    contentId: content.id,
    source: {
      id: content.source.id,
      label: content.source.label ?? content.source.url,
      url: content.url
    },
    summary,
    ideas,
    suggestedOutline: outline,
    meta: {
      relevanceToUser: summary.score.relevanceToUser,
      estimatedReadingTimeMinutes: estimateReadingTime(content.rawText)
    }
  };

  return { success: true, data: kit };
}

/**
 * Estimate reading time based on word count
 */
function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  const wordsPerMinute = 250;
  return Math.max(1, Math.round(words / wordsPerMinute));
}
```

### 6.4 Ranking Engine

```typescript
// packages/core/src/services/ranking-engine.ts

import type { WritingKit } from '../domain/writing-kit';
import type { UserProfile } from '../domain/user-profile';
import type { ScoringPolicy } from '../ports/scoring';
import { defaultScoringPolicy } from '../ports/scoring';

/**
 * Rank writing kits by relevance to user
 *
 * @param kits - Kits to rank
 * @param user - User profile
 * @param policy - Scoring policy (optional)
 * @returns Sorted kits (most relevant first)
 */
export function rankKits(
  kits: WritingKit[],
  user: UserProfile,
  policy: ScoringPolicy = defaultScoringPolicy
): WritingKit[] {
  return [...kits]
    .map(kit => ({
      kit,
      score: policy.relevance(kit.summary, user)
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ kit }) => kit);
}
```

---

## 7. Adapters

> Note: Adapters in this package should only define interfaces and mock/test doubles. Concrete provider implementations (e.g., Claude, OpenAI, Ollama) should live in external packages under the `@looplia/provider-*` namespace.

### 7.1 Mock Summarizer

```typescript
// packages/core/src/adapters/mock/mock-summarizer.ts

import type { SummarizerProvider } from '../../ports/summarizer';
import type { ContentItem } from '../../domain/content';
import type { UserProfile } from '../../domain/user-profile';
import type { ContentSummary } from '../../domain/summary';
import type { ProviderResult } from '../../domain/errors';

/**
 * Create a mock summarizer for testing
 *
 * This provider generates summaries without calling any LLM.
 * Useful for testing, demos, and development.
 */
export function createMockSummarizer(): SummarizerProvider {
  return {
    async summarize(
      content: ContentItem,
      user?: UserProfile
    ): Promise<ProviderResult<ContentSummary>> {
      const text = content.rawText.trim();
      const sentences = text.split(/[.!?]+/).filter(s => s.trim());

      // Extract first sentence as headline
      const headline = sentences[0]?.trim().slice(0, 200) ?? content.title;

      // Use first few sentences as TLDR
      const tldr = sentences.slice(0, 3).join('. ').slice(0, 500);

      // Extract some "bullets" from the text
      const bullets = sentences.slice(0, 5).map(s => s.trim());

      // Simple tag extraction (words that appear multiple times)
      const words = text.toLowerCase().split(/\s+/);
      const wordCounts = new Map<string, number>();
      for (const word of words) {
        if (word.length > 4) {
          wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
        }
      }
      const tags = [...wordCounts.entries()]
        .filter(([, count]) => count > 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);

      // Calculate mock relevance
      let relevance = 0.5;
      if (user?.topics) {
        const topicSet = new Set(user.topics.map(t => t.topic.toLowerCase()));
        const matchCount = tags.filter(t => topicSet.has(t)).length;
        relevance = Math.min(1, 0.5 + (matchCount * 0.1));
      }

      const summary: ContentSummary = {
        contentId: content.id,
        headline,
        tldr,
        bullets,
        tags: tags.length > 0 ? tags : ['general'],
        sentiment: 'neutral',
        category: 'article',
        score: {
          relevanceToUser: relevance
        }
      };

      return { success: true, data: summary };
    }
  };
}
```

### 7.2 Mock Idea Generator

```typescript
// packages/core/src/adapters/mock/mock-idea-generator.ts

import type { IdeaProvider } from '../../ports/idea-generator';
import type { ContentSummary } from '../../domain/summary';
import type { UserProfile } from '../../domain/user-profile';
import type { WritingIdeas } from '../../domain/ideas';
import type { ProviderResult } from '../../domain/errors';

/**
 * Create a mock idea generator for testing
 */
export function createMockIdeaGenerator(): IdeaProvider {
  return {
    async generateIdeas(
      summary: ContentSummary,
      user: UserProfile
    ): Promise<ProviderResult<WritingIdeas>> {
      const ideas: WritingIdeas = {
        contentId: summary.contentId,
        hooks: [
          {
            text: `What if ${summary.headline.toLowerCase()}?`,
            type: 'curiosity'
          },
          {
            text: `The surprising truth about ${summary.tags[0] ?? 'this topic'}`,
            type: 'controversy'
          }
        ],
        angles: [
          {
            title: 'Beginner\'s Guide',
            description: `Explain ${summary.tags[0] ?? 'this concept'} for newcomers`,
            relevanceScore: user.style.tone === 'beginner' ? 0.9 : 0.5
          },
          {
            title: 'Deep Dive',
            description: `Technical analysis of ${summary.headline}`,
            relevanceScore: user.style.tone === 'expert' ? 0.9 : 0.5
          }
        ],
        questions: [
          {
            question: `How does ${summary.tags[0] ?? 'this'} affect your daily workflow?`,
            type: 'practical'
          },
          {
            question: `What are the long-term implications of ${summary.headline}?`,
            type: 'analytical'
          }
        ]
      };

      return { success: true, data: ideas };
    }
  };
}
```

### 7.3 Mock Outline Generator

```typescript
// packages/core/src/adapters/mock/mock-outline-generator.ts

import type { OutlineProvider } from '../../ports/outline-generator';
import type { ContentSummary } from '../../domain/summary';
import type { WritingIdeas } from '../../domain/ideas';
import type { UserProfile } from '../../domain/user-profile';
import type { OutlineSection } from '../../domain/writing-kit';
import type { ProviderResult } from '../../domain/errors';

/**
 * Create a mock outline generator for testing
 */
export function createMockOutlineGenerator(): OutlineProvider {
  return {
    async generateOutline(
      summary: ContentSummary,
      ideas: WritingIdeas,
      user: UserProfile
    ): Promise<ProviderResult<OutlineSection[]>> {
      const totalWords = user.style.targetWordCount;
      const sections = Math.max(3, Math.ceil(totalWords / 300));
      const wordsPerSection = Math.floor(totalWords / sections);

      const outline: OutlineSection[] = [
        {
          heading: 'Introduction',
          notes: `Open with hook: "${ideas.hooks[0]?.text ?? 'Start with an engaging hook'}". Set up the context for ${summary.headline}.`,
          estimatedWords: wordsPerSection
        },
        {
          heading: 'Main Point',
          notes: `Develop the angle: ${ideas.angles[0]?.title ?? 'Main perspective'}. Use bullets: ${summary.bullets.slice(0, 2).join(', ')}.`,
          estimatedWords: wordsPerSection * 2
        },
        {
          heading: 'Analysis',
          notes: `Address: ${ideas.questions[0]?.question ?? 'Key question'}. Provide insights based on ${summary.tldr.slice(0, 100)}...`,
          estimatedWords: wordsPerSection
        },
        {
          heading: 'Conclusion',
          notes: `Summarize key takeaways. Call to action based on ${ideas.angles[0]?.description ?? 'main angle'}.`,
          estimatedWords: wordsPerSection
        }
      ];

      return { success: true, data: outline };
    }
  };
}
```

### 7.4 Adapter Index

```typescript
// packages/core/src/adapters/mock/index.ts

export { createMockSummarizer } from './mock-summarizer';
export { createMockIdeaGenerator } from './mock-idea-generator';
export { createMockOutlineGenerator } from './mock-outline-generator';
```

---

## 8. CLI Design

### 8.1 Commands Overview

```
looplia <command> [options]

Commands:
  summarize    Summarize content from a file
  kit          Build a complete writing kit from content

Global Options:
  --help       Show help
  --version    Show version
```

### 8.2 Summarize Command

```
looplia summarize --file <path> [options]

Options:
  --file, -f    Path to content file (required)
  --format      Output format: json, markdown (default: json)
  --output, -o  Output file path (default: stdout)

Example:
  looplia summarize --file ./article.txt --format markdown
```

### 8.3 Kit Command

```
looplia kit --file <path> [options]

Options:
  --file, -f         Path to content file (required)
  --format           Output format: json, markdown (default: json)
  --output, -o       Output file path (default: stdout)
  --topics           Comma-separated topics of interest
  --tone             Writing tone: beginner, intermediate, expert, mixed
  --word-count       Target word count (default: 1000)

Example:
  looplia kit --file ./article.txt --topics "ai,productivity" --tone expert
```

### 8.4 CLI Entry Point

```typescript
// apps/cli/src/index.ts

#!/usr/bin/env node

import { runSummarizeCommand } from './commands/summarize';
import { runKitCommand } from './commands/kit';

const VERSION = '0.1.0';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  if (args.includes('--help') || args.includes('-h') || !command) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`looplia ${VERSION}`);
    process.exit(0);
  }

  switch (command) {
    case 'summarize':
      await runSummarizeCommand(rest);
      break;
    case 'kit':
      await runKitCommand(rest);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
looplia - Content intelligence CLI

Usage:
  looplia <command> [options]

Commands:
  summarize    Summarize content from a file
  kit          Build a complete writing kit

Options:
  --help, -h     Show this help
  --version, -v  Show version

Examples:
  looplia summarize --file ./article.txt
  looplia kit --file ./article.txt --topics "ai,startup"

For command-specific help:
  looplia <command> --help
`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
```

---

## 9. Error Handling

### 9.1 Error Flow

```
Provider Error
      │
      ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Provider  │ ──▶ │   Service   │ ──▶ │   Caller    │
│  (catches)  │     │ (propagates)│     │  (handles)  │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │
      ▼                    ▼                    ▼
  ProviderError       ProviderResult      User message
```

### 9.2 Error Handling Patterns

**In Providers:**
```typescript
async function summarize(content, user) {
  try {
    const response = await callLLM(content);
    return { success: true, data: parseResponse(response) };
  } catch (error) {
    if (isRateLimitError(error)) {
      return {
        success: false,
        error: {
          type: 'rate_limit',
          retryAfterMs: error.retryAfter * 1000,
          message: 'Rate limit exceeded'
        }
      };
    }
    return {
      success: false,
      error: {
        type: 'unknown',
        cause: error,
        message: error.message
      }
    };
  }
}
```

**In Services:**
```typescript
async function buildWritingKit(content, user, providers) {
  // Propagate errors up the chain
  const summaryResult = await providers.summarizer.summarize(content, user);
  if (!summaryResult.success) {
    return summaryResult; // Propagate error
  }
  // Continue with success...
}
```

**In CLI:**
```typescript
const result = await buildWritingKit(content, user, providers);

if (!result.success) {
  switch (result.error.type) {
    case 'rate_limit':
      console.error(`Rate limited. Retry in ${result.error.retryAfterMs}ms`);
      break;
    case 'content_moderation':
      console.error(`Content blocked: ${result.error.reason}`);
      break;
    default:
      console.error(`Error: ${result.error.message}`);
  }
  process.exit(1);
}
```

---

## 10. Validation

### 10.1 Zod Schemas

```typescript
// packages/core/src/validation/schemas.ts

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Content Schemas
// ─────────────────────────────────────────────────────────────

export const SourceTypeSchema = z.enum([
  'rss', 'youtube', 'podcast', 'twitter', 'custom'
]);

export const SourceSchema = z.object({
  id: z.string().min(1),
  type: SourceTypeSchema,
  label: z.string().optional(),
  url: z.string(),
  metadata: z.record(z.unknown()).optional()
});

export const ContentMetadataSchema = z.object({
  language: z.string().length(2).optional(),
  durationSeconds: z.number().positive().optional(),
  author: z.string().optional(),
  wordCount: z.number().positive().optional()
}).passthrough();

export const ContentItemSchema = z.object({
  id: z.string().min(1),
  source: SourceSchema,
  title: z.string().min(1),
  url: z.string(),
  publishedAt: z.string().optional(),
  rawText: z.string().min(1),
  metadata: ContentMetadataSchema
});

// ─────────────────────────────────────────────────────────────
// Summary Schemas
// ─────────────────────────────────────────────────────────────

export const SummaryScoreSchema = z.object({
  relevanceToUser: z.number().min(0).max(1)
});

export const ContentSummarySchema = z.object({
  contentId: z.string().min(1),
  headline: z.string().min(10).max(200),
  tldr: z.string().min(20).max(500),
  bullets: z.array(z.string()).min(1).max(10),
  tags: z.array(z.string()).min(1).max(20),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  category: z.string(),
  score: SummaryScoreSchema
});

// ─────────────────────────────────────────────────────────────
// Ideas Schemas
// ─────────────────────────────────────────────────────────────

export const WritingHookSchema = z.object({
  text: z.string().min(5),
  type: z.enum(['emotional', 'curiosity', 'controversy', 'statistic', 'story'])
});

export const WritingAngleSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  relevanceScore: z.number().min(0).max(1)
});

export const WritingQuestionSchema = z.object({
  question: z.string().min(10),
  type: z.enum(['analytical', 'practical', 'philosophical', 'comparative'])
});

export const WritingIdeasSchema = z.object({
  contentId: z.string().min(1),
  hooks: z.array(WritingHookSchema).min(1).max(5),
  angles: z.array(WritingAngleSchema).min(1).max(5),
  questions: z.array(WritingQuestionSchema).min(1).max(5)
});

// ─────────────────────────────────────────────────────────────
// User Profile Schemas
// ─────────────────────────────────────────────────────────────

export const UserTopicSchema = z.object({
  topic: z.string().min(1),
  interestLevel: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5)
  ])
});

export const WritingStyleSchema = z.object({
  tone: z.enum(['beginner', 'intermediate', 'expert', 'mixed']),
  targetWordCount: z.number().min(100).max(10000),
  voice: z.enum(['first-person', 'third-person', 'instructional'])
});

export const UserProfileSchema = z.object({
  userId: z.string().min(1),
  topics: z.array(UserTopicSchema),
  style: WritingStyleSchema,
  writingSamples: z.array(z.string()).optional()
});

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

export function validateContentItem(data: unknown): ValidationResult<z.infer<typeof ContentItemSchema>> {
  const result = ContentItemSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validateContentSummary(data: unknown): ValidationResult<z.infer<typeof ContentSummarySchema>> {
  const result = ContentSummarySchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validateWritingIdeas(data: unknown): ValidationResult<z.infer<typeof WritingIdeasSchema>> {
  const result = WritingIdeasSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}

export function validateUserProfile(data: unknown): ValidationResult<z.infer<typeof UserProfileSchema>> {
  const result = UserProfileSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: { message: result.error.message } };
}
```

---

## 11. Testing Strategy

### 11.1 Test Structure

```
packages/core/test/
├── domain/
│   └── validation.test.ts      # Schema validation tests
├── services/
│   ├── summarization-engine.test.ts
│   ├── idea-engine.test.ts
│   ├── writing-kit-engine.test.ts
│   └── ranking-engine.test.ts
├── adapters/
│   └── mock/
│       ├── mock-summarizer.test.ts
│       ├── mock-idea-generator.test.ts
│       └── mock-outline-generator.test.ts
└── integration/
    └── full-pipeline.test.ts

apps/cli/test/
├── commands/
│   ├── summarize.test.ts
│   └── kit.test.ts
└── e2e/
    └── cli.test.ts
```

### 11.2 Unit Test Examples

**Service Tests:**
```typescript
// packages/core/test/services/summarization-engine.test.ts

import { describe, it, expect, vi } from 'vitest';
import { summarizeContent } from '../../src/services/summarization-engine';
import type { SummarizerProvider } from '../../src/ports/summarizer';
import type { ContentItem } from '../../src/domain/content';

describe('summarizeContent', () => {
  const mockContent: ContentItem = {
    id: 'test-1',
    title: 'Test Article',
    url: 'https://example.com',
    rawText: 'This is a test article with enough content to summarize.',
    source: { id: 'test', type: 'custom', url: '' },
    metadata: {}
  };

  it('should return summary from provider', async () => {
    const mockProvider: SummarizerProvider = {
      summarize: vi.fn().mockResolvedValue({
        success: true,
        data: {
          contentId: 'test-1',
          headline: 'Test headline here',
          tldr: 'This is a test TLDR summary',
          bullets: ['Point 1'],
          tags: ['test'],
          sentiment: 'neutral',
          category: 'test',
          score: { relevanceToUser: 0.5 }
        }
      })
    };

    const result = await summarizeContent(mockContent, undefined, mockProvider);

    expect(result.success).toBe(true);
    expect(mockProvider.summarize).toHaveBeenCalledWith(mockContent, undefined);
  });

  it('should propagate provider errors', async () => {
    const mockProvider: SummarizerProvider = {
      summarize: vi.fn().mockResolvedValue({
        success: false,
        error: { type: 'rate_limit', retryAfterMs: 1000, message: 'Rate limited' }
      })
    };

    const result = await summarizeContent(mockContent, undefined, mockProvider);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('rate_limit');
    }
  });
});
```

**Validation Tests:**
```typescript
// packages/core/test/domain/validation.test.ts

import { describe, it, expect } from 'vitest';
import { validateContentSummary } from '../../src/validation/schemas';

describe('ContentSummary validation', () => {
  it('should accept valid summary', () => {
    const valid = {
      contentId: 'test-1',
      headline: 'This is a valid headline',
      tldr: 'This is a valid TLDR that is long enough',
      bullets: ['Point 1', 'Point 2'],
      tags: ['tag1', 'tag2'],
      sentiment: 'neutral',
      category: 'article',
      score: { relevanceToUser: 0.75 }
    };

    const result = validateContentSummary(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid score', () => {
    const invalid = {
      contentId: 'test-1',
      headline: 'This is a valid headline',
      tldr: 'This is a valid TLDR that is long enough',
      bullets: ['Point 1'],
      tags: ['tag1'],
      sentiment: 'neutral',
      category: 'article',
      score: { relevanceToUser: 1.5 } // Invalid: > 1
    };

    const result = validateContentSummary(invalid);
    expect(result.success).toBe(false);
  });
});
```

### 11.3 Integration Tests

```typescript
// packages/core/test/integration/full-pipeline.test.ts

import { describe, it, expect } from 'vitest';
import { buildWritingKit } from '../../src/services/writing-kit-engine';
import { createMockSummarizer } from '../../src/adapters/mock/mock-summarizer';
import { createMockIdeaGenerator } from '../../src/adapters/mock/mock-idea-generator';
import { createMockOutlineGenerator } from '../../src/adapters/mock/mock-outline-generator';
import type { ContentItem } from '../../src/domain/content';
import type { UserProfile } from '../../src/domain/user-profile';

describe('Full Pipeline Integration', () => {
  const content: ContentItem = {
    id: 'test-content',
    title: 'Understanding AI Agents',
    url: 'https://example.com/ai-agents',
    rawText: `
      AI agents are autonomous systems that can perceive their environment
      and take actions to achieve specific goals. They represent a significant
      advancement in artificial intelligence, enabling more complex and
      adaptive behaviors than traditional rule-based systems.
    `,
    source: { id: 'blog', type: 'rss', url: 'https://example.com/feed' },
    metadata: { language: 'en' }
  };

  const user: UserProfile = {
    userId: 'user-1',
    topics: [
      { topic: 'ai', interestLevel: 5 },
      { topic: 'agents', interestLevel: 4 }
    ],
    style: {
      tone: 'intermediate',
      targetWordCount: 1000,
      voice: 'first-person'
    }
  };

  it('should produce complete writing kit', async () => {
    const providers = {
      summarizer: createMockSummarizer(),
      idea: createMockIdeaGenerator(),
      outline: createMockOutlineGenerator()
    };

    const result = await buildWritingKit(content, user, providers);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentId).toBe('test-content');
      expect(result.data.summary.headline).toBeDefined();
      expect(result.data.ideas.hooks.length).toBeGreaterThan(0);
      expect(result.data.suggestedOutline.length).toBeGreaterThan(0);
    }
  });
});
```

---

## 12. Future Evolution

### 12.1 Streaming Support (v0.2)

Progressive result generation for better UX:

```typescript
interface StreamingContentProcessor {
  process(
    content: ContentItem,
    user: UserProfile
  ): AsyncGenerator<WritingKitChunk>;
}

type WritingKitChunk =
  | { type: 'summary'; data: ContentSummary }
  | { type: 'ideas'; data: WritingIdeas }
  | { type: 'outline'; data: OutlineSection[] };
```

### 12.2 CLI Enhancements (v0.2)

- Add `--provider` flag to select external providers (e.g., Claude) without changing code.
- Support `--format json` and `--format markdown` output modes across commands.
- Default provider (when unspecified): Claude Agent SDK via `@looplia/provider-claude`.

### 12.3 Batch Processing (v0.2)

Process multiple content items efficiently:

```typescript
async function batchBuildWritingKits(
  contents: ContentItem[],
  user: UserProfile,
  providers: WritingKitProviders,
  options?: { concurrency?: number }
): Promise<ProviderResult<WritingKit>[]>
```

### 12.4 Provider Ecosystem (v0.3)

External provider packages:

```
@looplia/provider-claude    - Claude API integration
@looplia/provider-openai    - OpenAI API integration
@looplia/provider-ollama    - Local Ollama models
@looplia/provider-deepseek  - DeepSeek integration
```

The first (default) agent we ship and document is the Claude Agent SDK integration (`@looplia/provider-claude`), which the CLI should use by default unless `--provider` overrides it.

Add an `/examples` directory that shows end-to-end integration with `@looplia/provider-claude` (including an agent-driven writing workflow that exercises provider-specific skills).

### 12.5 Caching Layer (v0.3)

Optional caching for expensive operations:

```typescript
interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
}

function createCachedSummarizer(
  summarizer: SummarizerProvider,
  cache: CacheProvider
): SummarizerProvider
```

### 12.6 Plugin System (v0.4)

Extensibility via plugins:

```typescript
interface LoopliaPlugin {
  name: string;

  // Hook into pipeline stages
  beforeSummarize?(content: ContentItem): ContentItem;
  afterSummarize?(summary: ContentSummary): ContentSummary;

  // Custom scoring
  scoringPolicy?: ScoringPolicy;

  // Custom transformers
  transformers?: Transformer[];
}
```

---

## Appendix: Public API Exports

```typescript
// packages/core/src/index.ts

// Domain Types
export type { Source, SourceType, ContentItem, ContentMetadata } from './domain/content';
export type { ContentSummary, SummaryScore } from './domain/summary';
export type { WritingIdeas, WritingHook, WritingAngle, WritingQuestion } from './domain/ideas';
export type { WritingKit, WritingKitSource, OutlineSection, WritingKitMeta } from './domain/writing-kit';
export type { UserProfile, UserTopic, WritingStyle } from './domain/user-profile';
export type { ProviderResult, ProviderError } from './domain/errors';
export { ok, err } from './domain/errors';

// Provider Interfaces
export type { SummarizerProvider } from './ports/summarizer';
export type { IdeaProvider } from './ports/idea-generator';
export type { OutlineProvider } from './ports/outline-generator';
export type { ScoringPolicy } from './ports/scoring';
export { defaultScoringPolicy } from './ports/scoring';

// Services
export { summarizeContent } from './services/summarization-engine';
export { generateIdeas } from './services/idea-engine';
export { buildWritingKit, type WritingKitProviders } from './services/writing-kit-engine';
export { rankKits } from './services/ranking-engine';

// Mock Adapters
export {
  createMockSummarizer,
  createMockIdeaGenerator,
  createMockOutlineGenerator
} from './adapters/mock';

// Validation
export {
  ContentItemSchema,
  ContentSummarySchema,
  WritingIdeasSchema,
  UserProfileSchema,
  validateContentItem,
  validateContentSummary,
  validateWritingIdeas,
  validateUserProfile
} from './validation/schemas';
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2025-12-05 | Initial design document |
