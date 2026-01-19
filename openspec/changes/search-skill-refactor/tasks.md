# Tasks: Remove Core Search Skill

## 1. Remove Search Skill from looplia-core

- [ ] 1.1 Delete `plugins/looplia-core/skills/search/SKILL.md`
- [ ] 1.2 Verify no other files in `plugins/looplia-core/skills/search/` directory
- [ ] 1.3 Remove the `search/` directory entirely

## 2. Verify No Breaking Dependencies

- [ ] 2.1 Grep codebase for references to `search` skill name
- [ ] 2.2 Confirm `build` command works without search skill
- [ ] 2.3 Confirm `run` command works without search skill

## 3. Update Documentation (if needed)

- [ ] 3.1 Check AGENTS.md for search skill references
- [ ] 3.2 Check .claude/CLAUDE.md for search skill references
- [ ] 3.3 Update any documentation mentioning the search skill

## 4. Create browser-research Skill in looplia-skills (External Repo)

> Note: These tasks are performed in `/Users/memorysaver/Documents/github/looplia-skills`

- [ ] 4.1 Create `skills/search-and-research/browser-research/SKILL.md`
- [ ] 4.2 Update `.claude-plugin/marketplace.json` to include browser-research
- [ ] 4.3 Verify skill structure follows existing patterns (web-search, rss-reader)

## 5. Validation

- [ ] 5.1 Run `openspec validate remove-core-search-skill --strict --no-interactive`
- [ ] 5.2 Test registry sync picks up skills from looplia-skills
- [ ] 5.3 Ensure looplia-core build passes with search skill removed
