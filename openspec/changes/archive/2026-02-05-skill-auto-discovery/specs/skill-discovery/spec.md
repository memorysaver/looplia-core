## ADDED Requirements

### Requirement: Build-time skill discovery

The system SHALL search for relevant skills during `looplia build` based on the workflow description provided by the user.

#### Scenario: Skills discovered for workflow description
- **WHEN** user runs `looplia build "analyze PDFs and create Excel reports"`
- **THEN** system searches skills.sh registry using the description as query
- **AND** presents discovered skills to the user (in interactive mode)
- **AND** auto-selects top matches (in batch mode)

#### Scenario: No skills found
- **WHEN** user runs `looplia build` with a description
- **AND** no matching skills are found in skills.sh
- **THEN** system logs "No additional skills found, using local catalog"
- **AND** continues with workflow generation using local skills only

#### Scenario: Skip research flag
- **WHEN** user runs `looplia build "..." --skip-research`
- **THEN** system skips skill discovery phase
- **AND** uses only locally installed skills

### Requirement: Auto-discovery plugin structure

The system SHALL maintain an `auto-discovery-plugin` at `~/.looplia/plugins/auto-discovery-plugin/` with proper Claude plugin structure.

#### Scenario: Plugin structure created
- **WHEN** a skill is discovered and selected for installation
- **AND** `auto-discovery-plugin` does not exist
- **THEN** system creates `~/.looplia/plugins/auto-discovery-plugin/.claude-plugin/plugin.json`
- **AND** system creates `~/.looplia/plugins/auto-discovery-plugin/skills/` directory

#### Scenario: Skill installed to plugin
- **WHEN** a skill is discovered and selected for installation
- **THEN** system fetches the skill's SKILL.md content from GitHub
- **AND** writes it to `~/.looplia/plugins/auto-discovery-plugin/skills/<skill-name>/SKILL.md`

### Requirement: Vercel CLI integration

The system SHALL use Vercel's `npx skills find` CLI to search the skills.sh registry.

#### Scenario: Successful skill search
- **WHEN** system executes `npx skills find "<query>"`
- **THEN** system parses the CLI output to extract skill metadata
- **AND** returns list of matching skills with name, description, owner, and repository

#### Scenario: CLI unavailable
- **WHEN** system attempts to execute `npx skills find`
- **AND** the command fails or times out
- **THEN** system logs warning "Skills search failed, using local catalog fallback"
- **AND** continues with empty search results

### Requirement: Skill content fetching

The system SHALL fetch skill content from GitHub raw content URLs.

#### Scenario: Fetch skill from GitHub
- **WHEN** a skill is selected for installation
- **THEN** system constructs URL `https://raw.githubusercontent.com/<owner>/<repo>/main/skills/<skill-name>/SKILL.md`
- **AND** fetches the content via HTTP GET
- **AND** writes content to auto-discovery-plugin

#### Scenario: Fetch fails
- **WHEN** skill content fetch returns non-200 status
- **THEN** system logs warning with skill name and error
- **AND** continues with next skill (does not abort build)
