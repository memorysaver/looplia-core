## 1. Update CLI Skill Command

- [x] 1.1 Add import for discovery module functions (`searchSkills`, `fetchSkillContent`, `installSkillToAutoDiscovery`, `SkillSearchResult`) from `@looplia-core/provider/discovery`
- [x] 1.2 Update `printHelp()` to include `search <query>` subcommand in help text
- [x] 1.3 Implement `skillSearch(query: string)` function with search, display, and install logic
- [x] 1.4 Add `search` case to `runSkillCommand()` switch statement

## 2. Testing

- [x] 2.1 Run type checking: `bun run check-types`
- [x] 2.2 Run test suite: `bun test`
- [x] 2.3 Manual test: `looplia skill search "pdf"` - verify results display
- [x] 2.4 Manual test: Interactive installation flow in TTY mode (verified code path, non-TTY shows correct message)
