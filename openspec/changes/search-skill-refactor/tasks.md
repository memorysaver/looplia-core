# Tasks: Remove Core Search Skill

## 1. Remove Search Skill from looplia-core

- [x] 1.1 Delete `plugins/looplia-core/skills/search/SKILL.md`
- [x] 1.2 Verify no other files in `plugins/looplia-core/skills/search/` directory
- [x] 1.3 Remove the `search/` directory entirely

## 2. Verify No Breaking Dependencies

- [x] 2.1 Grep codebase for references to `search` skill name
- [x] 2.2 Update skill examples in workflow-executor/SKILL.md to use `web-search`
- [x] 2.3 Update skill examples in workflow-schema-composer/SKILL.md to use `web-search`

## 3. Update Documentation (if needed)

- [x] 3.1 Check AGENTS.md for search skill references (none found in critical paths)
- [x] 3.2 Check .claude/CLAUDE.md for search skill references (none found in critical paths)
- [x] 3.3 Historical docs (DESIGN-0.6.3.md, CHANGELOG.md) left as-is for accuracy

## 4. Create browser-research Skill in looplia-skills (External Repo)

> Note: These tasks are performed in `/Users/memorysaver/Documents/github/looplia-skills`

- [x] 4.1 Create `skills/search-and-research/browser-research/SKILL.md`
- [x] 4.2 Update `.claude-plugin/marketplace.json` to include browser-research
- [x] 4.3 Verify skill structure follows existing patterns (web-search, rss-reader)

## 5. Validation

- [x] 5.1 Run `openspec validate search-skill-refactor --strict --no-interactive`
- [x] 5.2 Test registry sync picks up skills from looplia-skills
- [x] 5.3 Ensure looplia-core build passes with search skill removed
