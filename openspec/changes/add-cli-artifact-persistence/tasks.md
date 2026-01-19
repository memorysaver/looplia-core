# Tasks: CLI-Controlled Artifact Persistence

## 1. Update workflow-schema-composer skill

- [x] 1.1 Update `SKILL.md` output format to include full `content` field in JSON response
- [x] 1.2 Ensure the skill returns `{ filename, content }` where `content` is the complete markdown

## 2. Add CLI artifact writing utility

- [x] 2.1 Add `writeWorkflowArtifact(workspace, filename, content)` function to `apps/cli/src/utils/sandbox.ts`
- [x] 2.2 Add unit tests for `writeWorkflowArtifact` in `apps/cli/test/utils/sandbox.test.ts`

## 3. Update build command

- [x] 3.1 Extend `BuildResult` type to include optional `artifact: { filename, content }`
- [x] 3.2 Update `renderResult()` to call `writeWorkflowArtifact()` when valid `artifact` is present
- [x] 3.3 Add validation: log warning if `artifact` is missing or has empty `filename`/`content`
- [x] 3.4 Add verification that file exists after write (log warning if missing)
- [x] 3.5 Update build command tests to verify CLI writes file from structured_output

## 4. E2E validation

- [ ] 4.1 Run Docker E2E tests locally to verify `test-build` passes consistently
- [ ] 4.2 Run CI to confirm flaky test is fixed

## Dependencies

- Task 1 must complete before Task 3 (skill must return content for CLI to write)
- Task 2 can run in parallel with Task 1
- Task 4 depends on all previous tasks

## Verification

After implementation:
1. Run `bun test` in `apps/cli/` - all tests pass ✅
2. Run `bun run build` - no type errors ✅
3. Run local build command: `looplia build "test workflow" --name test-workflow --no-interactive`
4. Verify `~/.looplia/workflows/test-workflow.md` exists with correct content
5. Re-run Docker E2E: `gh workflow run docker-e2e.yml`
