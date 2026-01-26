# Tasks: Add Build Validation Hooks

## Phase 1: Core Hook Implementation

- [x] **1.1** Create `packages/provider/src/claude-agent-sdk/hooks/build-hooks.ts`
  - Implement `isWorkflowFile()` helper
  - Implement `createBuildValidateHook()` with `parseWorkflow()` validation
  - Implement `createBuildStopGuardHook()`
  - Implement `createBuildHooks()` factory
  - Export from `hooks/index.ts`

- [x] **1.2** Add build validation manifest helpers
  - `createBuildValidationJson()` - initial manifest
  - `readBuildValidation()` - read current state
  - `updateBuildValidation()` - update after validation

## Phase 2: Config & SDK Integration

- [x] **2.1** Update `packages/provider/src/claude-agent-sdk/config.ts`
  - Add `buildHooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>`
  - Add JSDoc documentation

- [x] **2.2** Update `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts`
  - Pass `buildHooks` to SDK query options (around line 159-161)

## Phase 3: Build Command Integration

- [x] **3.1** Update `apps/cli/src/commands/build.ts` - `executeBatch()`
  - Create build-type validation.json in sandbox
  - Set `LOOPLIA_SANDBOX_ID` and `LOOPLIA_SANDBOX_ROOT` env vars
  - Pass `buildHooks: createBuildHooks()` to executor

- [x] **3.2** Update `apps/cli/src/commands/build.ts` - streaming executors
  - Apply same changes to `executeStreamingBatch()`
  - Apply same changes to `executeInteractiveStreamingBatch()`
  - Apply same changes to `executeStreamingLegacy()`

## Phase 4: Result Extraction

- [x] **4.1** Update `packages/provider/src/claude-agent-sdk/utils/shared/sandbox-result.ts`
  - Add build-type manifest detection (`manifest.type === "build"`)
  - Return appropriate result structure for build commands
  - Handle `workflowValidated: false` case

- [x] **4.2** Update result types if needed
  - Ensure BuildResult type works with extractSandboxResult

## Phase 5: Testing

- [ ] **5.1** Create `packages/provider/test/claude-agent-sdk/hooks/build-hooks.test.ts`
  - Test `isWorkflowFile()` with various paths
  - Test validation hook with valid workflow content
  - Test validation hook with invalid workflow content
  - Test stop guard with validated/unvalidated states

- [ ] **5.2** Update `apps/cli/test/commands/build.test.ts`
  - Add tests for build validation flow
  - Test mock mode still works (may need `skipValidation` option)

- [ ] **5.3** Update `apps/cli/test/integration/build.test.ts`
  - Add integration tests with build hooks
  - Test extractSandboxResult with build manifest

## Phase 6: Verification

- [x] **6.1** Build and lint checks pass
  ```bash
  bun run build
  bun run check-types
  bun x ultracite check
  ```

- [x] **6.2** Existing test suite passes
  ```bash
  bun test  # 590 tests pass
  ```

- [ ] **6.3** Manual E2E test (pending)
  ```bash
  bun apps/cli/dist/cli.js build "test workflow" --name test-build --no-interactive
  ```
  - Verify workflow created in `~/.looplia/workflows/`
  - Verify CLI shows success message

## Dependencies

```
Phase 1 ──┬── Phase 2 ──┬── Phase 3 ──┬── Phase 4 ──── Phase 5 ──── Phase 6
          │             │             │
          └─────────────┴─────────────┘
          (can be parallelized partially)
```

- Phase 2 depends on Phase 1 (needs hook types)
- Phase 3 depends on Phase 1 + 2 (needs hooks + config)
- Phase 4 depends on Phase 1 (needs manifest structure)
- Phase 5 depends on Phases 1-4
- Phase 6 depends on Phase 5
