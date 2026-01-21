# Spec Delta: Model Provider - OpenRouter and Ollama

## Why

Extend looplia's model provider support to include OpenRouter and Ollama, providing users with:
- **OpenRouter**: Unified API for accessing multiple LLM providers with centralized billing and preset management
- **Ollama**: Local LLM execution for privacy, cost savings, and cloud model support

This change follows the established ZenMux pattern, adding provider types, presets, and environment variable auto-mapping while maintaining full backward compatibility.

## ADDED Requirements

### Requirement: OpenRouter Provider Type

The system SHALL support OpenRouter as a first-class provider type.

#### Scenario: OpenRouter provider type validation
- **GIVEN** a user configures a provider
- **WHEN** the provider type is set to `"openrouter"`
- **THEN** the configuration SHALL be valid
- **AND** the system SHALL recognize it as a supported provider type

### Requirement: Ollama Provider Type

The system SHALL support Ollama as a first-class provider type.

#### Scenario: Ollama provider type validation
- **GIVEN** a user configures a provider
- **WHEN** the provider type is set to `"ollama"`
- **THEN** the configuration SHALL be valid
- **AND** the system SHALL recognize it as a supported provider type

### Requirement: OpenRouter Preset

The system SHALL provide a preset for OpenRouter integration.

#### Scenario: OPENROUTER_PRESET configuration
- **GIVEN** user applies preset `OPENROUTER_PRESET`
- **THEN** the settings SHALL have:
  - `apiProvider.type` = `"openrouter"`
  - `apiProvider.baseUrl` = `"https://openrouter.ai/api"`
  - All model fields set to `"@preset/looplia-default"`

#### Scenario: OpenRouter uses dashboard-configured presets
- **GIVEN** user has created a preset named "looplia-default" in OpenRouter dashboard
- **WHEN** looplia makes API calls with model `"@preset/looplia-default"`
- **THEN** OpenRouter SHALL apply the dashboard-configured settings
- **AND** looplia SHALL not override model selection

### Requirement: Ollama Cloud Model Presets

The system SHALL provide presets for popular Ollama cloud models.

#### Scenario: OLLAMA_GLM47_CLOUD preset
- **GIVEN** user applies preset `OLLAMA_GLM47_CLOUD`
- **THEN** the settings SHALL have:
  - `apiProvider.type` = `"ollama"`
  - `apiProvider.baseUrl` = `"http://localhost:11434"`
  - All model fields set to `"glm-4.7:cloud"`

#### Scenario: OLLAMA_MINIMAX_M21_CLOUD preset
- **GIVEN** user applies preset `OLLAMA_MINIMAX_M21_CLOUD`
- **THEN** the settings SHALL have:
  - `apiProvider.type` = `"ollama"`
  - `apiProvider.baseUrl` = `"http://localhost:11434"`
  - All model fields set to `"minimax-m2.1:cloud"`

### Requirement: OpenRouter API Key Mapping

The system SHALL auto-map `OPENROUTER_API_KEY` environment variable to `ANTHROPIC_API_KEY`.

#### Scenario: OpenRouter API key from environment
- **GIVEN** `OPENROUTER_API_KEY` is set in environment
- **AND** the active provider type is `"openrouter"`
- **AND** no `authToken` is configured in settings
- **WHEN** the system injects environment variables
- **THEN** `ANTHROPIC_API_KEY` SHALL be set to the value of `OPENROUTER_API_KEY`

#### Scenario: Settings authToken takes priority over OPENROUTER_API_KEY
- **GIVEN** `OPENROUTER_API_KEY` is set in environment
- **AND** the active provider has `authToken` configured
- **WHEN** the system injects environment variables
- **THEN** `ANTHROPIC_API_KEY` SHALL be set to the configured `authToken`
- **AND** `OPENROUTER_API_KEY` SHALL be ignored

#### Scenario: OpenRouter base URL detection
- **GIVEN** the configured `baseUrl` contains "openrouter.ai"
- **AND** `OPENROUTER_API_KEY` is set in environment
- **WHEN** the system injects environment variables
- **THEN** `ANTHROPIC_AUTH_TOKEN` SHALL be set to the value of `OPENROUTER_API_KEY`
- **AND** `ANTHROPIC_BASE_URL` SHALL be set to the configured `baseUrl`

