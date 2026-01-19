# Change: Add CLI-Controlled Artifact Persistence

## Why

The `build` command relies on the Claude agent to write workflow files to disk, but the agent sometimes returns success without actually calling the Write tool. This causes **flaky E2E tests** where the same code passes or fails randomly based on agent behavior.

The root cause is trusting the agent to persist files. The CLI should be responsible for writing artifacts to ensure reliability and consistency across all commands.

## What Changes

- **ADDED**: CLI-controlled artifact persistence pattern
  - Agent returns artifact content in `structured_output` with schema: `{ filename, content }`
  - CLI writes files based on structured output
  - CLI verifies files were written correctly
- **MODIFIED**: `build` command implements new pattern
  - Workflow content returned in `BuildResult.artifact.content`
  - CLI writes to `{workspace}/workflows/{artifact.filename}` (workspace = `~/.looplia`)
  - CLI verifies file exists after write
  - CLI handles missing/invalid artifacts gracefully (backward compatibility)
- **ADDED**: New utility function `writeWorkflowArtifact()` in `sandbox.ts`

## Impact

- Affected specs: `cli-artifact-persistence` (new)
- Affected code:
  - `apps/cli/src/commands/build.ts` - Handle artifact from structured_output
  - `apps/cli/src/utils/sandbox.ts` - New `writeWorkflowArtifact()` utility
  - `plugins/looplia-core/skills/workflow-schema-composer/SKILL.md` - Return content in output JSON

## Benefits

1. **Reliability**: CLI guarantees file persistence, no hallucinated writes
2. **Testability**: Can mock agent output and test file writing separately
3. **Consistency**: Establishes pattern for future commands (e.g., `init`, skill installation)
4. **Verification**: CLI can confirm what was actually written

## Non-Breaking

This change is backward-compatible:
- Agent can still write files (redundant but harmless)
- CLI verifies and writes if missing
- No API changes to users
