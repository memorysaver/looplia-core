## Why

Users need to discover skills from the skills.sh registry before installing them. Currently, `looplia skill add` requires knowing the exact skill name, but there's no way to search and explore available skills. The v0.8.0 auto-discovery feature added `searchSkills()` for automatic skill research during `looplia build`, but this capability isn't exposed as a standalone CLI command.

## What Changes

- Add `looplia skill search <query>` subcommand to search the skills.sh registry
- Display search results in a formatted table with name, owner/repo, and description
- Prompt for interactive installation when running in TTY mode
- Install selected skills to `auto-discovery-plugin` using existing discovery module

## Capabilities

### New Capabilities

- `skill-search-command`: CLI subcommand for searching and interactively installing skills from skills.sh registry

### Modified Capabilities

None - this extends the existing skill command without changing existing behavior.

## Impact

- **Code**: `apps/cli/src/commands/skill.ts` - add `search` subcommand
- **Dependencies**: Reuses `@looplia-core/provider/discovery` module (already implemented in v0.8.0)
- **Documentation**: Update `docs.looplia.run/cli/skill/` with new `search` subcommand
