# Proposal: Add Build Validation Hooks

## Summary

Implement a hook-based validation system for the `build` command, similar to the existing run command's v0.7.4 workflow hooks. This ensures generated workflows have valid YAML frontmatter and well-formed structure before completion.

## Problem Statement

The `build` command shows "Unknown error" even when workflows are successfully created. Root causes:

1. **Missing validation.json**: Build creates sandbox (v0.7.1) for logging but doesn't create `validation.json`
2. **extractSandboxResult fails**: SDK's fallback result extraction (v0.7.2) requires `validation.json`
3. **No validation strategy**: Build has no mechanism to validate the generated workflow file

### Evidence

From sandbox logs after successful workflow generation:
```
Created: `~/.looplia/workflows/hn-ai-news.md` (5 steps)
```

But CLI shows:
```
❌ Build failed: Unknown error
```

The workflow file exists and is valid, but the result extraction pipeline fails.

## Proposed Solution

Implement build-specific validation hooks that mirror the run command's hook architecture:

### 1. Build Validation Hooks

Create `createBuildHooks()` factory that returns:
- **PostToolUse hook**: Validates workflow files written to `workflows/*.md`
- **Stop guard hook**: Blocks completion until workflow is validated

### 2. Build-Type validation.json

Create a build-specific validation manifest:
```json
{
  "type": "build",
  "workflow": "workflow-name",
  "sandboxId": "build-2026-01-27-xxxx",
  "status": "building",
  "workflowValidated": false,
  "workflowPath": null
}
```

### 3. Separate buildHooks Config Parameter

Add `buildHooks` config option (separate from existing `runHooks`):
- `runHooks` → for run command workflow step validation
- `buildHooks` → for build command workflow file validation

### 4. Validation Rules

The PostToolUse hook validates using existing `parseWorkflow()`:
- Valid YAML frontmatter
- Required fields: `name`, `description`, `steps`
- Step fields: `id`, `skill`/`run`, `output`
- Steps with `skill` must have `mission`
- No circular dependencies
- All `needs` refs exist
- Input refs exist in workflow inputs

## Affected Components

| Component | Change |
|-----------|--------|
| `packages/provider/src/claude-agent-sdk/hooks/build-hooks.ts` | **NEW** - Build validation hooks |
| `packages/provider/src/claude-agent-sdk/config.ts` | Add `buildHooks` config option |
| `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts` | Pass buildHooks to SDK |
| `packages/provider/src/claude-agent-sdk/utils/shared/sandbox-result.ts` | Handle build-type validation |
| `apps/cli/src/commands/build.ts` | Create build validation.json + pass buildHooks |

## Benefits

- Consistent validation architecture between build and run commands
- Validates workflow structure before completion (not after)
- Blocks invalid workflows with actionable error messages
- Leverages existing `parseWorkflow()` validation logic
- Enables `extractSandboxResult()` to work with build commands

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing build tests | Add `skipValidation` option for mock mode tests |
| Validation too strict | Use existing `parseWorkflow()` rules which are already proven |
| Hook conflicts with runHooks | Separate config parameters prevent overlap |

## Architectural Alignment

This proposal follows patterns established in v0.7.4:
- Hook-based validation (PostToolUse + Stop guard)
- validation.json as source of truth
- extractSandboxResult() for result extraction
- Actionable error messages in hook `reason` field
