## Why

Currently, looplia requires users to manually discover and install skills before building workflows. The `looplia build` command only uses skills that are already installed locally, limiting workflow generation to pre-installed capabilities. This creates friction: users must know what skills exist, find them, and install them before they can build workflows that use them.

## What Changes

- **Unified plugin directory**: Move all plugins (first-party, third-party, auto-discovered) under `~/.looplia/plugins/` for consistent organization **BREAKING**
- **Auto-discovery plugin**: Create `auto-discovery-plugin` as a proper Claude plugin structure to hold skills discovered during build
- **Build-time skill research**: Add skill research phase to `looplia build` that searches skills.sh using Vercel's `npx skills find` CLI
- **Automatic skill installation**: Download and install discovered skills to `auto-discovery-plugin` before workflow generation
- **Migration support**: Automatically migrate existing installations from old structure (first-party at root) to new unified structure
- **Offline mode**: Add `--skip-research` flag to skip skill discovery when offline

## Capabilities

### New Capabilities

- `skill-discovery`: Covers the skill search service using Vercel's CLI, auto-discovery plugin management, and skill content fetching from GitHub

### Modified Capabilities

- `skill-architecture`: Requirement changes to support unified `~/.looplia/plugins/` structure for all plugin types (first-party, third-party, auto-discovered) and auto-discovery plugin as the destination for dynamically discovered skills

## Impact

**Code:**
- `packages/provider/src/bootstrap/index.ts` - Plugin path resolution changes
- `packages/provider/src/bootstrap/skill-installer.ts` - Update for unified structure
- `apps/cli/src/commands/build.ts` - Add skill research phase
- `apps/cli/src/commands/init.ts` - Add migration logic
- `packages/provider/src/registry/compiler.ts` - Update paths

**New files:**
- `packages/provider/src/discovery/auto-discovery-plugin.ts`
- `packages/provider/src/discovery/skills-search.ts`

**APIs:**
- New `--skip-research` / `--offline` flag on `looplia build`

**Dependencies:**
- Relies on `npx skills` CLI being available (graceful fallback if unavailable)

**Systems:**
- Existing `~/.looplia` installations will be migrated on next `looplia init`
- Plugin loading path changes from scanning root + plugins/ to scanning only plugins/