### Requirement: Ollama API Key Handling

The system SHALL support Ollama's authentication pattern with fallback default.

#### Scenario: Ollama with custom API key
- **GIVEN** `OLLAMA_API_KEY` is set in environment
- **AND** the active provider type is `"ollama"`
- **AND** no `authToken` is configured in settings
- **WHEN** the system injects environment variables
- **THEN** `ANTHROPIC_API_KEY` SHALL be set to the value of `OLLAMA_API_KEY`

#### Scenario: Ollama with default authentication
- **GIVEN** `OLLAMA_API_KEY` is NOT set in environment
- **AND** the active provider type is `"ollama"`
- **AND** no `authToken` is configured in settings
- **WHEN** the system injects environment variables
- **THEN** `ANTHROPIC_API_KEY` SHALL be set to the literal string `"ollama"`

#### Scenario: Ollama settings authToken priority
- **GIVEN** the active provider has `authToken` configured
- **AND** `OLLAMA_API_KEY` is set in environment
- **WHEN** the system injects environment variables
- **THEN** `ANTHROPIC_API_KEY` SHALL be set to the configured `authToken`
- **AND** `OLLAMA_API_KEY` SHALL be ignored
- **AND** the `"ollama"` default SHALL not be applied

#### Scenario: Ollama base URL detection
- **GIVEN** the configured `baseUrl` contains "localhost:11434"
- **AND** no `authToken` is configured
- **WHEN** the system injects environment variables
- **THEN** `ANTHROPIC_API_KEY` SHALL default to `"ollama"` if `OLLAMA_API_KEY` not set
- **AND** `ANTHROPIC_BASE_URL` SHALL be set to the configured `baseUrl`

### Requirement: CLI Help Text for New Presets

The CLI help text SHALL include the new OpenRouter and Ollama presets.

#### Scenario: Provider preset list includes OpenRouter
- **GIVEN** user runs `looplia config provider --help`
- **THEN** the output SHALL include `OPENROUTER_PRESET` in the available presets list

#### Scenario: Provider preset list includes Ollama presets
- **GIVEN** user runs `looplia config provider --help`
- **THEN** the output SHALL include:
  - `OLLAMA_GLM47_CLOUD`
  - `OLLAMA_MINIMAX_M21_CLOUD`

#### Scenario: API keys documentation includes new providers
- **GIVEN** user runs `looplia config provider --help`
- **THEN** the output SHALL document:
  - `OPENROUTER_API_KEY` - For OpenRouter (auto-mapped to ANTHROPIC_AUTH_TOKEN)
  - `OLLAMA_API_KEY` - For Ollama (optional, defaults to "ollama")

#### Scenario: Provider type list includes new providers
- **GIVEN** user runs `looplia config provider --help`
- **THEN** the "api-provider" configuration key SHALL list:
  - `openrouter` as a valid provider type
  - `ollama` as a valid provider type

### Requirement: Documentation Updates

The system documentation SHALL include configuration examples for new providers.

#### Scenario: README environment variables include new providers
- **GIVEN** the README.md file
- **THEN** the Environment Variables section SHALL document:
  - `OPENROUTER_API_KEY` with description
  - `OLLAMA_API_KEY` with description and default behavior

#### Scenario: .env.example includes new providers
- **GIVEN** the .env.example file
- **THEN** it SHALL include commented examples for:
  - `OPENROUTER_API_KEY`
  - `OLLAMA_API_KEY`

### Requirement: Landing Page Provider Showcase

The documentation landing page SHALL present providers in priority order.

#### Scenario: Multi-provider tabs with correct ordering
- **GIVEN** the landing page at `apps/docs/src/content/docs/index.mdx`
- **WHEN** displaying the "Multi-Provider Support" section
- **THEN** the tabs SHALL appear in this order:
  1. "Anthropic Official" (Direct API)
  2. "Ollama Local" (Local models)
  3. "OpenRouter" (Multi-provider)
  4. "ZenMux Proxy" (Proxy provider)

#### Scenario: Ollama tab content
- **GIVEN** the "Ollama Local" tab
- **THEN** it SHALL show example using `OLLAMA_GLM47_CLOUD` preset
- **AND** include commands for applying preset and running workflow

