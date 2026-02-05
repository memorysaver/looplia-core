## ADDED Requirements

### Requirement: Search skills.sh registry
The CLI SHALL provide a `looplia skill search <query>` subcommand that searches the skills.sh registry for skills matching the query.

#### Scenario: Successful search with results
- **WHEN** user runs `looplia skill search "pdf"`
- **THEN** system searches skills.sh registry using `npx skills find "pdf"`
- **THEN** system displays matching skills in a formatted table

#### Scenario: Search with no results
- **WHEN** user runs `looplia skill search "nonexistent-skill-xyz"`
- **THEN** system displays "No skills found matching your query."

#### Scenario: Search without query
- **WHEN** user runs `looplia skill search` without a query
- **THEN** system displays error "Error: Search query required"
- **THEN** system displays usage hint

### Requirement: Display search results
The CLI SHALL display search results in a formatted table showing skill name, owner/repo, and description.

#### Scenario: Results table format
- **WHEN** search returns results
- **THEN** system displays numbered rows (1, 2, 3...)
- **THEN** each row shows: number, skill name, owner/repo, truncated description
- **THEN** table has header row and separator lines

### Requirement: Interactive installation prompt
The CLI SHALL prompt for skill selection when running in interactive (TTY) mode.

#### Scenario: Interactive mode selection
- **WHEN** search completes with results in TTY mode
- **THEN** system prompts "Enter number(s) to install (comma-separated), or 'q' to quit:"
- **THEN** user can enter single number (e.g., "1") or multiple (e.g., "1,2,3")

#### Scenario: User quits without installing
- **WHEN** user enters "q" or empty input at prompt
- **THEN** system displays "No skills installed."
- **THEN** command exits without error

#### Scenario: Invalid selection
- **WHEN** user enters numbers outside valid range
- **THEN** system filters to only valid indices
- **THEN** if no valid selections remain, displays "No valid selection. No skills installed."

### Requirement: Install selected skills
The CLI SHALL install selected skills to the auto-discovery-plugin.

#### Scenario: Successful installation
- **WHEN** user selects valid skill number(s)
- **THEN** system fetches SKILL.md content from GitHub
- **THEN** system installs to `~/.looplia/plugins/auto-discovery-plugin/skills/<name>/`
- **THEN** system displays "✓ Installed: <name> → <path>"

#### Scenario: Installation failure
- **WHEN** skill content fetch fails
- **THEN** system displays "✗ Failed to install <name>: <error>"
- **THEN** system continues with remaining selections

### Requirement: Non-interactive mode behavior
The CLI SHALL handle non-interactive (piped) mode gracefully.

#### Scenario: Piped input mode
- **WHEN** search runs with stdin not a TTY (e.g., `echo "" | looplia skill search "pdf"`)
- **THEN** system displays search results
- **THEN** system displays "To install a skill, run: looplia skill add <name>"
- **THEN** system does NOT prompt for input
