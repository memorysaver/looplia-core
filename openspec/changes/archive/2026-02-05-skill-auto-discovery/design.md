## Context

Currently, looplia has a split plugin structure:
- First-party plugins (`looplia-core`, `looplia-writer`) live at `~/.looplia/` root level
- Third-party plugins live at `~/.looplia/plugins/`

The `looplia build` command only uses locally installed skills to generate workflows. Users must manually discover and install skills before building workflows that need them.

Vercel has created a skill ecosystem at skills.sh with CLI tools (`npx skills find/add`) for discovering and installing skills. This provides a searchable registry of 41K+ skills that could be leveraged during workflow generation.

## Goals / Non-Goals

**Goals:**
- Unify all plugins under `~/.looplia/plugins/` for consistent organization
- Auto-discover relevant skills during `looplia build` based on workflow description
- Install discovered skills to a proper Claude plugin structure (`auto-discovery-plugin`)
- Maintain backward compatibility through automatic migration
- Graceful degradation when offline or skills.sh unavailable

**Non-Goals:**
- Replacing the existing skill registry system
- Modifying how `looplia run` loads plugins (it already scans plugins/)
- Creating a custom skill registry (we use skills.sh)
- Skill dependency resolution (skills are standalone)

## Decisions

### Decision 1: Unified plugins/ directory

**Choice**: Move first-party plugins into `~/.looplia/plugins/` alongside third-party plugins.

**Rationale**:
- Simplifies `getProdPluginPaths()` to scan a single directory
- Consistent organization - all plugins in one place
- Makes auto-discovery-plugin a natural peer of other plugins

**Alternatives considered**:
- Keep split structure, add auto-discovery to root → inconsistent with third-party pattern
- Add workspace-local .looplia/skills/ → adds complexity, user rejected this approach

### Decision 2: auto-discovery-plugin as Claude plugin structure

**Choice**: Create `~/.looplia/plugins/auto-discovery-plugin/` with proper `.claude-plugin/plugin.json` and `skills/` directory.

**Rationale**:
- Fits existing plugin loading mechanism - no changes to SDK integration
- Skills installed here are automatically discovered by `getSelectivePluginPaths()`
- Allows tracking which skills were auto-discovered vs manually installed

**Alternatives considered**:
- Install directly to existing plugins → mixes manual and auto installs
- Create separate discovery mechanism → requires changes to SDK plugin loading

### Decision 3: Use Vercel's `npx skills find` CLI

**Choice**: Shell out to `npx skills find <query>` and parse the output.

**Rationale**:
- Leverages existing skills.sh infrastructure (41K+ skills)
- No need to reverse-engineer or maintain API integration
- CLI handles authentication, rate limiting, etc.

**Alternatives considered**:
- Direct skills.sh API calls → undocumented API, may change
- GitHub search API → less curated, no skill metadata
- Build our own registry → massive effort, duplicates existing work

### Decision 4: Fetch SKILL.md from GitHub raw content

**Choice**: After finding a skill via CLI, fetch its `SKILL.md` from GitHub raw content URL.

**Rationale**:
- CLI gives us owner/repo, we can construct raw URL
- No need to clone entire repository for one file
- Fast and reliable

**Alternatives considered**:
- `npx skills add` → installs to current directory, not our plugin structure
- Git sparse checkout → more complex than simple fetch

### Decision 5: Research happens at build time, not run time

**Choice**: Skill discovery runs during `looplia build`, not during `looplia run`.

**Rationale**:
- Build is where workflow is created - appropriate time to gather needed skills
- Run should be fast and deterministic - no network calls
- Skills are persisted in auto-discovery-plugin for subsequent runs

**Alternatives considered**:
- Run-time discovery → adds latency, non-deterministic behavior
- Init-time discovery → too early, don't know what workflows user will build

## Risks / Trade-offs

**[Risk] `npx skills` CLI unavailable** → Graceful fallback: log warning, continue with local skills only. Build still succeeds with reduced capability.

**[Risk] GitHub rate limiting** → Cache fetched skills locally. Once installed, skill persists. Rate limiting only affects first-time discovery.

**[Risk] Malicious skills from skills.sh** → Same risk as current third-party plugins. Users can use `--skip-research` to avoid auto-discovery. Skills are markdown files, not executable code.

**[Risk] Breaking change for existing installations** → Migration logic moves first-party plugins to new location automatically. Old structure still works until migration runs.

**[Trade-off] Dependency on external CLI** → We gain access to 41K+ skills but depend on Vercel maintaining the CLI. Acceptable because CLI is simple wrapper and we have fallback.

**[Trade-off] Parse CLI output vs API** → Parsing CLI output is fragile if format changes. However, this is simpler than maintaining API integration and format changes are rare.

## Migration Plan

1. **v0.8.0 init detects old structure**: Check for `~/.looplia/looplia-core/` (root level)
2. **Auto-migrate on init**: Move to `~/.looplia/plugins/looplia-core/`
3. **No manual intervention required**: Migration is transparent to user
4. **Rollback**: Not needed - new structure is backward compatible with run command

## Open Questions

1. **Skill selection UX**: In interactive mode, how should we present discovered skills? Simple list with checkboxes? Show descriptions?
2. **Duplicate handling**: If a skill is already installed (via manual `looplia skill add`), should auto-discovery skip it or update it?
3. **Skill versioning**: Should auto-discovery-plugin track which version of a skill was installed? (Current plan: no versioning, always fetch latest)
