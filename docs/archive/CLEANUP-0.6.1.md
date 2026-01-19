# Legacy Code Cleanup Plan (v0.6.1)

> **Related:** [DESIGN-0.6.1.md](./DESIGN-0.6.1.md)
> **Status:** Pending Execution
> **Created:** 2025-12-21

---

## Overview

Remove legacy code from pre-v0.4.0 provider-based architecture that is no longer used by the v0.6.0+ workflow system. This cleanup is part of the v0.6.1 breaking change.

**Goal:** Clean, minimal codebase with only actively used code for skills-first architecture.

---

## Legacy Code Identified

### Category 1: Legacy Services (packages/core/src/services/)

| File | Status | Reason |
|------|--------|--------|
| `idea-engine.ts` | **DELETE** | Old provider wrapper, not used by workflow system |
| `writing-kit-engine.ts` | **DELETE** | Old manual orchestration, replaced by workflow execution |

### Category 2: Legacy Ports (packages/core/src/ports/)

| File | Status | Reason |
|------|--------|--------|
| `idea-generator.ts` | **DELETE** | Old IdeaProvider interface, replaced by skills |
| `outline-generator.ts` | **REVIEW** | May still be referenced by types |

### Category 3: Legacy Mock Adapters (packages/core/src/adapters/mock/)

| File | Status | Reason |
|------|--------|--------|
| `mock-idea-generator.ts` | **DELETE** | Tests old architecture |
| `mock-writing-kit-provider.ts` | **DELETE** | Tests old architecture |
| `mock-outline-generator.ts` | **REVIEW** | May still be needed |

### Category 4: Legacy Commands (packages/core/src/commands/)

| File | Status | Reason |
|------|--------|--------|
| `kit.ts` | **DELETE** | Hardcoded old pipeline, superseded by workflowCommand |

### Category 5: Legacy Provider Code (packages/provider/src/claude-agent-sdk/)

| File | Status | Reason |
|------|--------|--------|
| `writing-kit-provider.ts` | **DELETE** | Old 3-subagent pattern, not used |
| `content-io.ts` | **DELETE** | Only used by writing-kit-provider |
| `agents/idea-generator.md` | **DELETE** | Duplicate of plugin version |

### Category 6: Legacy Domain Types (packages/core/src/domain/)

| File | Status | Reason |
|------|--------|--------|
| `core-idea.ts` | **DELETE** | CoreIdea type never used in WritingIdeas |
| `ideas.ts` | **KEEP** | WritingIdeas schema actively used |
| `pipeline.ts` | **REVIEW** | May be legacy pipeline-as-configuration |

### Category 7: Test Workspace (test-workspace/)

| File | Status | Reason |
|------|--------|--------|
| `markdown-test/` | **DELETE** | Old test fixtures, outdated structure |

### Category 8: Looplia-Writer Agents (plugins/looplia-writer/agents/)

| File | Status | Reason |
|------|--------|--------|
| `content-analyzer.md` | **DELETE** | Replaced by direct media-reviewer skill usage |
| `idea-generator.md` | **DELETE** | Replaced by new idea-synthesis skill |
| `writing-kit-builder.md` | **DELETE** | Replaced by new writing-kit-assembler skill |

### Category 9: Old Design Documents (docs/)

| Pattern | Status | Reason |
|---------|--------|--------|
| `DESIGN-0.1.md` to `DESIGN-0.3.x.md` | **ARCHIVE** | Pre-v0.4.0 designs |
| `AGENTIC_CONCEPT-0.1.md` to `0.3.md` | **ARCHIVE** | Early concepts |
| `TEST_PLAN-0.1.md` to `0.4.md` | **ARCHIVE** | Old test plans |

---

## Public API Exports to Remove

### From `packages/core/src/index.ts`:

```typescript
// DELETE these exports:
export { createMockIdeaGenerator } from "./adapters/mock";
export { createMockWritingKitProvider } from "./adapters/mock";
export { kitCommand } from "./commands";
export { generateIdeas } from "./services/idea-engine";
export { buildWritingKit, type WritingKitProviders } from "./services/writing-kit-engine";
export type { IdeaProvider } from "./ports/idea-generator";
export type { OutlineProvider } from "./ports/outline-generator";
```

### From `packages/provider/src/claude-agent-sdk/index.ts`:

```typescript
// DELETE these exports:
export { writeContentItem } from "./content-io";
export type { WritingKitProvider } from "./writing-kit-provider";
export { createClaudeWritingKitProvider } from "./writing-kit-provider";
```

---

## Files to Delete (Safe - No Active Dependencies)

### packages/core/

```
src/services/idea-engine.ts
src/services/writing-kit-engine.ts
src/ports/idea-generator.ts
src/ports/outline-generator.ts
src/adapters/mock/mock-idea-generator.ts
src/adapters/mock/mock-writing-kit-provider.ts
src/adapters/mock/mock-outline-generator.ts
src/commands/kit.ts
src/domain/core-idea.ts
src/domain/pipeline.ts
```

### packages/provider/

```
src/claude-agent-sdk/writing-kit-provider.ts
src/claude-agent-sdk/content-io.ts
src/claude-agent-sdk/agents/idea-generator.md
```

