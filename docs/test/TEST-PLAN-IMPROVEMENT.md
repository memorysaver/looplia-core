# Looplia-Core Test Plan Improvement

> Status: Draft
> Target: v0.6.x stabilization
> Scope: test stability, determinism, and coverage consistency

## Purpose

This document proposes concrete improvements to the Looplia-Core test plan and test suites to reduce flakiness, increase determinism, and make failures more actionable. It builds on the archived test plan in `docs/archive/TEST_PLAN-0.6.md` and focuses on reliability of local and CI execution.

## Goals

- Make all tests hermetic by default: no writes to real user state or global files.
- Eliminate nondeterminism from time, randomness, and ambient environment leaks.
- Ensure CLI E2E tests run against a known build or a stable entrypoint.
- Improve signal quality: remove placeholders, assert real behavior, and align tests with production helpers.
- Separate stable CI gates from manual or long-running Real API tests.

## Non-Goals

- Rewriting the test pyramid or swapping frameworks.
- Increasing the total number of Real API tests beyond current budget.
- Changing product behavior to accommodate tests.

## Current Stability Risks (Summary)

1) Non-hermetic filesystem access in E2E and bootstrap tests
- CLI E2E cleans `~/.looplia/contentItem/cli-*` and runs against real home. This can delete user data and causes local state coupling.
- `isLoopliaInitialized()` tests consult actual `~/.looplia` state and vary across machines.

2) Ambiguous build/test entrypoint for CLI E2E
- `apps/cli/dist/index.js` must exist and be current; tests do not enforce this.

3) Hard-coded version assertions
- CLI E2E checks for `looplia 0.6.5`, which fails on version bumps even when behavior is correct.

4) Environment and output leaks
- Some tests mutate `process.stdout` and `process.env` without fully restoring property descriptors.

5) Placeholder or duplicated logic in tests
- Placeholder test in streaming query executor does not assert real behavior.
- Helper logic is re-implemented in tests instead of importing production code, risking drift.

## Guiding Principles

- Hermetic by default: each test suite runs in a temp workspace with isolated HOME and XDG dirs.
- Deterministic by default: any time/random dependency is stubbed or seeded.
- No global cleanup: only remove files created under the test-specific temp directory.
- E2E tests must be explicit about prerequisites (build and workspace).
- CI should only run tests that are stable and repeatable; Real API tests remain opt-in.

## Proposed Improvements

### 1) Hermetic Test Environment

Introduce a single test helper that creates an isolated workspace and controls HOME and XDG dirs.

Required behaviors:
- Create a temp directory (e.g., `tmpdir()/looplia-test-<id>`)
- Set `HOME` and XDG env vars (XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_CACHE_HOME)
- Optionally set `LOOPLIA_DEV_ROOT` and other environment variables
- Provide cleanup to remove the entire temp tree

Suggested API:

```
createIsolatedTestEnv(): {
  home: string
  workspace: string
  env: NodeJS.ProcessEnv
  cleanup: () => Promise<void>
}
```

Adopt in:
- `apps/cli/test/e2e/*`
- `packages/provider/test/bootstrap/index.test.ts`
- Any tests that interact with `~/.looplia` or plugin initialization

Expected outcome:
- No tests read or write real user home directories.
- Cleanup is scoped to temp directories only.

### 2) CLI E2E Build Stability

Update `execCLI` to ensure it uses a known entrypoint.

Options:
- Build before tests: in CI, run `bun run build` prior to CLI E2E suite.
- Fallback to source: allow `execCLI` to run `apps/cli/src/index.ts` with `bun` if `dist` is missing.

Preferred approach:
- CI runs `bun run build` once; E2E uses `dist` for parity with shipped CLI.
- Local tests detect missing `dist` and throw a clear error, rather than silently failing.

### 3) Version Assertions

Replace hard-coded version checks with one of:
- `package.json` version read at runtime, or
- Regex-based checks to validate format without pinning a version.

Expected outcome:
- Version bump does not break tests.

### 4) Environment and stdout Restoration

Standardize environment restoration in tests that mutate process properties.

Suggested pattern:
- Save property descriptors for `process.stdout` fields that are mutated.
- Restore descriptors in `afterEach`.
- Use `Object.getOwnPropertyDescriptor` and `Object.defineProperty` rather than `{ ...process.stdout }`.

Expected outcome:
- No cross-test leakage from terminal or environment utilities.

### 5) Replace Placeholder and Duplicated Helper Logic