#### Scenario: OpenRouter tab content
- **GIVEN** the "OpenRouter" tab
- **THEN** it SHALL show example using `OPENROUTER_PRESET`
- **AND** include explanation of dashboard-configured presets
- **AND** include commands for applying preset and setting API key

### Requirement: Config Command Documentation

The CLI config command documentation SHALL include new presets and providers.

#### Scenario: apps/docs config.mdx preset tables
- **GIVEN** the file `apps/docs/src/content/docs/cli/config.mdx`
- **WHEN** displaying available presets
- **THEN** it SHALL include tabs with this order:
  1. "Anthropic Direct"
  2. "Ollama"
  3. "OpenRouter"
  4. "ZenMux Proxy"

#### Scenario: Ollama preset table
- **GIVEN** the "Ollama" tab in config.mdx
- **THEN** it SHALL include a table with:
  - `OLLAMA_GLM47_CLOUD` preset
  - `OLLAMA_MINIMAX_M21_CLOUD` preset
  - Model names and descriptions

#### Scenario: OpenRouter preset table
- **GIVEN** the "OpenRouter" tab in config.mdx
- **THEN** it SHALL include:
  - `OPENROUTER_PRESET` preset
  - Explanation of dashboard configuration
  - Reference to OpenRouter dashboard URL

### Requirement: Environment Variables Reference Documentation

The environment variables reference SHALL document new providers comprehensively.

#### Scenario: API keys table includes new providers
- **GIVEN** `apps/docs/src/content/docs/reference/environment-variables.mdx`
- **WHEN** displaying API Keys section
- **THEN** the table SHALL include:
  - `OPENROUTER_API_KEY` with description
  - `OLLAMA_API_KEY` with description and default behavior

#### Scenario: Provider configuration section includes new mappings
- **GIVEN** the "Provider Configuration" section in environment-variables.mdx
- **THEN** it SHALL document:
  - OpenRouter auto-mapping (`OPENROUTER_API_KEY` → `ANTHROPIC_AUTH_TOKEN`)
  - Ollama authentication pattern (defaults to `"ollama"` literal)

#### Scenario: Priority order updated for new providers
- **GIVEN** the "Priority Order" section in environment-variables.mdx
- **THEN** the API Keys priority list SHALL include:
  - `OPENROUTER_API_KEY` for OpenRouter endpoints
  - `OLLAMA_API_KEY` for Ollama endpoints (with default fallback noted)

### Requirement: ApiProviderType

The `ApiProviderType` SHALL include OpenRouter and Ollama as valid provider types.

#### Scenario: Extended provider type union
- **GIVEN** the `ApiProviderType` type definition
- **THEN** it SHALL be defined as: `"anthropic" | "zenmux" | "openrouter" | "ollama" | "custom"`

### Requirement: Available Presets Count

The system SHALL provide 22 total presets.

#### Scenario: Preset list completeness
- **GIVEN** the PRESETS constant
- **THEN** it SHALL contain exactly 22 preset definitions
- **AND** include all Anthropic, Claude Code Subscription, ZenMux, OpenRouter, and Ollama presets

### Requirement: Provider-Specific Environment Variable Mapping

The environment variable injection SHALL support mapping for all provider types.

#### Scenario: Multi-provider environment variable priority
- **GIVEN** the system injects environment variables
- **THEN** the mapping SHALL follow this priority:
  1. Subscription auth (`CLAUDE_CODE_OAUTH_TOKEN`)
  2. Settings file `authToken`
  3. Provider-specific env var (`ZENMUX_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_API_KEY`)
  4. Default (for Ollama: `"ollama"` literal)
  5. Generic `ANTHROPIC_API_KEY`

#### Scenario: Provider type detection includes new providers
- **GIVEN** the environment injection logic
- **WHEN** detecting provider type for auto-mapping
- **THEN** the system SHALL check:
  - `apiProvider.type === "openrouter"` OR `baseUrl` contains "openrouter.ai"
  - `apiProvider.type === "ollama"` OR `baseUrl` contains "localhost:11434"
- **AND** apply appropriate environment variable mapping
