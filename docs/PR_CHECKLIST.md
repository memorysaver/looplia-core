# PR Checklist

> Quick reference for Claude Code and contributors before creating or merging PRs.

---

## 1. OpenSpec Decision (Start Here)

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

## 2. Pre-Merge Checklist

- [ ] **CI passes** - All GitHub Actions checks green
- [ ] **Version bumped** - Patch/Minor/Major as appropriate
- [ ] **CHANGELOG.md** - Entry added under correct version
- [ ] **OpenSpec validated** - If proposal exists
- [ ] **Tests pass locally** - `bun test && bun run check-types`

---

## 3. Key Documents to Update

| Document | Update When |
|----------|-------------|
| `CHANGELOG.md` | Always (required) |
| `README.md` (root) | Architecture changes, version bump |
| `docs/README.md` | New features, version bump |
| `docs/GLOSSARY.md` | New domain terms |
| `openspec/project.md` | Conventions changed |

See [docs/README.md](./README.md) for full documentation index.

---

## 4. PR Description Template

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

## 5. Post-Merge

If OpenSpec proposal was used:
```bash
openspec archive <change-id> --yes
```

---

## Quick Commands

```bash
# Local verification
bun test && bun run check-types && bun x ultracite check

# OpenSpec
openspec list                    # List active changes
openspec validate <id> --strict --no-interactive
openspec archive <id> --yes      # Post-merge cleanup
```

---

*See [openspec/project.md](../openspec/project.md) for project conventions.*
