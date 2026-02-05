## Context

The v0.8.0 release introduced the discovery module (`@looplia-core/provider/discovery`) with:
- `searchSkills(query)` - searches skills.sh via `npx skills find`
- `fetchSkillContent(owner, repo, skillName)` - fetches SKILL.md from GitHub
- `installSkillToAutoDiscovery(name, content)` - installs to auto-discovery-plugin

These functions are used by `looplia build` for automatic skill research. This change exposes the same capability as a standalone CLI command.

## Goals / Non-Goals

**Goals:**
- Allow users to search skills.sh registry from CLI
- Display results in readable table format
- Enable interactive selection and installation in TTY mode
- Graceful handling of non-interactive (piped) mode

**Non-Goals:**
- Pagination for large result sets (defer to future)
- Filtering/sorting options (keep simple for v1)
- Caching search results

## Decisions

### 1. Reuse existing discovery module
**Decision:** Import from `@looplia-core/provider/discovery` rather than duplicating code.

**Rationale:** The discovery module already handles:
- CLI parsing quirks from `npx skills find`
- Multiple SKILL.md path fallbacks
- Auto-discovery-plugin structure

**Alternative considered:** Direct `npx skills find` call in skill.ts - rejected to avoid duplication.

### 2. Interactive installation prompt
**Decision:** Use `readline` for TTY detection and number-based selection.

**Rationale:**
- `process.stdin.isTTY` reliably detects interactive mode
- Number selection (1,2,3) is simpler than typing skill names
- Comma-separated input allows batch installation

**Alternative considered:** Always show results without prompt - rejected as it adds friction for the common "search then install" workflow.

### 3. Install to auto-discovery-plugin
**Decision:** Use `installSkillToAutoDiscovery()` for all search-installed skills.

**Rationale:** Consistent with `looplia build` behavior. Auto-discovery-plugin is the designated location for externally sourced skills.

## Risks / Trade-offs

- **[Network dependency]** → Search requires internet and `npx skills` availability. Mitigation: Graceful error message when search fails.
- **[skills.sh output format changes]** → Parser may break. Mitigation: Existing `parseSkillsOutput()` handles multiple formats, already battle-tested in v0.8.0.
- **[TTY detection edge cases]** → Some terminals may not set isTTY correctly. Mitigation: Non-interactive fallback always works.
