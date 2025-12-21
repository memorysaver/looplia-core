# Build Command Test Plan

Testing strategy for the `looplia build` CLI command.

## Overview

The build command is a thin CLI wrapper that delegates workflow generation to 3 builder skills orchestrated by Claude:

```
looplia build "description" → Claude Agent → 3 Skills → Workflow File
```

**Skills Chain**:
1. `plugin-registry-scanner` - Discover available skills (deterministic)
2. `skill-capability-matcher` - Match requirements to skills (LLM)
3. `workflow-schema-composer` - Generate workflow YAML (LLM)

## Test Pyramid

```
                    ┌─────────────┐
                    │  Level 5    │  Snapshot Tests
                    │  (E2E+API)  │  Compare workflow output
                    ├─────────────┤
                    │  Level 4    │  Docker E2E Tests
                    │  (E2E+API)  │  Full container execution
                ┌───┴─────────────┴───┐
                │      Level 3        │  Integration Tests
                │   (Mock Executor)   │  Full flow, mocked API
            ┌───┴─────────────────────┴───┐
            │          Level 2            │  Script Tests
            │    (Deterministic, No API)  │  scan-plugins.ts
        ┌───┴─────────────────────────────┴───┐
        │              Level 1                │  Unit Tests
        │         (Fast, No API)              │  parseArgs, buildPrompt
        └─────────────────────────────────────┘
```

## Test Levels

### Level 1: Unit Tests (No API)

**File**: `apps/cli/test/commands/build.test.ts`

Tests pure functions in isolation:

| Function | Tests | Coverage |
|----------|-------|----------|
| `parseArgs()` | 16 tests | Flags, positional args, edge cases |
| `buildPrompt()` | 7 tests | Sanitization, length limits, newlines |
| `validateEnvironment()` | 4 tests | API key validation, mock mode |

**Run**: `bun test apps/cli/test/commands/build.test.ts`

### Level 2: Script Tests (No API)

**File**: `plugins/looplia-core/skills/plugin-registry-scanner/test/scan-plugins.test.ts`

Tests the deterministic registry scanner:

| Function | Tests | Coverage |
|----------|-------|----------|
| `extractFrontmatter()` | 5 tests | YAML parsing, edge cases |
| `inferCapabilities()` | 11 tests | Pattern matching, deduplication |
| `scanPlugins()` | 7 tests | Plugin discovery, schema validation |

**Run**: `bun test plugins/looplia-core/skills/plugin-registry-scanner/test/`

### Level 3: Integration Tests (Mock Executor)

**File**: `apps/cli/test/integration/build.test.ts`

Tests full command flow with mocked Claude executor:

- Command execution from entry to result
- Workspace creation/validation
- Error handling paths
- Result rendering

**Key Pattern**: Dependency injection of executor

```typescript
// Inject mock executor
const result = await executeBuildWithExecutor(prompt, workspace, mockExecutor);
```

**Run**: `bun test apps/cli/test/integration/build.test.ts`

### Level 4: Docker E2E Tests (Real API)

**File**: `.github/workflows/docker-e2e-build.yml`

Full container-based execution with real API:

```yaml
jobs:
  test-build:
    steps:
      - name: Run build command
        run: |
          docker run -e CLAUDE_CODE_OAUTH_TOKEN \
            looplia:test build "summarize articles" --name test-workflow

      - name: Validate workflow created
        run: |
          # Check file exists and has valid schema
          yq '.steps[0].skill' workflow.md | grep -v null
```

**Validates**:
- Workflow file creation
- Valid YAML schema
- `skill:` syntax (not legacy `run:`)
- Generated workflow can be executed

**Run**: Manual trigger or on merge to main

### Level 5: Snapshot Tests (Real API)

**File**: `apps/cli/test/e2e/build-snapshot.test.ts`

Captures and compares workflow output over time:

```typescript
it("should generate expected workflow for 'summarize articles'", async () => {
  const workflow = await buildWorkflow("summarize articles");
  expect(workflow).toMatchSnapshot();
});
```

**Purpose**: Detect unexpected changes in generated workflows

**Run**: `bun test apps/cli/test/e2e/build-snapshot.test.ts`

## Test Matrix

| Aspect | L1 | L2 | L3 | L4 | L5 |
|--------|----|----|----|----|----|
| Argument parsing | ✅ | - | ✅ | ✅ | - |
| Prompt sanitization | ✅ | - | ✅ | - | - |
| Environment validation | ✅ | - | ✅ | ✅ | - |
| Registry scanning | - | ✅ | - | ✅ | - |
| Capability inference | - | ✅ | - | - | - |
| Full command flow | - | - | ✅ | ✅ | ✅ |
| Workflow file creation | - | - | ✅ | ✅ | ✅ |
| Schema validation | - | - | ✅ | ✅ | ✅ |
| Real API calls | - | - | - | ✅ | ✅ |
| Output stability | - | - | - | - | ✅ |

## Running Tests

```bash
# All build-related tests (L1 + L2 + L3)
bun test build scan-plugins integration

# Unit tests only (L1)
bun test apps/cli/test/commands/build.test.ts

# Script tests only (L2)
bun test plugins/looplia-core/skills/plugin-registry-scanner/test/

# Integration tests (L3)
bun test apps/cli/test/integration/build.test.ts

# E2E snapshot tests (L5 - mock mode only)
bun test apps/cli/test/e2e/build-snapshot.test.ts

# E2E snapshot tests with API (L5 - requires token)
CLAUDE_CODE_OAUTH_TOKEN=xxx bun test apps/cli/test/e2e/build-snapshot.test.ts

# All tests
bun test
```

## Test Files Created

| Level | File | Tests |
|-------|------|-------|
| L1 | `apps/cli/test/commands/build.test.ts` | 27 tests |
| L2 | `plugins/looplia-core/skills/plugin-registry-scanner/test/scan-plugins.test.ts` | 25 tests |
| L3 | `apps/cli/test/integration/build.test.ts` | 16 tests |
| L4 | `.github/workflows/docker-e2e.yml` (test-build job) | CI workflow |
| L5 | `apps/cli/test/e2e/build-snapshot.test.ts` | 3 tests (mock mode) |

## CI/CD Integration

| Trigger | Tests Run |
|---------|-----------|
| Every commit | L1, L2, L3 |
| PR to main | L1, L2, L3 |
| Merge to main | L1, L2, L3, L4 |
| Manual dispatch | L1, L2, L3, L4, L5 |
