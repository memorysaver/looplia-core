# cli-artifact-persistence Specification

## Purpose
TBD - created by archiving change add-cli-artifact-persistence. Update Purpose after archive.
## Requirements
### Requirement: CLI-Controlled Artifact Persistence

The CLI SHALL write artifact files to disk based on structured output from agent commands, rather than relying on the agent to write files directly.

The artifact schema is:
```typescript
artifact: {
  filename: string;  // Required: e.g., "article-summary.md"
  content: string;   // Required: full markdown file content
}
```

Note: `workspace` refers to `~/.looplia` (the user's looplia home directory).

#### Scenario: Build command writes workflow from structured_output

- **WHEN** the build command receives a successful result with valid `artifact.filename` and `artifact.content`
- **THEN** the CLI writes the content to `{workspace}/workflows/{artifact.filename}`
- **AND** the CLI verifies the file exists after writing
- **AND** logs the file path to the user

#### Scenario: Build command handles missing artifact gracefully

- **WHEN** the build command receives a successful result without `artifact`
- **THEN** the CLI logs a warning that no artifact was provided
- **AND** the command still returns success (backward compatibility)

#### Scenario: Build command handles invalid artifact gracefully

- **WHEN** the build command receives `artifact` with empty `content` or missing `filename`
- **THEN** the CLI logs a warning describing the invalid artifact
- **AND** the command still returns success (backward compatibility)

#### Scenario: Workflow file write failure

- **WHEN** the CLI fails to write the workflow file (e.g., permission denied)
- **THEN** the CLI logs an error with the specific failure reason
- **AND** the command returns error status

### Requirement: Workflow Schema Composer Returns Content

The `workflow-schema-composer` skill SHALL return the complete workflow content in its JSON output, matching the artifact schema.

#### Scenario: Skill returns workflow content

- **WHEN** the workflow-schema-composer generates a workflow
- **THEN** the output JSON includes `filename` (string, e.g., "video-to-blog.md")
- **AND** the output JSON includes `content` (string, complete markdown with YAML frontmatter + body)

### Requirement: Artifact Write Utility

The CLI SHALL provide a reusable utility function for writing workflow artifacts.

#### Scenario: Write workflow artifact

- **WHEN** `writeWorkflowArtifact(workspace, filename, content)` is called with valid parameters
- **THEN** the function creates `{workspace}/workflows/` directory if it does not exist
- **AND** writes `content` to `{workspace}/workflows/{filename}`
- **AND** returns the full absolute path to the written file

#### Scenario: Overwrite existing workflow

- **WHEN** `writeWorkflowArtifact` is called with a filename that already exists
- **THEN** the existing file is overwritten with new content
- **AND** no error is raised

#### Scenario: Invalid parameters

- **WHEN** `writeWorkflowArtifact` is called with empty `filename` or empty `content`
- **THEN** the function returns `null` without writing
- **AND** no error is thrown

