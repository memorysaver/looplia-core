# Tasks: Add Claude Code Subscription Presets

## Implementation Tasks

- [x] **1. Extend type definitions**
  - Add `AuthTokenSource` type (`"keychain"`)
  - Add `authTokenSource` field to `PresetDefinition`
  - Add `authTokenSource` field to `LoopliaSettings.apiProvider`
  - Add `authTokenSource` field to `SettingsDisplayInfo`

- [x] **2. Add new subscription presets**
  - Add `CLAUDE_CODE_SUBSCRIPTION_HAIKU` preset
  - Add `CLAUDE_CODE_SUBSCRIPTION_SONNET` preset
  - Add `CLAUDE_CODE_SUBSCRIPTION_OPUS` preset
  - All presets use `authTokenSource: "keychain"`

- [x] **3. Implement keychain reading**
  - Add `readKeychainToken()` function
  - Use macOS `security find-generic-password` command
  - Handle non-macOS platforms gracefully
  - Handle missing/locked keychain gracefully

- [x] **4. Update preset application logic**
  - Update `applyPreset()` to include `authTokenSource`
  - Preserve `authTokenSource` in settings file

- [x] **5. Update environment injection**
  - Update `injectLoopliaSettingsEnv()` for keychain auth
  - Set `CLAUDE_CODE_OAUTH_TOKEN` when `authTokenSource === "keychain"`
  - Log warnings for non-macOS or missing credentials
  - Refactor to reduce cyclomatic complexity

- [x] **6. Update display functions**
  - Update `getSettingsDisplayInfo()` to return `authTokenSource`
  - Export `AuthTokenSource` type from index

- [x] **7. Update CLI**
  - Add new presets to `printProviderHelp()` help text
  - Update `showProviderConfig()` to display "Auth Source: macOS Keychain"

- [x] **8. Update tests**
  - Update preset count test (16 → 19)

## Validation

- [x] Type check passes (`bun run check-types`)
- [x] Linter passes (`bun x ultracite check`)
- [x] All tests pass (`bun test` - 524/524)

## Files Modified

| File | Changes |
|------|---------|
| `packages/provider/src/claude-agent-sdk/model-provider.ts` | Types, presets, functions |
| `packages/provider/src/claude-agent-sdk/index.ts` | Exports |
| `apps/cli/src/commands/config.ts` | Help text, display |
| `packages/provider/test/claude-agent-sdk/model-provider.test.ts` | Preset count |