- Replace placeholder tests in `streaming/query-executor` with mocked SDK execution and meaningful assertions.
- Export helper functions from production modules or provide a test-only export path so tests do not re-implement logic.

Expected outcome:
- Less drift between tests and production code.
- Higher confidence in core logic behavior.

### 6) Real API Test Guardrails

Keep Real API tests manual or scheduled, but add guardrails:
- Clear criteria for pass/fail, including log verification requirements.
- Retry with bounded budget for rate limits or transient network errors.
- Normalize logs before comparison (strip timestamps, sandbox IDs)
- Produce deterministic output artifacts when possible

Expected outcome:
- Reduced flakiness and clearer signal when Real API behavior regresses.

## Layer-Specific Improvements

### Unit Tests

- Ensure all unit tests are pure and deterministic.
- Avoid re-implementing logic in tests; import the same helpers used in production.
- Add missing edge case coverage where logic is known to be brittle:
  - Workflow parsing edge cases (invalid inputs, optional fields)
  - Sandbox ID parsing and input references

### Integration Tests

- Confirm integration tests use isolated temp workspaces and do not depend on `~/.looplia`.
- Add integration coverage for CLI commands that rely on workspace structure, but avoid real network calls.

### CLI E2E Tests

- Run all E2E tests in isolated HOME.
- Verify `--mock` mode and exit code behaviors without touching user state.
- Add explicit checks for expected artifacts in the isolated workspace.
- Ensure E2E output matches stable format (avoid brittle string matching).

### Real API Tests

- Keep in manual workflow (`workflow_dispatch`) and mark in docs as opt-in.
- Add log verification scripts that parse and validate:
  - custom subagent types
  - skills auto-loading
  - validation script execution

### Docker E2E

- Ensure docker tests mount a temp workspace and do not mutate repo state.
- Document expected outputs and log inspection steps.

### LLM-as-Judge Evaluation

- Add deterministic evaluation prompt and seed.
- Persist raw judge input/output for auditability.

## Implementation Plan

### Phase 1: Safety and Isolation (High Priority)

- [ ] Add a shared helper `createIsolatedTestEnv` under `apps/cli/test/utils.ts` or a new `test-utils` package.
- [ ] Update CLI E2E tests to use isolated HOME and remove global cleanup.
- [ ] Update bootstrap tests to use isolated workspace state, no real HOME access.
- [ ] Replace hard-coded version assertions with derived version or regex.

Acceptance criteria:
- Running tests does not touch or delete files under real `~/.looplia`.
- CLI E2E suite passes when `dist` is up-to-date.

### Phase 2: Determinism and Signal (Medium Priority)

- [ ] Standardize environment and stdout restoration via property descriptor snapshots.
- [ ] Replace placeholder tests with meaningful mocked tests.
- [ ] Replace test-reimplemented helpers with production helpers.

Acceptance criteria:
- Tests pass consistently across repeated runs.
- No placeholder tests remain.

### Phase 3: Real API and E2E Hardening (Medium Priority)

- [ ] Normalize log verification and add automated check script with stable output.
- [ ] Add bounded retry for Real API runs (no infinite loops).
- [ ] Document rate-limit handling and best practices.

Acceptance criteria:
- Manual Real API runs are repeatable and produce consistent logs.

## Metrics and Monitoring

Track improvements by:
- Flake rate: number of re-runs required to pass CI.
- Time-to-diagnose: average time from failure to root cause.
- Test isolation: zero usage of real home dir in CI.

## Risks and Mitigations

- Risk: Increased test setup complexity.
  - Mitigation: Centralize helpers; keep APIs simple.

- Risk: E2E tests become slower due to build requirements.
  - Mitigation: Build once at CI job start, reuse artifacts across E2E suites.

- Risk: Refactoring tests may hide regressions.
  - Mitigation: Make changes incremental and verify each phase in CI.

## Rollout Strategy

- Phase 1 changes can land behind a short-lived feature branch and validated with CI.
- Phase 2 and 3 can be stacked in separate PRs to avoid large diffs.
- Update `docs/archive/TEST_PLAN-0.6.md` with a short link to this document.

## Appendix: Files to Update (Initial Pass)

- `apps/cli/test/utils.ts`
- `apps/cli/test/e2e/cli.test.ts`
- `packages/provider/test/bootstrap/index.test.ts`
- `apps/cli/test/utils/terminal.test.ts`
- `packages/provider/test/claude-agent-sdk/streaming/query-executor.test.ts`

