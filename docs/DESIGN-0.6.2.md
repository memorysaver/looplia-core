# Looplia-Core Architecture Design v0.6.2

> **BREAKING CHANGE:** Schema-in-Skill Architecture - Remove Workflow-Specific Types from Core
>
> **Version:** 0.6.2
> **Date:** 2025-12-21
> **Related:** [DESIGN-0.6.1.md](./DESIGN-0.6.1.md) | [CLEANUP-0.6.1.md](./CLEANUP-0.6.1.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Architecture Change](#3-architecture-change)
4. [What Gets Deleted](#4-what-gets-deleted)
5. [What Remains](#5-what-remains)
6. [Implementation Steps](#6-implementation-steps)
7. [File Changes Summary](#7-file-changes-summary)

---

## 1. Executive Summary

### BREAKING CHANGE: v0.6.1 → v0.6.2

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.1 | Skills-First Architecture | Universal skill-executor, `skill:` + `mission:` syntax |
| **v0.6.2** | **Schema-in-Skill Architecture** | **Remove workflow-specific types; skills define JSON schemas in SKILL.md** |

### What Changes in v0.6.2

v0.6.2 is a **breaking change** that:

1. **DELETES** workflow-specific domain types from `packages/core`
2. **DELETES** legacy services and ports from `packages/core`
3. **KEEPS** only generic types in `@looplia-core/core`
4. **RELIES** on JSON schemas already defined in SKILL.md files

### Design Principle

> **Skills Define Schemas, Not TypeScript**
>
> Each skill's SKILL.md contains the JSON schema for its output.
> Workflow validation uses these schemas directly.
> Core doesn't need TypeScript types for workflow-specific outputs.

### Key Insight

With skills-first architecture (v0.6.1), each skill defines its own output schema in its SKILL.md file. Core doesn't need TypeScript types for workflow-specific outputs because:

1. Skills execute through skill-executor agent
2. Skills produce JSON outputs following their SKILL.md schema
3. Workflow validates outputs against SKILL.md validation rules
4. No TypeScript type checking needed at runtime

**looplia-writer is an example plugin** - demonstrates compliance with both the looplia workflow system AND the Claude Code plugin system.

---

## 2. Problem Statement

### Why This Refactor?

With v0.6.1's skills-first architecture, skills are the primary unit of domain logic. Each skill outputs JSON files following schemas defined in its SKILL.md.

**The problem:** `packages/core` contains types specific to ONE workflow (writing-kit):

```typescript
// These are NOT generic - they're looplia-writer specific!
ContentSummary   // 16 fields specific to content analysis
WritingIdeas     // hooks, angles, questions for writing
WritingKit       // final output combining summary + ideas
Quote            // used only by ContentSummary
```

**The question raised:**

> "Why do we need CoreIdea type in summary.ts and even my question is why we need something like summary.ts since we have a very generic design. We may have any kinds of mission to execute."

This is correct. With the generic skill execution system:
- Skills define their own output schemas in SKILL.md
- Workflows validate against those schemas
- Core doesn't need to know about `ContentSummary` or `WritingIdeas`

### Goals

1. **Clean separation:** Core = generic types only
2. **Skills own schemas:** Output schemas live in SKILL.md as JSON, not TypeScript
3. **Future-proof:** Other plugins can define their own schemas without polluting core
4. **Loose coupling:** looplia-writer remains a standard Claude Code plugin

---

## 3. Architecture Change

```
BEFORE (v0.6.1):                        AFTER (v0.6.2):
┌─────────────────────────┐            ┌─────────────────────────┐
│ @looplia-core/core      │            │ @looplia-core/core      │
│                         │            │ (GENERIC ONLY)          │
│ - ContentItem           │            │                         │
│ - ContentSummary    ────┼───┐        │ - ContentItem           │
│ - WritingIdeas      ────┼───┼─DELETE │ - ProviderResult/Error  │
│ - WritingKit        ────┼───┤        │ - WorkflowDefinition    │
│ - Quote             ────┼───┤        │ - UserProfile/UserTopic │
│ - summarizeContent()────┼───┤        └─────────────────────────┘
│ - rankKits()        ────┼───┘
│ - SummarizerProvider────┼───┐
│ - ScoringPolicy     ────┼───┼─DELETE
│ - ProviderResult        │   │
│ - WorkflowDefinition    │   │        ┌─────────────────────────┐
│ - UserProfile           │   │        │ plugins/looplia-writer  │
└─────────────────────────┘   │        │ (STANDARD PLUGIN)       │
                              │        │                         │
                              └───────▶│ skills/*/SKILL.md       │
                                       │ └── JSON schemas inline │
                                       │                         │
                                       │ workflows/writing-kit.md│
                                       │ └── Example workflow    │
                                       └─────────────────────────┘
```

### Where Do Schemas Live Now?

Skills already define their output schemas in SKILL.md files:

| Skill | Schema Location |
|-------|-----------------|
| `media-reviewer` | `plugins/looplia-writer/skills/media-reviewer/SKILL.md` |
| `idea-synthesis` | `plugins/looplia-writer/skills/idea-synthesis/SKILL.md` |
| `writing-kit-assembler` | `plugins/looplia-writer/skills/writing-kit-assembler/SKILL.md` |

These SKILL.md files contain JSON schema definitions in their output sections. Workflow validation uses these directly.

---

## 4. What Gets Deleted

### Domain Types (4 files)

| File | Types | Reason |
|------|-------|--------|
| `packages/core/src/domain/quote.ts` | Quote | Schema in SKILL.md |
| `packages/core/src/domain/summary.ts` | ContentSummary, CoreIdea, SummaryScore | Schema in SKILL.md |
| `packages/core/src/domain/ideas.ts` | WritingIdeas, WritingHook, WritingAngle, WritingQuestion | Schema in SKILL.md |
| `packages/core/src/domain/writing-kit.ts` | WritingKit, OutlineSection, WritingKitSource, WritingKitMeta | Schema in SKILL.md |

### Services (2 files)

| File | Function | Reason |
|------|----------|--------|
| `packages/core/src/services/summarization-engine.ts` | `summarizeContent()` | Used only by legacy provider |
| `packages/core/src/services/ranking-engine.ts` | `rankKits()` | Used only for WritingKit |

### Ports (2 files)

| File | Interface | Reason |
|------|-----------|--------|
| `packages/core/src/ports/summarizer.ts` | `SummarizerProvider` | Used only by legacy provider |
| `packages/core/src/ports/scoring.ts` | `ScoringPolicy` | Used only for WritingKit |

### Validation Schemas (in schemas.ts)

Remove from `packages/core/src/validation/schemas.ts`:
- `QuoteSchema`
- `CoreIdeaSchema`, `SummaryScoreSchema`, `ContentSummarySchema`
- `WritingHookSchema`, `WritingAngleSchema`, `WritingQuestionSchema`, `WritingIdeasSchema`
- `WritingKitSourceSchema`, `OutlineSectionSchema`, `WritingKitMetaSchema`, `WritingKitSchema`

---

## 5. What Remains

### Keep in Core (Generic Types)

| File | Types | Reason |
|------|-------|--------|
| `domain/content.ts` | ContentItem, ContentMetadata, Source, SourceType | Generic input type |
| `domain/errors.ts` | ProviderResult, ProviderError, ok, err | Generic error handling |
| `domain/workflow.ts` | WorkflowDefinition, WorkflowStep, etc. | Workflow engine |
| `domain/user-profile.ts` | UserProfile, UserTopic, WritingStyle | Generic personalization |
| `domain/session.ts` | SessionManifest | Workflow state tracking |

### Keep in Validation

| Schema | Reason |
|--------|--------|
| `ContentItemSchema` | Generic content validation |
| `UserProfileSchema` | User settings validation |
| `SessionManifestSchema` | Workflow state validation |
| `WorkflowDefinitionSchema` | Workflow file validation |

---

## 6. Implementation Steps

### Step 1: Delete Domain Types

```bash
rm packages/core/src/domain/quote.ts
rm packages/core/src/domain/summary.ts
rm packages/core/src/domain/ideas.ts
rm packages/core/src/domain/writing-kit.ts
```

### Step 2: Delete Services and Ports

```bash
rm packages/core/src/services/summarization-engine.ts
rm packages/core/src/services/ranking-engine.ts
rm packages/core/src/ports/summarizer.ts
rm packages/core/src/ports/scoring.ts
```

### Step 3: Update Index Files

**packages/core/src/domain/index.ts:**
```typescript
// Only generic types
export type { ContentItem, ContentMetadata, Source, SourceType } from "./content";
export type { ProviderError, ProviderResult } from "./errors";
export { err, ok } from "./errors";
export type { UserProfile, UserTopic, WritingStyle } from "./user-profile";
```

**packages/core/src/services/index.ts:**
```typescript
// Empty or delete if no services remain
```

**packages/core/src/ports/index.ts:**
```typescript
// Empty or delete if no ports remain
```

**packages/core/src/index.ts:**
- Remove all deleted exports

### Step 4: Update Validation Schemas

**packages/core/src/validation/schemas.ts:**
- Remove: QuoteSchema, ContentSummarySchema, WritingIdeasSchema, WritingKitSchema
- Keep: ContentItemSchema, UserProfileSchema, SessionManifestSchema, WorkflowDefinitionSchema

### Step 5: Update Consumers

**apps/cli/src/utils/format.ts:**
- Remove ContentSummary, WritingKit formatting (or make generic)

**apps/cli/src/components/result-section.tsx:**
- Remove WritingKit-specific rendering (or make generic)

**packages/provider/src/claude-agent-sdk/summarizer.ts:**
- Delete or make generic (no longer needs ContentSummary type)

**packages/provider/src/claude-agent-sdk/utils/schema-converter.ts:**
- Remove ContentSummarySchema, WritingIdeasSchema exports

### Step 6: Verify

1. `bun install`
2. `bun run check-types`
3. `bun test`
4. `looplia run writing-kit --mock --file <test.md>`

---

## 7. File Changes Summary

### Delete (8 files)

| Path |
|------|
| `packages/core/src/domain/quote.ts` |
| `packages/core/src/domain/summary.ts` |
| `packages/core/src/domain/ideas.ts` |
| `packages/core/src/domain/writing-kit.ts` |
| `packages/core/src/services/summarization-engine.ts` |
| `packages/core/src/services/ranking-engine.ts` |
| `packages/core/src/ports/summarizer.ts` |
| `packages/core/src/ports/scoring.ts` |

### Modify (6+ files)

| Path | Change |
|------|--------|
| `packages/core/src/domain/index.ts` | Remove deleted exports |
| `packages/core/src/services/index.ts` | Remove deleted exports |
| `packages/core/src/ports/index.ts` | Remove deleted exports |
| `packages/core/src/index.ts` | Remove deleted exports |
| `packages/core/src/validation/schemas.ts` | Remove writing-specific schemas |
| `apps/cli/src/utils/format.ts` | Remove/generalize WritingKit formatting |
| `packages/provider/src/claude-agent-sdk/*` | Remove ContentSummary dependencies |

---

## Success Criteria

1. No TypeScript errors after cleanup
2. All tests pass
3. CLI commands work (`looplia run writing-kit --mock`)
4. Core only exports truly generic types
5. looplia-writer remains a standard Claude Code plugin

---

## Cross-References

- **Skills-First Architecture (v0.6.1):** See [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)
- **Legacy Cleanup (v0.6.1):** See [CLEANUP-0.6.1.md](./CLEANUP-0.6.1.md)
- **Context Injection:** See [CONTEXT-INJECTION.md](./CONTEXT-INJECTION.md)
- **Ubiquitous Language:** See [GLOSSARY.md](./GLOSSARY.md)

---

*This document serves as the single source of truth for Looplia-Core v0.6.2 schema-in-skill architecture.*
