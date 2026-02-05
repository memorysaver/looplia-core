## 1. Plugin Directory Reorganization

- [x] 1.1 Modify `copyPlugins()` in `packages/provider/src/bootstrap/index.ts` to install first-party plugins to `~/.looplia/plugins/` instead of root
- [x] 1.2 Update `extractWorkflows()` to work with new plugins directory path
- [x] 1.3 Simplify `getProdPluginPaths()` to scan only `~/.looplia/plugins/` directory
- [x] 1.4 Remove root-level scanning logic (looplia-core, looplia-writer at root)

## 2. Migration Support

**REMOVED** - No backward compatibility needed. Users should run `looplia init --force` to upgrade.

## 3. Auto-Discovery Plugin Module

- [x] 3.1 Create `packages/provider/src/discovery/auto-discovery-plugin.ts`
- [x] 3.2 Implement `getAutoDiscoveryPluginPath()` function
- [x] 3.3 Implement `ensureAutoDiscoveryPlugin()` to create plugin structure (.claude-plugin/plugin.json, skills/)
- [x] 3.4 Implement `installSkillToAutoDiscovery()` to write SKILL.md to plugin
- [x] 3.5 Export functions from `packages/provider/src/discovery/index.ts`

## 4. Skills Search Service

- [x] 4.1 Create `packages/provider/src/discovery/skills-search.ts`
- [x] 4.2 Implement `searchSkills()` using `npx skills find` command
- [x] 4.3 Implement `parseSkillsOutput()` to parse CLI output format
- [x] 4.4 Implement `fetchSkillContent()` to fetch SKILL.md from GitHub raw URL
- [x] 4.5 Add 30-second timeout for CLI execution
- [x] 4.6 Add graceful fallback when CLI fails

## 5. Build Command Integration

- [x] 5.1 Add `skipResearch` to `BuildArgs` type in `apps/cli/src/commands/build.ts`
- [x] 5.2 Add `--skip-research` and `--offline` CLI flags
- [x] 5.3 Implement `researchAndInstallSkills()` function
- [x] 5.4 Add skill research phase before workflow generation (before compileRegistry)
- [x] 5.5 Implement `promptSkillSelection()` for interactive mode
- [x] 5.6 Add auto-selection of top 3 skills for batch mode

## 6. Registry Compiler Updates

- [x] 6.1 Update `packages/provider/src/registry/compiler.ts` to scan unified plugins/ path
- [x] 6.2 Ensure auto-discovery-plugin skills are included in compilation
- [x] 6.3 Update any hardcoded paths that reference old structure

## 7. Testing

- [x] 7.1 Test fresh install: `looplia init` creates plugins/ with looplia-core, looplia-writer
- [x] 7.2 ~~Test migration~~ (removed - no backward compatibility)
- [x] 7.3 Test build with skill research: discovered skills installed to auto-discovery-plugin
- [x] 7.4 Test `--skip-research` flag skips discovery phase
- [x] 7.5 Test run command loads skills from auto-discovery-plugin
- [x] 7.6 Test offline fallback when npx skills fails (implemented with try/catch)

## 8. Documentation and Version Bump

- [x] 8.1 Update CHANGELOG.md with v0.8.0 changes
- [x] 8.2 Bump version to 0.8.0 in all package.json files
- [x] 8.3 Update any README references to plugin structure
