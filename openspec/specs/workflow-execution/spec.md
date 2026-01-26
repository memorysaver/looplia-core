# Workflow Execution Specification

## Purpose

Defines how workflow execution completes and returns results using sandbox-based validation and result extraction.

## Requirements

### Requirement: Sandbox-Based Result Extraction

The workflow executor SHALL extract final results from sandbox output files instead of StructuredOutput tool calls.

#### Scenario: Successful workflow completion
- **GIVEN** a workflow has completed execution
- **AND** all steps have `validated: true` in validation.json
- **WHEN** the SDK query completes
- **THEN** the executor SHALL read `validation.json` from the sandbox
- **AND** identify the final step (last step or step with `final: true`)
- **AND** read the final artifact from the step's output path
- **AND** return the artifact as the workflow result

#### Scenario: Final artifact extraction path
- **GIVEN** validation.json contains:
  ```json
  {
    "steps": {
      "writing-kit": {
        "output": "outputs/writing-kit.json",
        "validated": true
      }
    }
  }
  ```
- **WHEN** extracting the final result
- **THEN** the executor SHALL read `{sandbox}/outputs/writing-kit.json`
- **AND** parse and return its contents

### Requirement: No SDK StructuredOutput Enforcement

The workflow executor SHALL NOT use SDK's `outputFormat: json_schema` setting.

#### Scenario: Query options exclude outputFormat
- **GIVEN** the workflow executor creates SDK query options
- **WHEN** initializing the query
- **THEN** the options SHALL NOT include `outputFormat: { type: "json_schema" }`
- **AND** no StructuredOutput tool enforcement SHALL be applied by the SDK

#### Scenario: No synthetic StructuredOutput messages
- **GIVEN** a model attempts to stop without calling StructuredOutput
- **WHEN** the SDK processes the stop request
- **THEN** the SDK SHALL NOT inject "You MUST call StructuredOutput" messages
- **AND** only custom hooks (TypeScript hooks) SHALL control stop behavior

### Requirement: Validation.json Step Population

The run command SHALL populate validation.json with workflow steps before execution starts.

#### Scenario: Steps populated from workflow definition
- **GIVEN** a workflow is being executed
- **AND** the sandbox has been created with initial validation.json
- **WHEN** the run command prepares for execution
- **THEN** it SHALL call `generateValidationManifest()` with the workflow definition
- **AND** update validation.json `steps` with the manifest steps
- **AND** each step SHALL have `validated: false` initially

#### Scenario: Steps enable stop-guard validation
- **GIVEN** validation.json has been populated with steps
- **WHEN** the agent attempts to stop
- **THEN** the stop hook SHALL find steps to validate
- **AND** SHALL block if any step is not validated

### Requirement: Stop Hook Continuation Prompts

The stop hook SHALL return actionable continuation prompts when blocking.

#### Scenario: Missing output files
- **GIVEN** stop hook detects missing output files
- **WHEN** blocking the stop request
- **THEN** the `reason` field SHALL contain an actionable continuation prompt
- **AND** the prompt SHALL tell the agent to create the missing files using Write tool
- **AND** the prompt SHALL NOT be just an explanation of what's wrong

#### Scenario: Pending validation
- **GIVEN** stop hook detects steps with `validated: false`
- **WHEN** blocking the stop request
- **THEN** the `reason` field SHALL contain an actionable continuation prompt
- **AND** the prompt SHALL tell the agent to re-write files to trigger validation
- **AND** the prompt SHALL NOT be just an explanation of what's wrong

#### Scenario: Continuation prompt fed to agent
- **GIVEN** stop hook returns a block decision with a reason
- **WHEN** the SDK processes the stop hook response
- **THEN** the SDK SHALL create a synthetic message from the `reason` content
- **AND** feed it back to the agent as a continuation prompt

### Requirement: Sandbox Discovery

The executor SHALL locate the active sandbox for result extraction.

#### Scenario: Sandbox ID from workflow context
- **GIVEN** the workflow-executor skill creates a sandbox with ID `content-2026-01-22-abc1`
- **AND** the sandbox ID is included in the execution context
- **WHEN** extracting results
- **THEN** the executor SHALL use `~/.looplia/sandbox/content-2026-01-22-abc1/`

#### Scenario: Sandbox discovery fallback
- **GIVEN** no explicit sandbox ID is available in context
- **WHEN** extracting results
- **THEN** the executor SHALL find the most recently modified sandbox directory
- **AND** use that sandbox for result extraction

### Requirement: Error Handling for Result Extraction

The executor SHALL handle result extraction failures gracefully.

#### Scenario: Sandbox not found
- **GIVEN** the expected sandbox directory does not exist
- **WHEN** attempting to extract results
- **THEN** the executor SHALL return an error result
- **AND** the error message SHALL indicate "sandbox not found"

#### Scenario: Validation state incomplete
- **GIVEN** validation.json exists
- **AND** one or more steps have `validated: false`
- **WHEN** the SDK query completes unexpectedly
- **THEN** the executor SHALL return an error result
- **AND** the error message SHALL list the unvalidated steps

#### Scenario: Final output file missing
- **GIVEN** validation.json indicates the final step output path
- **AND** the output file does not exist
- **WHEN** extracting results
- **THEN** the executor SHALL return an error result
- **AND** the error message SHALL indicate the missing file path

#### Scenario: Invalid JSON in final output
- **GIVEN** the final output file exists
- **AND** its contents are not valid JSON
- **WHEN** extracting results
- **THEN** the executor SHALL return an error result
- **AND** the error message SHALL include the parse error details

### Requirement: Workflow Result Structure

The workflow result structure SHALL remain compatible with existing consumers.

#### Scenario: Successful result format
- **GIVEN** a workflow completes successfully
- **WHEN** the result is returned
- **THEN** it SHALL include:
  - `success: true`
  - `data.status: "success"`
  - `data.sandboxId: string`
  - `data.workflowId: string`
  - `data.artifact: object` (the validated final output)

#### Scenario: Error result format
- **GIVEN** a workflow fails or cannot extract results
- **WHEN** the error result is returned
- **THEN** it SHALL include:
  - `success: false`
  - `error.type: string`
  - `error.message: string`
