## 1. Plugin Directory Reorganization

- [ ] 1.1 Modify `copyPlugins()` in `packages/provider/src/bootstrap/index.ts` to install first-party plugins to `~/.looplia/plugins/` instead of root
- [ ] 1.2 Update `extractWorkflows()` to work with new plugins directory path
- [ ] 1.3 Simplify `getProdPluginPaths()` to scan only `~/.looplia/plugins/` directory
- [ ] 1.4 Remove root-level scanning logic (looplia-core, looplia-writer at root)

## 2. Migration Support

- [ ] 2.1 Add `migratePluginStructure()` function to `apps/cli/src/commands/init.ts`
- [ ] 2.2 Implement detection of legacy structure (first-party at root)
- [ ] 2.3 Implement move of looplia-core and looplia-writer to plugins/
- [ ] 2.4 Add migration logging ("Migrating plugin structure to v0.8.0...")
- [ ] 2.5 Call migration function at start of init command

## 3. Auto-Discovery Plugin Module

- [ ] 3.1 Create `packages/provider/src/discovery/auto-discovery-plugin.ts`
- [ ] 3.2 Implement `getAutoDiscoveryPluginPath()` function
- [ ] 3.3 Implement `ensureAutoDiscoveryPlugin()` to create plugin structure (.claude-plugin/plugin.json, skills/)
- [ ] 3.4 Implement `installSkillToAutoDiscovery()` to write SKILL.md to plugin
- [ ] 3.5 Export functions from `packages/provider/src/discovery/index.ts`

## 4. Skills Search Service

- [ ] 4.1 Create `packages/provider/src/discovery/skills-search.ts`
- [ ] 4.2 Implement `searchSkills()` using `npx skills find` command
- [ ] 4.3 Implement `parseSkillsOutput()` to parse CLI output format
- [ ] 4.4 Implement `fetchSkillContent()` to fetch SKILL.md from GitHub raw URL
- [ ] 4.5 Add 30-second timeout for CLI execution
- [ ] 4.6 Add graceful fallback when CLI fails

## 5. Build Command Integration

- [ ] 5.1 Add `skipResearch` to `BuildArgs` type in `apps/cli/src/commands/build.ts`
- [ ] 5.2 Add `--skip-research` and `--offline` CLI flags
- [ ] 5.3 Implement `researchAndInstallSkills()` function
- [ ] 5.4 Add skill research phase before workflow generation (before compileRegistry)
- [ ] 5.5 Implement `promptSkillSelection()` for interactive mode
- [ ] 5.6 Add auto-selection of top 3 skills for batch mode

## 6. Registry Compiler Updates

- [ ] 6.1 Update `packages/provider/src/registry/compiler.ts` to scan unified plugins/ path
- [ ] 6.2 Ensure auto-discovery-plugin skills are included in compilation
- [ ] 6.3 Update any hardcoded paths that reference old structure

## 7. Testing

- [ ] 7.1 Test fresh install: `looplia init` creates plugins/ with looplia-core, looplia-writer
- [ ] 7.2 Test migration: init with old structure migrates to new structure
- [ ] 7.3 Test build with skill research: discovered skills installed to auto-discovery-plugin
- [ ] 7.4 Test `--skip-research` flag skips discovery phase
- [ ] 7.5 Test run command loads skills from auto-discovery-plugin
- [ ] 7.6 Test offline fallback when npx skills fails

## 8. Documentation and Version Bump

- [ ] 8.1 Update CHANGELOG.md with v0.8.0 changes
- [ ] 8.2 Bump version to 0.8.0 in all package.json files
- [ ] 8.3 Update any README references to plugin structure
