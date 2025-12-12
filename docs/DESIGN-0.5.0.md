# Looplia-Core Architecture Design v0.5.0

> Reliability through Simplicity: Session Manifest & Clean Architecture
>
> **Version:** 0.5.0
> **Date:** 2025-12-12
> **Related:** [GLOSSARY.md](./GLOSSARY.md) | [DESIGN-0.4.0.md](./DESIGN-0.4.0.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Philosophy](#2-design-philosophy)
3. [Problem Analysis](#3-problem-analysis)
4. [Session Manifest System](#4-session-manifest-system)
5. [DisplayConfig Decoupling](#5-displayconfig-decoupling)
6. [Implementation Plan](#6-implementation-plan)
7. [Deferred Decisions](#7-deferred-decisions)

---

## 1. Executive Summary

### Evolution from v0.4.0 to v0.5.0

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.4.0 | Clean Architecture | CommandDefinition<T> abstraction |
| **v0.5.0** | **Reliability & Simplicity** | **Session Manifest, Architecture Refinement** |

### Scope (Intentionally Minimal)

| In Scope | Out of Scope (Deferred) |
|----------|------------------------|
| Session manifest for continuation | Content hash verification |
| DisplayConfig decoupling | Intermediate artifact validation |
| Simplified step tracking | Provider-side manifest reconciliation |
| | Tool/path safety policies |
| | Plugin compatibility versioning |

### Key Improvements

1. **Session Manifest** - `session.json` tracks step completion status
2. **Clean Architecture Purity** - DisplayConfig moved from core to CLI layer

---

## 2. Design Philosophy

### Agent-First Infrastructure

Looplia-Core is **agent infrastructure**, not traditional application code. This has implications:

> **Principle:** Trust the agent for semantic decisions. Use TypeScript only for I/O boundaries and type safety.

| Concern | Agent Responsibility | TypeScript Responsibility |
|---------|---------------------|--------------------------|
| Workflow orchestration | Agent decides what steps to run | Define available commands |
| State tracking | Agent reads/writes session.json | Provide file I/O |
| Validation | Agent ensures output quality | Validate final StructuredOutput |
| Error recovery | Agent retries or reports | Surface errors to user |

### Why Not More Defensive?

We considered and **intentionally deferred** several defensive features:

| Feature | Why Deferred |
|---------|--------------|
| **Content hash verification** | Adds complexity; file timestamps suffice for now |
| **Validation interceptor** | Final output validation catches most issues; intermediate validation adds pipeline complexity |
| **Provider-side manifest updates** | Contradicts "agent manages state" principle; reconsider if agent reliability proves insufficient |
| **Schema versioning** | Premature; revisit when we actually need migrations |

**Decision Note:** These can be added in v0.6+ if real-world usage reveals the need. We prefer shipping a working v0.5.0 over a theoretically complete one.

---

## 3. Problem Analysis

### 3.1 Smart Continuation Fragility

**v0.4.0 Behavior:**

```typescript
// Agent checks file existence in prompt
"First, check which files already exist:
- summary.json → If exists, skip content-analyzer"
```

**Failure Modes:**

| Scenario | Result |
|----------|--------|
| Partial write (file exists but incomplete) | Agent skips step, next step fails |
| Agent interrupted mid-workflow | No record of what completed |
| User wants to re-run a step | No way to signal "force re-run" |

**v0.5.0 Solution:** Explicit step status in `session.json`.

### 3.2 DisplayConfig Architecture Leak

**v0.4.0:** `DisplayConfig` in core layer (TUI concerns in business logic).

**v0.5.0:** Move to CLI layer. CommandDefinition focuses on business logic only.

---

## 4. Session Manifest System

### 4.1 Overview

A minimal manifest that tracks **what steps are done**, not how they were done.

**File:** `contentItem/{id}/session.json`

### 4.2 Manifest Structure (Simplified)

```typescript
type SessionManifest = {
  /** Manifest format version */
  version: 1;
  /** Content ID */
  contentId: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Step completion status */
  steps: {
    analyzing?: "done";
    generating_ideas?: "done";
    building_outline?: "done";
    assembling_kit?: "done";
  };
};
```

**Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| **No `pending`/`in_progress` states** | Binary "done" or "not done" is simpler; agent handles in-progress state |
| **No content hashes** | File timestamps suffice; adds complexity without proven benefit |
| **No `createdAt`** | Folder creation time serves this purpose |
| **No `sourceHash`** | If user wants to re-analyze, they create new session |

### 4.3 Example Manifest

```json
{
  "version": 1,
  "contentId": "article-2025-12-12-a1b2c3",
  "updatedAt": "2025-12-12T10:35:42.000Z",
  "steps": {
    "analyzing": "done",
    "generating_ideas": "done"
  }
}
```

### 4.4 Step-to-Artifact Mapping

| Step Name | Artifact File | Subagent |
|-----------|---------------|----------|
| `analyzing` | `summary.json` | content-analyzer |
| `generating_ideas` | `ideas.json` | idea-generator |
| `building_outline` | `outline.json` | writing-kit-builder |
| `assembling_kit` | `writing-kit.json` | writing-kit-builder |

**Note:** `writing-kit-builder` produces both `outline.json` and `writing-kit.json`. Both steps should be marked done together.

### 4.5 Domain Types

**Location:** `packages/core/src/domain/session.ts`

```typescript
/**
 * Step names in the writing kit pipeline
 */
export type StepName =
  | "analyzing"
  | "generating_ideas"
  | "building_outline"
  | "assembling_kit";

/**
 * Session Manifest - minimal step tracking
 *
 * Agent manages this file. TypeScript only provides types.
 */
export type SessionManifest = {
  version: 1;
  contentId: string;
  updatedAt: string;
  steps: Partial<Record<StepName, "done">>;
};
```

### 4.6 Validation Schema

**Location:** `packages/core/src/validation/schemas.ts`

```typescript
export const StepNameSchema = z.enum([
  "analyzing",
  "generating_ideas",
  "building_outline",
  "assembling_kit",
]);

export const SessionManifestSchema = z.object({
  version: z.literal(1),
  contentId: z.string().min(1),
  updatedAt: z.string(),
  steps: z.record(StepNameSchema, z.literal("done")).partial(),
});
```

### 4.7 Updated Prompt Template

**Location:** `packages/core/src/commands/kit.ts`

```typescript
function buildPrompt(ctx: PromptContext): string {
  return `Task: Build WritingKit for session: contentItem/${ctx.contentId}

## Session State Management

1. Read contentItem/${ctx.contentId}/session.json (if exists)
2. Check which steps are marked "done" in the manifest
3. Skip steps that are already done AND have their artifact file present
4. After completing each step, update session.json:
   - Add the step to "steps" with value "done"
   - Update "updatedAt" to current ISO timestamp

If session.json doesn't exist, create it after the first step completes.

## Workflow

Step 1: analyzing → summary.json
  IF steps.analyzing !== "done" OR summary.json missing:
  → Invoke content-analyzer subagent

Step 2: generating_ideas → ideas.json
  IF steps.generating_ideas !== "done" OR ideas.json missing:
  → Invoke idea-generator subagent

Step 3: building_outline + assembling_kit → outline.json + writing-kit.json
  IF steps.assembling_kit !== "done" OR writing-kit.json missing:
  → Invoke writing-kit-builder subagent
  → Mark BOTH building_outline and assembling_kit as "done"

Step 4: Return
  → Read writing-kit.json and return as structured output`;
}
```

### 4.8 Session Folder Structure

```
~/.looplia/
└── contentItem/{contentId}/
    ├── content.md          # Input content
    ├── session.json        # Session manifest (v0.5.0)
    ├── summary.json        # From content-analyzer
    ├── ideas.json          # From idea-generator
    ├── outline.json        # From writing-kit-builder
    └── writing-kit.json    # Final output
```

---

## 5. DisplayConfig Decoupling

### 5.1 Rationale

Core layer should not contain presentation concerns. This is a straightforward Clean Architecture fix.

### 5.2 Changes

**Remove from Core:**
- `DisplayConfig` type from `packages/core/src/commands/types.ts`
- `displayConfig` property from `CommandDefinition`

**Add to CLI:**

**Location:** `apps/cli/src/config/display-config.ts`

```typescript
export type DisplayConfig = {
  title: string;
  successMessage: string;
  sessionInfoFormat?: string;
  nextStep?: {
    description: string;
    commandTemplate: string;
  } | null;
};

export const DISPLAY_CONFIGS: Record<string, DisplayConfig> = {
  kit: {
    title: "Writing Kit Builder",
    successMessage: "Writing kit complete",
    sessionInfoFormat: "~/.looplia/contentItem/{contentId}/writing-kit.json",
    nextStep: null,
  },
  summarize: {
    title: "Content Summarizer",
    successMessage: "Summary complete",
    sessionInfoFormat: "~/.looplia/contentItem/{contentId}/summary.json",
    nextStep: {
      description: "Next step:",
      commandTemplate: "looplia kit --session-id {contentId}",
    },
  },
};

export function getDisplayConfig(commandName: string): DisplayConfig | undefined {
  return DISPLAY_CONFIGS[commandName];
}
```

### 5.3 Updated CommandDefinition

```typescript
export type CommandDefinition<TOutput = unknown> = {
  name: string;
  promptTemplate: (context: PromptContext) => string;
  outputSchema: z.ZodType<TOutput>;
  // displayConfig removed - now in CLI layer
};
```

---

## 6. Implementation Plan

### 6.1 Phase Order

| Phase | Task | Files |
|-------|------|-------|
| 1 | DisplayConfig decoupling | CLI config, core types, commands |
| 2 | Session manifest types | Core domain, validation |
| 3 | Prompt template updates | Core commands |
| 4 | Documentation | GLOSSARY, tests |

### 6.2 Phase 1: DisplayConfig Decoupling

**Create:**
- `apps/cli/src/config/display-config.ts`

**Modify:**
- `packages/core/src/commands/types.ts` - Remove DisplayConfig
- `packages/core/src/commands/kit.ts` - Remove displayConfig
- `packages/core/src/commands/summarize.ts` - Remove displayConfig
- `apps/cli/src/runtime/looplia-runtime.ts` - Use CLI config
- `apps/cli/src/renderers/*.ts` - Use CLI config

### 6.3 Phase 2: Session Manifest Types

**Create:**
- `packages/core/src/domain/session.ts`

**Modify:**
- `packages/core/src/validation/schemas.ts` - Add manifest schema
- `packages/core/src/index.ts` - Export types

### 6.4 Phase 3: Prompt Template Updates

**Modify:**
- `packages/core/src/commands/kit.ts` - Update prompt for manifest
- `packages/core/src/commands/summarize.ts` - Update prompt for manifest

### 6.5 Phase 4: Documentation & Tests

- Update `docs/GLOSSARY.md`
- Add tests for new types
- Update `docs/README.md`

---

## 7. Deferred Decisions

These items were considered but intentionally deferred to keep v0.5.0 focused:

### 7.1 Content Hash Verification (Deferred to v0.6+)

**What:** SHA-256 hash of artifact content stored in manifest.

**Why Deferred:** Adds complexity. File existence + step status is sufficient for current needs. If we see "false completion" issues in production, we'll add this.

**Trigger to Reconsider:** Users report corrupted artifacts being skipped.

### 7.2 Intermediate Artifact Validation (Deferred to v0.6+)

**What:** Zod validation of each artifact after write, with retry hints.

**Why Deferred:** Final StructuredOutput validation catches most issues. Intermediate validation adds streaming pipeline complexity.

**Trigger to Reconsider:** Frequent failures in later steps due to malformed intermediate files.

### 7.3 Provider-Side Manifest Reconciliation (Deferred)

**What:** TypeScript code updates session.json after detecting artifact writes.

**Why Deferred:** Contradicts agent-first philosophy. Agent should manage its own state.

**Trigger to Reconsider:** Agent frequently forgets to update manifest, causing continuation bugs.

### 7.4 Tool/Path Safety Policy (Deferred to v0.6+)

**What:** Allowlist paths, deny dangerous operations in executor.

**Why Deferred:** Currently using `permissionMode: "bypassPermissions"` intentionally for agent autonomy. Security hardening is a separate concern.

**Trigger to Reconsider:** Security audit or production deployment requirements.

### 7.5 Plugin Compatibility Versioning (Deferred to v0.6+)

**What:** `plugin.json` with version ranges, migration warnings.

**Why Deferred:** Only one plugin exists. Version when we have multiple plugins or breaking changes.

**Trigger to Reconsider:** Second plugin added or schema-breaking changes needed.

---

## Cross-References

- **Previous Version:** See [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) for v0.4.0 architecture
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md) for term definitions
- **Agentic Concept:** See [AGENTIC_CONCEPT-0.3.md](./AGENTIC_CONCEPT-0.3.md) for agent system design

---

*This document serves as the single source of truth for Looplia-Core v0.5.0 architecture.*
