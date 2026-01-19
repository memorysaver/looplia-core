# Spec Delta: Model Provider - Claude Code Subscription

## ADDED Requirements

### Requirement: Keychain Auth Token Source

The system SHALL support reading OAuth tokens from macOS Keychain as an authentication source for Claude API access.

#### Scenario: Successful keychain token retrieval on macOS
- **GIVEN** the system is running on macOS
- **AND** Claude Code credentials exist in the Keychain
- **WHEN** a preset with `authTokenSource: "keychain"` is active
- **THEN** the system reads the OAuth token using `security find-generic-password -s "Claude Code-credentials" -w`
- **AND** sets `CLAUDE_CODE_OAUTH_TOKEN` environment variable

#### Scenario: Keychain unavailable on non-macOS platform
- **GIVEN** the system is NOT running on macOS
- **WHEN** a preset with `authTokenSource: "keychain"` is active
- **THEN** the system logs a warning: "Keychain auth only available on macOS. Set CLAUDE_CODE_OAUTH_TOKEN manually."
- **AND** continues without setting the OAuth token

#### Scenario: Claude Code credentials not found in keychain
- **GIVEN** the system is running on macOS
- **AND** Claude Code credentials do NOT exist in the Keychain
- **WHEN** a preset with `authTokenSource: "keychain"` is active
- **THEN** the system logs a warning about missing credentials
- **AND** continues without setting the OAuth token

### Requirement: Claude Code Subscription Presets

The system SHALL provide three presets for Claude Code subscription-based authentication.

#### Scenario: CLAUDE_CODE_SUBSCRIPTION_HAIKU preset
- **GIVEN** user applies preset `CLAUDE_CODE_SUBSCRIPTION_HAIKU`
- **THEN** the settings SHALL have:
  - `apiProvider.type` = `"anthropic"`
  - `apiProvider.authTokenSource` = `"keychain"`
  - All model fields set to `"claude-haiku-4-5-20251001"`

#### Scenario: CLAUDE_CODE_SUBSCRIPTION_SONNET preset
- **GIVEN** user applies preset `CLAUDE_CODE_SUBSCRIPTION_SONNET`
- **THEN** the settings SHALL have:
  - `apiProvider.type` = `"anthropic"`
  - `apiProvider.authTokenSource` = `"keychain"`
  - All model fields set to `"claude-sonnet-4-5-20250929"`

#### Scenario: CLAUDE_CODE_SUBSCRIPTION_OPUS preset
- **GIVEN** user applies preset `CLAUDE_CODE_SUBSCRIPTION_OPUS`
- **THEN** the settings SHALL have:
  - `apiProvider.type` = `"anthropic"`
  - `apiProvider.authTokenSource` = `"keychain"`
  - All model fields set to `"claude-opus-4-5-20251101"`

### Requirement: Auth Source Display

The CLI SHALL display the authentication source when showing provider configuration.

#### Scenario: Display keychain auth source
- **GIVEN** user runs `looplia config provider show`
- **AND** the active preset uses `authTokenSource: "keychain"`
- **THEN** the output SHALL include: `Auth Source: macOS Keychain (Claude Code)`

#### Scenario: Display token auth source
- **GIVEN** user runs `looplia config provider show`
- **AND** the active configuration has an `authToken` (not keychain)
- **THEN** the output SHALL display the masked token (last 4 chars)

## MODIFIED Requirements

### Requirement: PresetDefinition Type (Modified)

The `PresetDefinition` type SHALL include an optional `authTokenSource` field.

#### Scenario: Preset with authTokenSource
- **GIVEN** a preset definition
- **WHEN** `authTokenSource` is specified
- **THEN** the value SHALL be of type `AuthTokenSource` (`"keychain"`)
- **AND** the field is optional (undefined for API key-based presets)

### Requirement: LoopliaSettings Type (Modified)

The `LoopliaSettings.apiProvider` object SHALL include an optional `authTokenSource` field.

#### Scenario: Settings with keychain auth
- **GIVEN** a settings file at `~/.looplia/looplia.setting.json`
- **WHEN** `apiProvider.authTokenSource` is `"keychain"`
- **THEN** the system SHALL read credentials from macOS Keychain
- **AND** the `apiProvider.authToken` field MAY be undefined

### Requirement: Available Presets Count (Modified)

The system SHALL provide 19 total presets (previously 16).

#### Scenario: Preset list completeness
- **GIVEN** the PRESETS constant
- **THEN** it SHALL contain exactly 19 preset definitions
- **AND** include all Anthropic, Claude Code Subscription, and ZenMux presets
