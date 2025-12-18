# PR Checklist

> **For Claude Code and Contributors:** Use this checklist before creating or merging pull requests to ensure consistency across documentation and CI/CD.

---

## Pre-Merge Requirements

**Before merging a PR, verify:**

- [ ] **Version bump** - Has the version been incremented appropriately?
  - Patch (0.5.x) for bug fixes
  - Minor (0.x.0) for new features
  - Major (x.0.0) for breaking changes
- [ ] **CHANGELOG updated** - Are all changes documented in CHANGELOG.md?
- [ ] **Tests pass** - `bun test` and `bun run check-types`
- [ ] **CI/CD green** - All GitHub Actions checks pass

---

## Documentation Updates

When making changes to the codebase, ensure the following documents are updated to reflect the changes:

### Changelog (Required for all PRs)

- [ ] **[CHANGELOG.md](../CHANGELOG.md)**
  - Add entry under appropriate version section
  - Use correct category: Added, Changed, Fixed, Removed, Documentation
  - Follow [Keep a Changelog](https://keepachangelog.com/) format
  - Update version links at bottom of file

### Core Documentation

- [ ] **[README.md](../README.md)** (root)
  - Features list
  - Architecture diagram
  - CLI commands table
  - Quick start guide
  - Environment variables

- [ ] **[docs/README.md](./README.md)** (documentation index)
  - Version number in header
  - "What's New" section
  - Key concepts section
  - Document relationships diagram
  - Quick links for developers/architects

### Architecture Documents

- [ ] **[docs/DESIGN-0.5.2.md](./DESIGN-0.5.2.md)**
  - Plugin structure
  - Command specifications
  - Workflow definitions
  - Sandbox architecture

- [ ] **[docs/AGENTIC_CONCEPT-0.5.md](./AGENTIC_CONCEPT-0.5.md)**
  - Agent system design
  - Subagent definitions
  - Skills auto-loading
  - Validation-driven completion

### Reference Documents

- [ ] **[docs/GLOSSARY.md](./GLOSSARY.md)**
  - New domain terms
  - Updated TypeScript types
  - Workspace structure changes
  - Deprecated terms marked

- [ ] **[docs/TEST_PLAN-0.5.md](./TEST_PLAN-0.5.md)**
  - Test commands and paths
  - Log verification examples
  - Troubleshooting section

---

## CI/CD Alignment

Ensure CI/CD files match the current architecture design:

### GitHub Actions

- [ ] **[.github/workflows/docker-e2e.yml](../.github/workflows/docker-e2e.yml)**
  - Folder paths match design (e.g., `sandbox/` vs `contentItem/`)
  - File paths match design (e.g., `inputs/`, `outputs/`, `logs/`)
  - Validation steps align with `validation.json` schema
  - Subagent verification matches expected agents

### Test Scripts

- [ ] **[scripts/docker-e2e.sh](../scripts/docker-e2e.sh)**
  - Version number in header
  - Folder structure matches design
  - Output paths match design
  - Workspace validation checks correct directories

### Other CI Files

- [ ] **[.github/workflows/ci.yml](../.github/workflows/ci.yml)** (if exists)
  - Build and test commands
  - Type checking

---

## Version Consistency

When releasing a new version, update version references in:

- [ ] `CHANGELOG.md` - Add new version section, update version links
- [ ] `docs/README.md` header (`Version: X.X.X`)
- [ ] `scripts/docker-e2e.sh` header comment and `main()` output
- [ ] `package.json` files (if applicable)
- [ ] Design document filenames (e.g., `DESIGN-0.5.2.md`)

---

## Folder Structure Changes

If changing the workspace folder structure (e.g., `contentItem/` to `sandbox/`):

1. **Update all documentation** with new paths
2. **Update GLOSSARY.md** with new/deprecated terms
3. **Update CI/CD files** with new paths
4. **Update test scripts** with new paths
5. **Search codebase** for hardcoded paths:
   ```bash
   grep -r "contentItem" --include="*.ts" --include="*.md" --include="*.yml" --include="*.sh"
   ```

---

## Quick Verification Commands

```bash
# Check for outdated path references
grep -r "contentItem" docs/ .github/ scripts/ --include="*.md" --include="*.yml" --include="*.sh"

# Verify documentation links work
find docs/ -name "*.md" -exec grep -l "\[.*\](.*\.md)" {} \;

# Check version consistency
grep -r "Version:" docs/README.md scripts/docker-e2e.sh

# Run tests to verify CI alignment
bun test
bun run check-types
```

---

## PR Description Template

When creating a PR, include:

```markdown
## Summary
[Brief description of changes]

## Version & Changelog
- [ ] Version bumped (if applicable): `X.X.X` → `X.X.X`
- [ ] CHANGELOG.md updated with changes

## Documentation Updated
- [ ] README.md
- [ ] docs/README.md
- [ ] docs/GLOSSARY.md
- [ ] docs/TEST_PLAN-0.5.md
- [ ] Other: ___

## CI/CD Verified
- [ ] docker-e2e.yml paths match design
- [ ] docker-e2e.sh paths match design
- [ ] Tests pass locally

## Breaking Changes
[List any breaking changes or migration steps]
```

---

*This checklist ensures consistency between code, documentation, and CI/CD pipelines.*
