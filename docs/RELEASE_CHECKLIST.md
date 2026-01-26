# Development and Release Workflow

> Quick reference for Claude Code and contributors for development and release processes.

---

## Development Workflow

### Feature Development

1. **Create OpenSpec proposal** (if required - see table below)
2. **Create feature branch** from `main`
3. **Implement** following the proposal's tasks.md
4. **Update CHANGELOG.md** - Add entry under `## [Unreleased]`
5. **Create PR** and merge to `main`
6. **Archive OpenSpec** after merge: `openspec archive <id> --yes`

### When to Create a Proposal

| Requires Proposal | Skip Proposal |
|-------------------|---------------|
| New features/capabilities | Bug fixes |
| Breaking changes (API, schema) | Typos, formatting, comments |
| Architecture/pattern changes | Non-breaking dependency updates |
| Performance/security changes | Tests for existing behavior |

**If proposal required:**
```bash
openspec validate <change-id> --strict --no-interactive
```

---

## Release Workflow

### Version Bump Process

1. **Create version bump branch**: `git checkout -b chore/version-bump-X.Y.Z`
2. **Update all version references** (see checklist below)
3. **Run verification**: `bun test && bun run check-types`
4. **Create PR** and merge to `main`
5. **Push tag**: `git tag vX.Y.Z && git push origin vX.Y.Z`

### Version Bump Checklist

**Package.json files** (5 files):
- [ ] `apps/cli/package.json`
- [ ] `apps/docs/package.json`
- [ ] `packages/core/package.json`
- [ ] `packages/config/package.json`
- [ ] `packages/provider/package.json`

**Changelog**:
- [ ] `CHANGELOG.md` - Move `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD`
- [ ] `CHANGELOG.md` - Add new `[Unreleased]` link, update version comparison links

**Documentation**:
- [ ] `docs/README.md` - Version header, architecture refs (4 places)
- [ ] `apps/docs/src/content/docs/index.mdx` - Footer version badge

**Verification**:
```bash
# Check versions updated
grep -r '"X.Y.Z"' --include="*.json" . | grep -v node_modules

# Run tests
bun test && bun run check-types
```

### CI/CD Trigger

Tag push triggers the CI release workflow:
- `git tag vX.Y.Z` creates the version tag
- `git push origin vX.Y.Z` triggers automated release pipeline
- Pipeline publishes npm packages and creates GitHub release

---

## Quick Reference

| Action | Command |
|--------|---------|
| Local verify | `bun test && bun run check-types && bun x ultracite check` |
| List changes | `openspec list` |
| Validate | `openspec validate <id> --strict --no-interactive` |
| Archive | `openspec archive <id> --yes` |

---

## Key Documents to Update

| Document | Update When |
|----------|-------------|
| `CHANGELOG.md` | Always (required for features) |
| `README.md` (root) | Architecture changes, version bump |
| `docs/README.md` | New features, version bump |
| `docs/GLOSSARY.md` | New domain terms |
| `openspec/project.md` | Conventions changed |

See [docs/README.md](./README.md) for full documentation index.

---

## PR Description Template

```markdown
## Summary
[Brief description]

## OpenSpec
- Proposal required: Yes / No
- Change ID: `<id>` (if applicable)

## Changes
- Version: `X.X.X` -> `X.X.X`
- CHANGELOG.md updated: Yes

## Testing
- `bun test` passes
- `bun run check-types` passes
```

---

*See [openspec/project.md](../openspec/project.md) for project conventions.*
