# Tasks: Remove StructuredOutput Enforcement

## Implementation Tasks

### Phase 1: Remove SDK StructuredOutput Enforcement

- [x] **Task 1.1**: Remove `outputFormat` from query-executor.ts
  - File: `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts`
  - Remove the `outputFormat: { type: "json_schema", schema: jsonSchema }` option
  - This eliminates SDK's synthetic stop messages for StructuredOutput

- [x] **Task 1.2**: Remove `outputFormat` from interactive-query-executor.ts (if applicable)
  - File: `packages/provider/src/claude-agent-sdk/streaming/interactive-query-executor.ts`
  - Apply same change if this file uses outputFormat

### Phase 2: Implement Sandbox Result Extraction

- [x] **Task 2.1**: Add sandbox discovery utility function
  - Create function to find sandbox directory by ID or most recent timestamp
  - Location: `packages/provider/src/claude-agent-sdk/utils/shared/sandbox-result.ts`

- [x] **Task 2.2**: Add validation.json reader
  - Create function to read and parse validation.json from sandbox
  - Extract step completion status and output paths

- [x] **Task 2.3**: Add final artifact extraction logic
  - After SDK query loop completes, read validation.json
  - Identify final step (last step or step with `final: true`)
  - Read and parse the final artifact JSON file
  - Return as workflow result

- [x] **Task 2.4**: Implement error handling for result extraction
  - Handle: sandbox not found
  - Handle: validation.json missing
  - Handle: incomplete validation state
  - Handle: final output file missing
  - Handle: invalid JSON in output file

### Phase 3: Update Result Types

- [x] **Task 3.1**: Review AgenticQueryResult type
  - Ensure result type accommodates sandbox-based results
  - Maintain backward compatibility with existing consumers

### Phase 4: Fix Workflow Protection for Non-Anthropic Models

After removing StructuredOutput enforcement, a second issue was discovered: stop-guard.sh wasn't blocking premature stops because validation.json had empty steps.

- [x] **Task 4.1**: Populate validation.json steps in run.ts
  - File: `apps/cli/src/commands/run.ts`
  - Import `generateValidationManifest` from `@looplia-core/core`
  - After `resolveSandboxId()`, call `generateValidationManifest()` and update validation.json
  - This enables stop-guard.sh to validate workflow completion

- [x] **Task 4.2**: Improve stop-guard.sh reason field
  - File: `plugins/looplia-core/scripts/hooks/stop-guard.sh`
  - Update both block reason messages to be actionable continuation prompts
  - Follow ralph-loop pattern: reason field is the continuation prompt fed back to agent
  - Tell the agent what to do next, not just what's wrong

### Phase 5: Testing

- [ ] **Task 5.1**: Test with Anthropic model
  - Verify workflow completes successfully
  - Verify hooks still validate outputs
  - Verify final artifact is correctly extracted

- [ ] **Task 5.2**: Test with non-Anthropic model (GLM)
  - Verify no infinite loop occurs
  - Verify stop-guard.sh blocks premature stops with continuation prompts
  - Verify workflow completes with validated outputs
  - Verify final artifact extraction works

- [ ] **Task 5.3**: Test error scenarios
  - Test sandbox not found error
  - Test incomplete validation error
  - Test missing output file error

### Phase 6: Cleanup

- [x] **Task 6.1**: Remove debug logging (if added during development)
  - No debug logging was present (stashed changes were never committed)

- [ ] **Task 6.2**: Update any documentation
  - Update workflow execution docs if they reference StructuredOutput

## Verification Commands

```bash
# Build
bun run build

# Run with Anthropic model
bun apps/cli/dist/cli.js run writing-kit --file test.md --topics "ai" --tone "expert"

# Run with GLM model (after configuring preset)
looplia config set preset OLLAMA_GLM47_CLOUD
bun apps/cli/dist/cli.js run writing-kit --file test.md --topics "ai" --tone "expert"

# Verify no synthetic messages in logs
# Check sandbox validation.json shows all steps validated
# Check final artifact matches expected structure
```

## Success Criteria

1. No "You MUST call StructuredOutput" synthetic messages appear
2. Hook-based validation (post-write-validate.sh) still validates each step
3. validation.json has populated steps from workflow definition (not empty)
4. stop-guard.sh blocks premature stops with actionable continuation prompts
5. Final result contains the validated artifact from sandbox
6. Works with both Anthropic and non-Anthropic models
