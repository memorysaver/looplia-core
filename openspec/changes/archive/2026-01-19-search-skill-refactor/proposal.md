# Change: Remove Core Search Skill and Establish Domain Plugin Strategy

## Why

The current `search` skill in looplia-core mixes concerns: it handles both local filesystem search (appropriate for core) and web search (domain-specific). This creates maintenance burden and prevents proper separation between orchestration (core) and domain capabilities (external plugins).

Moving web research capabilities to the external `looplia-skills` repository (`github.com/memorysaver/looplia-skills`) enables:
- Cleaner core plugin focused on workflow orchestration only
- Independent versioning of domain skills
- Community contributions to domain skills without touching core
- Better skill discovery via the registry system

## What Changes

- **REMOVED**: Delete `plugins/looplia-core/skills/search/` directory entirely
- The looplia-core plugin retains only orchestration skills:
  - `workflow-executor`
  - `workflow-executor-inline`
  - `workflow-validator`
  - `workflow-schema-composer`
  - `registry-loader`
  - `skill-capability-matcher`

**Note**: The replacement `browser-research` skill will be created in the external `looplia-skills` repository, not in looplia-core. This proposal only covers the removal from core.

## Impact

- **Affected specs**: New capability `skill-architecture` documenting core/domain separation
- **Affected code**:
  - `plugins/looplia-core/skills/search/SKILL.md` (delete)
  - No changes to `run.ts` or `build.ts` (they don't depend on search skill)
- **Breaking change**: No. The search skill is not directly invoked by CLI commands.
- **Migration**: Users needing web search should install `search-and-research` plugin from `looplia-skills` registry.
