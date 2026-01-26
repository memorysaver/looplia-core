---
name: version-bump
description: |
  Bump version across all looplia-core package.json files, changelog, and documentation.
  Use when: releasing a new version, preparing a version bump PR, updating version numbers
  across the monorepo. Handles all 5 package.json files, CHANGELOG.md, docs/README.md,
  and the landing page version badge.
---

# Version Bump

Bump version from `X.Y.Z` to `A.B.C` across all files in looplia-core monorepo.

## Files to Update

### Package.json (5 files)

```
apps/cli/package.json
apps/docs/package.json
packages/core/package.json
packages/config/package.json
packages/provider/package.json
```

Edit: `"version": "X.Y.Z"` → `"version": "A.B.C"`

### CHANGELOG.md

1. Replace `## [Unreleased]` with `## [A.B.C] - YYYY-MM-DD`
2. Update comparison links at bottom:
   ```markdown
   [Unreleased]: https://github.com/memorysaver/looplia-core/compare/vA.B.C...HEAD
   [A.B.C]: https://github.com/memorysaver/looplia-core/compare/vX.Y.Z...vA.B.C
   ```

### docs/README.md (4 places)

- Line ~3: `> **Version:** X.Y.Z`
- Line ~12: `vX.Y.Z architecture`
- Line ~79: `DOCUMENT RELATIONSHIPS (vX.Y.Z)`
- Line ~283: `vX.Y.Z documentation`

### Landing Page Badge

`apps/docs/src/content/docs/index.mdx` - footer version badge:
```html
<span class="version-badge">vA.B.C</span>
```

## Verification

```bash
# Check versions updated
grep -r '"A.B.C"' --include="*.json" . | grep -v node_modules

# Run tests
bun test && bun run check-types
```

## Commit

```bash
git add apps/cli/package.json apps/docs/package.json \
  packages/core/package.json packages/config/package.json \
  packages/provider/package.json CHANGELOG.md docs/README.md \
  apps/docs/src/content/docs/index.mdx

git commit -m "$(cat <<'EOF'
chore: version bump X.Y.Z → A.B.C

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```
