## MODIFIED Requirements

### Requirement: External Domain Skills Registry

Domain-specific skills SHALL be distributed via external repositories (e.g., `github.com/memorysaver/looplia-skills`) and discovered through the skill registry system. Auto-discovered skills from skills.sh SHALL be installed to the `auto-discovery-plugin`.

#### Scenario: Domain skills available via registry
- **WHEN** a user runs `looplia registry sync`
- **THEN** skills from configured registry sources (including `looplia-skills`) are compiled into the skill catalog
- **AND** domain skills can be installed with `looplia skill add <name>`

#### Scenario: Default registry includes looplia-skills
- **WHEN** a user runs `looplia init`
- **THEN** `looplia-skills` is added as a default registry source
- **AND** domain skills from this repository are available for installation

#### Scenario: Auto-discovered skills in registry
- **WHEN** skills are installed to `auto-discovery-plugin` during build
- **THEN** those skills are included in the next registry compilation
- **AND** are available for use in workflow execution

## ADDED Requirements

### Requirement: Unified plugin directory structure

All plugins (first-party, third-party, and auto-discovered) SHALL be located under `~/.looplia/plugins/` directory.

#### Scenario: First-party plugins in plugins directory
- **WHEN** inspecting `~/.looplia/plugins/` after `looplia init`
- **THEN** `looplia-core` plugin exists at `~/.looplia/plugins/looplia-core/`
- **AND** `looplia-writer` plugin exists at `~/.looplia/plugins/looplia-writer/`

#### Scenario: Plugin path scanning
- **WHEN** system scans for available plugins
- **THEN** system scans only `~/.looplia/plugins/` directory
- **AND** returns all subdirectories as plugin paths

#### Scenario: Third-party plugins in same location
- **WHEN** a third-party plugin is installed via registry
- **THEN** it is placed at `~/.looplia/plugins/<plugin-name>/`
- **AND** is discovered alongside first-party plugins

### Requirement: Migration from legacy structure

The system SHALL automatically migrate existing installations from the legacy structure (first-party plugins at root) to the unified structure.

#### Scenario: Detect legacy structure
- **WHEN** `looplia init` runs
- **AND** `~/.looplia/looplia-core/` exists at root level
- **AND** `~/.looplia/plugins/looplia-core/` does not exist
- **THEN** system detects this as legacy structure requiring migration

#### Scenario: Migrate first-party plugins
- **WHEN** legacy structure is detected
- **THEN** system moves `~/.looplia/looplia-core/` to `~/.looplia/plugins/looplia-core/`
- **AND** system moves `~/.looplia/looplia-writer/` to `~/.looplia/plugins/looplia-writer/`
- **AND** logs "Migrating plugin structure to v0.8.0..."

#### Scenario: Skip migration if already migrated
- **WHEN** `looplia init` runs
- **AND** `~/.looplia/plugins/looplia-core/` already exists
- **THEN** system skips migration
