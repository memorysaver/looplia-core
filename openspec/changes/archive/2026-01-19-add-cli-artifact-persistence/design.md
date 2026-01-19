# Design: CLI-Controlled Artifact Persistence

## Design Principle

**CLI controls final output persistence; Agent handles execution/generation.**

| Command | Agent Responsibility | CLI Responsibility |
|---------|---------------------|-------------------|
| `run`   | Execute steps, write intermediate outputs (validated by hooks) | Copy final outputs to `--output` |
| `build` | Generate workflow content | Write workflow file to `workflows/` |

This separation ensures:
- Reliable final output persistence (CLI guarantees writes)
- Agent flexibility during execution (can use Write tool for intermediates)
- Consistent pattern across all CLI commands

## Context

The current architecture trusts Claude agents to write files to disk. This works most of the time but introduces non-determinism because:
1. Agent may return success without calling Write tool (hallucinated success)
2. Agent may write to wrong location
3. No verification that files were actually persisted

The `run` command already has a pattern for CLI-controlled output via `copyOutputsToDestination()`, but the `build` command doesn't follow this pattern.

## Goals

- Eliminate flaky tests caused by agent file writing
- Establish a reusable pattern for CLI-controlled artifact persistence
- Maintain backward compatibility with existing workflows

## Non-Goals

- Changing agent behavior (agents can still write if they want)
- Modifying the `run` command (already has `--output` pattern)
- Supporting arbitrary file types (focus on workflow artifacts first)

## Decisions

### Decision 1: CLI writes from structured_output

**What**: After agent returns, CLI extracts artifact content from `structured_output` and writes it.

**Why**:
- `structured_output` already contains workflow data (`artifact.content`, `artifact.name`)
- CLI has reliable file I/O without agent variability
- Matches existing `copyOutputsToDestination()` pattern

**Alternatives considered**:
- Verify agent wrote file and retry if missing → Still depends on agent behavior
- Force agent to always write → Can't control agent behavior reliably

### Decision 2: Artifact schema in BuildResult

**What**: Extend `BuildResult` type to include full artifact content:

```typescript
export type BuildResult = {
  status: "success" | "error";
  workflowPath?: string;
  workflowName?: string;
  stepsCount?: number;
  error?: string;
  artifact?: {
    filename: string; // Required: e.g., "article-summary.md"
    content: string;  // Required: full markdown content
  };
};
```

Note: `workspace` in code always refers to `~/.looplia` (user's looplia home directory).

**Why**:
- Structured output already has `artifact` with workflow data
- `filename` and `content` are the only required fields (removed redundant `name`)
- CLI can write directly without regenerating content

### Decision 3: Write utility in sandbox.ts

**What**: Add `writeWorkflowArtifact()` to `sandbox.ts`:

```typescript
export function writeWorkflowArtifact(
  workspace: string,
  filename: string,
  content: string
): string {
  const workflowsDir = join(workspace, "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  const filePath = join(workflowsDir, filename);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}
```

**Why**:
- Consistent with existing `copyOutputsToDestination()` pattern
- Centralized file operations for testability
- Can add verification logic later

## Data Flow

```
Current (unreliable):
  Agent → generates workflow → calls Write tool → returns success
                                    ↓ (sometimes skipped)
                               File on disk

Proposed (reliable):
  Agent → generates workflow → returns in structured_output
                                    ↓
  CLI → extracts artifact.content → writes file → verifies exists
                                    ↓
                               File on disk (guaranteed)
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Agent still tries to write (redundant) | Harmless; CLI overwrites with correct content |
| Larger structured_output payload | Workflow content is typically <10KB; negligible |
| Breaking change to skill output | workflow-schema-composer already returns JSON with content |

## Migration Plan

1. Update `workflow-schema-composer` skill to return `content` field in JSON output
2. Update `build.ts` to extract and write artifact from structured_output
3. Add verification step to confirm file exists
4. Update tests to verify CLI-controlled write path

## Open Questions

- Should we deprecate agent file writing entirely? (Probably not - other use cases may benefit)
- Should this pattern apply to skill installation? (Future scope)
