# Build Validation Capability

Validation hooks for the build command that ensure generated workflows have valid YAML frontmatter and well-formed structure.

## ADDED Requirements

### Requirement: Build Hooks Config Parameter

The SDK config SHALL support a separate `buildHooks` parameter for build-specific validation hooks, distinct from `runHooks`.

#### Scenario: Build command passes buildHooks

- **GIVEN** the build command is executing
- **WHEN** creating the Claude Agent executor
- **THEN** it SHALL pass `buildHooks: createBuildHooks()` in the config
- **AND** `runHooks` SHALL NOT be set

#### Scenario: Run command passes runHooks

- **GIVEN** the run command is executing
- **WHEN** creating the Claude Agent executor
- **THEN** it SHALL pass `runHooks: createWorkflowHooks()` in the config
- **AND** `buildHooks` SHALL NOT be set

### Requirement: Build PostToolUse Validation Hook

A PostToolUse hook SHALL validate workflow files when written to the workflows directory.

#### Scenario: Valid workflow file written

- **GIVEN** the agent writes a file to `~/.looplia/workflows/*.md`
- **WHEN** the PostToolUse hook fires
- **THEN** the hook SHALL parse the workflow using `parseWorkflow()`
- **AND** SHALL update validation.json with `workflowValidated: true`
- **AND** SHALL return empty response (allow write)
- **AND** SHALL log "✓ Workflow validated: {name}"

#### Scenario: Invalid workflow YAML frontmatter

- **GIVEN** the agent writes a file with invalid YAML to `~/.looplia/workflows/*.md`
- **WHEN** the PostToolUse hook fires
- **THEN** the hook SHALL return `{ decision: "block", reason: "..." }`
- **AND** the reason SHALL include the parse error message
- **AND** the reason SHALL be actionable (tell agent what to fix)

#### Scenario: Workflow missing required fields

- **GIVEN** the agent writes a workflow missing `name`, `description`, or `steps`
- **WHEN** the PostToolUse hook fires
- **THEN** the hook SHALL return `{ decision: "block", reason: "..." }`
- **AND** the reason SHALL identify the missing field

#### Scenario: Non-workflow file ignored

- **GIVEN** the agent writes a file NOT matching `workflows/*.md`
- **WHEN** the PostToolUse hook fires
- **THEN** the hook SHALL return empty response (no validation)

### Requirement: Build Stop Guard Hook

A Stop hook SHALL block workflow completion until the workflow file is validated.

#### Scenario: Stop before validation

- **GIVEN** validation.json has `workflowValidated: false`
- **WHEN** the agent attempts to stop
- **THEN** the Stop hook SHALL return `{ decision: "block", reason: "..." }`
- **AND** the reason SHALL instruct the agent to write the workflow file

#### Scenario: Stop after validation

- **GIVEN** validation.json has `workflowValidated: true`
- **WHEN** the agent attempts to stop
- **THEN** the Stop hook SHALL return empty response (allow stop)

### Requirement: Build-Type Validation Manifest

The build command SHALL create a build-specific validation.json manifest.

#### Scenario: Initial build validation.json

- **GIVEN** the build command starts execution
- **WHEN** sandbox is created
- **THEN** validation.json SHALL be created with:
  - `type: "build"`
  - `workflow: "{workflow-name}"`
  - `status: "building"`
  - `workflowValidated: false`
  - `workflowPath: null`

#### Scenario: Validation.json after successful validation

- **GIVEN** the PostToolUse hook validates a workflow successfully
- **WHEN** updating validation.json
- **THEN** it SHALL set `workflowValidated: true`
- **AND** SHALL set `workflowPath` to the written file path
- **AND** SHALL set `status: "validated"`

### Requirement: Build Result Extraction

The `extractSandboxResult()` function SHALL handle build-type validation manifests.

#### Scenario: Extract result from validated build

- **GIVEN** validation.json has `type: "build"` and `workflowValidated: true`
- **WHEN** `extractSandboxResult()` is called
- **THEN** it SHALL return success with `workflowPath` from manifest

#### Scenario: Extract result from unvalidated build

- **GIVEN** validation.json has `type: "build"` and `workflowValidated: false`
- **WHEN** `extractSandboxResult()` is called
- **THEN** it SHALL return error "Workflow not validated"

### Requirement: Workflow File Detection

The build hooks SHALL correctly identify workflow files by path.

#### Scenario: Detect workflow in user directory

- **GIVEN** file path `~/.looplia/workflows/my-workflow.md`
- **WHEN** `isWorkflowFile()` is called
- **THEN** it SHALL return `true`

#### Scenario: Detect workflow in absolute path

- **GIVEN** file path `/Users/user/.looplia/workflows/test.md`
- **WHEN** `isWorkflowFile()` is called
- **THEN** it SHALL return `true`

#### Scenario: Reject non-workflow paths

- **GIVEN** file paths like `sandbox/outputs/result.json` or `plugins/skill/SKILL.md`
- **WHEN** `isWorkflowFile()` is called
- **THEN** it SHALL return `false`