### test-workspace/

```
markdown-test/ (entire directory)
```

### plugins/looplia-writer/agents/

```
content-analyzer.md
idea-generator.md
writing-kit-builder.md
```

---

## Files to Modify

### packages/core/src/index.ts

- Remove legacy exports listed above
- Keep: workflow types, validation schemas, agent-utils

### packages/core/src/adapters/mock/index.ts

- Remove: createMockIdeaGenerator, createMockWritingKitProvider, createMockOutlineGenerator
- Keep: createMockSummarizer (if still used)

### packages/core/src/adapters/index.ts

- Update to remove legacy adapter exports

### packages/core/src/ports/index.ts

- Remove legacy port exports

### packages/core/src/commands/index.ts

- Remove kitCommand export
- Keep: workflowCommand, registry functions

### packages/provider/src/claude-agent-sdk/index.ts

- Remove legacy provider exports
- Keep: streaming, executor, workspace utilities

---

## Documents to Archive

Move to `docs/archive/` directory:

```
docs/DESIGN-0.1.md
docs/DESIGN-0.2.md
docs/DESIGN-0.3.0.md
docs/DESIGN-0.3.1.md
docs/DESIGN-0.3.2.md
docs/DESIGN-0.3.3.md
docs/DESIGN-0.3.4.0.md
docs/DESIGN-0.3.4.1.md
docs/AGENTIC_CONCEPT-0.1.md
docs/AGENTIC_CONCEPT-0.2.md
docs/AGENTIC_CONCEPT-0.3.md
docs/TEST_PLAN-0.1.md
docs/TEST_PLAN-0.2.md
docs/TEST_PLAN-0.3.md
docs/TEST_PLAN-0.4.md
```

---

## Implementation Order

### Phase 1: Verify No Active Usage

1. Run `grep` to confirm no imports of legacy files in active code
2. Run tests to establish baseline
3. Document any unexpected dependencies

### Phase 2: Delete Legacy Files

1. Delete files in packages/core/src/services/ (idea-engine, writing-kit-engine)
2. Delete files in packages/core/src/ports/ (idea-generator, outline-generator)
3. Delete files in packages/core/src/adapters/mock/ (legacy mocks)
4. Delete kit.ts command
5. Delete domain/core-idea.ts, domain/pipeline.ts

### Phase 3: Update Index Files

1. Update packages/core/src/index.ts - remove legacy exports
2. Update packages/core/src/adapters/index.ts
3. Update packages/core/src/adapters/mock/index.ts
4. Update packages/core/src/ports/index.ts
5. Update packages/core/src/commands/index.ts

### Phase 4: Clean Provider Package

1. Delete writing-kit-provider.ts
2. Delete content-io.ts
3. Delete agents/idea-generator.md
4. Update packages/provider/src/claude-agent-sdk/index.ts

### Phase 5: Clean Test Fixtures

1. Delete test-workspace/markdown-test/

### Phase 6: Delete Looplia-Writer Agents

1. Delete plugins/looplia-writer/agents/content-analyzer.md
2. Delete plugins/looplia-writer/agents/idea-generator.md
3. Delete plugins/looplia-writer/agents/writing-kit-builder.md
4. Update plugins/looplia-writer/README.md if needed

### Phase 7: Archive Old Documents

1. Create docs/archive/ directory
2. Move old DESIGN-*.md files (0.1 - 0.3.x)
3. Move old AGENTIC_CONCEPT-*.md files (0.1 - 0.3)
4. Move old TEST_PLAN-*.md files (0.1 - 0.4)

### Phase 8: Verify & Test

1. Run type check: `bun run check-types`
2. Run tests: `bun test`
3. Build: `bun run build`

---

## Files Summary

### Delete (20 files)

| Package | Count | Files |
|---------|-------|-------|
| packages/core | 10 | services (2), ports (2), adapters (3), commands (1), domain (2) |
| packages/provider | 3 | writing-kit-provider, content-io, agents/idea-generator.md |
| plugins/looplia-writer | 3 | agents/content-analyzer.md, idea-generator.md, writing-kit-builder.md |
| test-workspace | 1 | markdown-test/ directory |

### Modify (6 files)

| File | Change |
|------|--------|
| `packages/core/src/index.ts` | Remove legacy exports |
| `packages/core/src/adapters/index.ts` | Remove legacy adapters |
| `packages/core/src/adapters/mock/index.ts` | Remove legacy mocks |
| `packages/core/src/ports/index.ts` | Remove legacy ports |
| `packages/core/src/commands/index.ts` | Remove kitCommand |
| `packages/provider/src/claude-agent-sdk/index.ts` | Remove legacy exports |

### Archive (15 documents)

Move to `docs/archive/`: DESIGN-0.1 through 0.3.x, AGENTIC_CONCEPT-0.1 through 0.3, TEST_PLAN-0.1 through 0.4

---

## Success Criteria

1. No TypeScript errors after cleanup
2. All tests pass
3. CLI commands still work (`looplia run`, `looplia build`)
4. No imports of deleted files in active code
5. Public API exports only actively used code
6. Old documents archived, not deleted (preserves history)
