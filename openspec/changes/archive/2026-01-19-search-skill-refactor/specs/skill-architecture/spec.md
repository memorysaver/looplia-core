## ADDED Requirements

### Requirement: Core Plugin Orchestration Scope

The looplia-core plugin SHALL contain only workflow orchestration skills that are essential for the workflow engine operation. Domain-specific capabilities (such as web search, content analysis, code generation) SHALL be provided by external plugins.

#### Scenario: Core plugin contains only orchestration skills
- **WHEN** inspecting the looplia-core plugin skills directory
- **THEN** the following skills are present:
  - `workflow-executor`
  - `workflow-executor-inline`
  - `workflow-validator`
  - `workflow-schema-composer`
  - `registry-loader`
  - `skill-capability-matcher`
- **AND** no domain-specific skills (search, analysis, generation) are present

#### Scenario: Web search capability not in core
- **WHEN** a user needs web search or research capabilities
- **THEN** they SHALL install the `search-and-research` plugin from the `looplia-skills` registry
- **AND** use skills like `web-search`, `rss-reader`, or `browser-research`

### Requirement: External Domain Skills Registry

Domain-specific skills SHALL be distributed via external repositories (e.g., `github.com/memorysaver/looplia-skills`) and discovered through the skill registry system.

#### Scenario: Domain skills available via registry
- **WHEN** a user runs `looplia registry sync`
- **THEN** skills from configured registry sources (including `looplia-skills`) are compiled into the skill catalog
- **AND** domain skills can be installed with `looplia skill add <name>`

#### Scenario: Default registry includes looplia-skills
- **WHEN** a user runs `looplia init`
- **THEN** `looplia-skills` is added as a default registry source
- **AND** domain skills from this repository are available for installation

## REMOVED Requirements

### Requirement: Search Skill in Core Plugin

**Reason**: The search skill mixed local filesystem search with web search capabilities, crossing the boundary between orchestration (core) and domain functionality. Web research capabilities are now provided by the external `looplia-skills` repository.

**Migration**: Users should install the `search-and-research` plugin from `looplia-skills` and use:
- `web-search` for general web queries
- `rss-reader` for RSS/Atom feeds
- `browser-research` for interactive web pages requiring browser automation
