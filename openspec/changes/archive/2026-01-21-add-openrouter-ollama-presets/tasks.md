# Implementation Tasks: Add OpenRouter and Ollama Provider Presets

## Overview

Implement OpenRouter and Ollama provider support following the existing ZenMux pattern. All tasks should be completed sequentially to maintain consistency.

## Tasks

### Phase 1: Type System and Core Configuration

- [ ] **Update ApiProviderType**
  - File: `packages/provider/src/claude-agent-sdk/model-provider.ts:25`
  - Change type to: `"anthropic" | "zenmux" | "openrouter" | "ollama" | "custom"`
  - Verify: TypeScript compilation passes

- [ ] **Add OPENROUTER_PRESET definition**
  - File: `packages/provider/src/claude-agent-sdk/model-provider.ts` (after line 331)
  - Add preset with:
    - `apiProvider: "openrouter"`
    - `baseUrl: "https://openrouter.ai/api"`
    - All model fields: `"@preset/looplia-default"`
  - Verify: PRESETS object type-checks correctly

- [ ] **Add OLLAMA_GLM47_CLOUD preset**
  - File: `packages/provider/src/claude-agent-sdk/model-provider.ts` (after OpenRouter preset)
  - Add preset with:
    - `apiProvider: "ollama"`
    - `baseUrl: "http://localhost:11434"`
    - All model fields: `"glm-4.7:cloud"`
  - Verify: PRESETS object type-checks correctly

- [ ] **Add OLLAMA_MINIMAX_M21_CLOUD preset**
  - File: `packages/provider/src/claude-agent-sdk/model-provider.ts` (after GLM47 preset)
  - Add preset with:
    - `apiProvider: "ollama"`
    - `baseUrl: "http://localhost:11434"`
    - All model fields: `"minimax-m2.1:cloud"`
  - Verify: PRESETS object type-checks correctly

### Phase 2: Environment Variable Injection

- [ ] **Update injectNonAnthropicProviderEnv() function**
  - File: `packages/provider/src/claude-agent-sdk/model-provider.ts:453-478`
  - Add OpenRouter detection:
    - Check `apiProvider.type === "openrouter"` OR `baseUrl.includes("openrouter.ai")`
    - Map `OPENROUTER_API_KEY` → `ANTHROPIC_AUTH_TOKEN`
  - Add Ollama detection:
    - Check `apiProvider.type === "ollama"` OR `baseUrl.includes("localhost:11434")`
    - Use `OLLAMA_API_KEY` if set, else default to `"ollama"` literal
  - Update function JSDoc comment
  - Verify: Logic handles all provider types correctly

- [ ] **Update injectLoopliaSettingsEnv() JSDoc**
  - File: `packages/provider/src/claude-agent-sdk/model-provider.ts:481-497`
  - Document new provider API patterns:
    - OpenRouter: Uses `OPENROUTER_API_KEY`, `baseUrl="https://openrouter.ai/api"`
    - Ollama: Uses `"ollama"` or `OLLAMA_API_KEY`, `baseUrl="http://localhost:11434"`
  - Update priority list to include new env vars
  - Verify: Documentation is complete and accurate

### Phase 3: CLI Interface Updates

- [ ] **Update printProviderHelp() preset list**
  - File: `apps/cli/src/commands/config.ts:57-100`
  - Add to preset list:
    - `OPENROUTER_PRESET                OpenRouter (user-configured preset)`
    - `OLLAMA_GLM47_CLOUD               Ollama GLM-4.7 Cloud`
    - `OLLAMA_MINIMAX_M21_CLOUD         Ollama MiniMax-M2.1 Cloud`
  - Verify: Help text displays correctly with `looplia config provider --help`

- [ ] **Update provider type documentation in help**
  - File: `apps/cli/src/commands/config.ts:86`
  - Change to: `api-provider     Provider type: anthropic, zenmux, openrouter, ollama, custom`
  - Verify: Help text shows all provider types

- [ ] **Update API keys documentation in help**
  - File: `apps/cli/src/commands/config.ts:92-95`
  - Add:
    - `OPENROUTER_API_KEY  For OpenRouter (auto-mapped to ANTHROPIC_AUTH_TOKEN)`
    - `OLLAMA_API_KEY      For Ollama (optional, defaults to "ollama")`
  - Verify: Help text documents all env vars

- [ ] **Add preset usage examples**
  - File: `apps/cli/src/commands/config.ts:97-99`
  - Add examples:
    - `looplia config provider preset OPENROUTER_PRESET`
    - `looplia config provider preset OLLAMA_GLM47_CLOUD`
  - Verify: Examples are clear and accurate

- [ ] **Update setProviderValue() validation**
  - File: `apps/cli/src/commands/config.ts:280`
  - Add validation for new provider types in switch statement
  - Verify: Invalid provider types are rejected with clear error message

### Phase 4: Documentation

#### README.md and .env.example

- [ ] **Update README.md environment variables**
  - File: `README.md:276-286`
  - Add rows to table:
    - `OPENROUTER_API_KEY | OpenRouter API key (auto-mapped to ANTHROPIC_AUTH_TOKEN)`
    - `OLLAMA_API_KEY | Ollama API key (optional, defaults to "ollama")`
  - Verify: Table formatting is correct

- [ ] **Update .env.example**
  - File: `.env.example:1-11`
  - Add commented examples:
    ```bash
    # For OpenRouter (auto-mapped to ANTHROPIC_AUTH_TOKEN when preset is OPENROUTER_*):
    # OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key-here
    #
    # For Ollama (auto-mapped to ANTHROPIC_API_KEY, defaults to "ollama" if not set):
    # OLLAMA_API_KEY=ollama
    ```
  - Verify: Format matches existing examples

#### Landing Page (apps/docs/src/content/docs/index.mdx)

- [ ] **Update Multi-Provider Support section tabs**
  - File: `apps/docs/src/content/docs/index.mdx:799-813`
  - Reorder tabs to: Anthropic Official, Ollama Local, OpenRouter, ZenMux Proxy
  - Rename "Anthropic Direct" → "Anthropic Official"
  - Rename "ZenMux Proxy" → "ZenMux Proxy" (keep as-is)
  - Verify: Tab order matches specification

- [ ] **Add Ollama Local tab**
  - File: `apps/docs/src/content/docs/index.mdx` (insert after Anthropic Official tab)
  - Content:
    ```mdx
    <TabItem label="Ollama Local">
    ```bash
    # Run GLM-4.7 cloud model locally
    looplia config provider preset OLLAMA_GLM47_CLOUD
    export OLLAMA_API_KEY=ollama  # Optional, defaults to "ollama"
    looplia run writing-kit --file article.md
    ```
    </TabItem>
    ```
  - Verify: Code example renders correctly

- [ ] **Add OpenRouter tab**
  - File: `apps/docs/src/content/docs/index.mdx` (insert after Ollama tab)
  - Content:
    ```mdx
    <TabItem label="OpenRouter">
    ```bash
    # Use OpenRouter with dashboard-configured preset
    looplia config provider preset OPENROUTER_PRESET
    export OPENROUTER_API_KEY=sk-or-v1-...
    looplia run writing-kit --file article.md
    # Models configured at: https://openrouter.ai/settings/presets
    ```
    </TabItem>
    ```
  - Verify: URL and explanation are clear

- [ ] **Update CardGrid count text**
  - File: `apps/docs/src/content/docs/index.mdx:816`
  - Change "16+ Model Presets" → "22+ Model Presets"
  - Update description to mention OpenRouter and Ollama
  - Verify: Text accurately reflects new total

#### CLI Config Documentation (apps/docs/src/content/docs/cli/config.mdx)

- [ ] **Reorder preset tabs**
  - File: `apps/docs/src/content/docs/cli/config.mdx:106-124`
  - Reorder to: Anthropic Direct, Ollama, OpenRouter, ZenMux Proxy
  - Keep "Anthropic Direct" tab as-is
  - Verify: Tab order matches specification

- [ ] **Add Ollama tab with preset table**
  - File: `apps/docs/src/content/docs/cli/config.mdx` (insert after Anthropic Direct)
  - Content:
    ```mdx
    <TabItem label="Ollama">
    | Preset | Model | Description |
    |--------|-------|-------------|
    | `OLLAMA_GLM47_CLOUD` | glm-4.7:cloud | GLM-4.7 cloud model |
    | `OLLAMA_MINIMAX_M21_CLOUD` | minimax-m2.1:cloud | MiniMax-M2.1 cloud |
    </TabItem>
    ```
  - Verify: Table renders with correct formatting

- [ ] **Add OpenRouter tab with preset info**
  - File: `apps/docs/src/content/docs/cli/config.mdx` (insert after Ollama)
  - Content:
    ```mdx
    <TabItem label="OpenRouter">
    | Preset | Model | Description |
    |--------|-------|-------------|
    | `OPENROUTER_PRESET` | @preset/looplia-default | User-configured preset |

    Configure models in your [OpenRouter dashboard](https://openrouter.ai/settings/presets).
    Create a preset named "looplia-default" with your preferred model settings.
    </TabItem>
    ```
  - Verify: Link to OpenRouter works correctly

- [ ] **Update provider type list in config.mdx**
  - File: `apps/docs/src/content/docs/cli/config.mdx:147`
  - Update to: `anthropic`, `zenmux`, `openrouter`, `ollama`, `custom`
  - Verify: All provider types listed

#### Environment Variables Reference (apps/docs/src/content/docs/reference/environment-variables.mdx)

- [ ] **Add OPENROUTER_API_KEY to API Keys table**
  - File: `apps/docs/src/content/docs/reference/environment-variables.mdx:10-20`
  - Add row:
    ```markdown
    | `OPENROUTER_API_KEY` | OpenRouter API key | Yes* |
    ```
  - Update aside note to include OpenRouter
  - Verify: Table formatting correct

- [ ] **Add OLLAMA_API_KEY to API Keys table**
  - File: `apps/docs/src/content/docs/reference/environment-variables.mdx:10-20`
  - Add row:
    ```markdown
    | `OLLAMA_API_KEY` | Ollama API key (defaults to "ollama") | No |
    ```
  - Verify: Table formatting correct

- [ ] **Add OpenRouter to Provider Configuration section**
  - File: `apps/docs/src/content/docs/reference/environment-variables.mdx:170-193`
  - Add to auto-mapping explanation:
    - `OPENROUTER_API_KEY` for OpenRouter endpoints
    - Include code example similar to ZenMux pattern
  - Verify: Example code renders correctly

- [ ] **Add Ollama to Provider Configuration section**
  - File: `apps/docs/src/content/docs/reference/environment-variables.mdx:170-193`
  - Add Ollama authentication explanation:
    - Defaults to `"ollama"` literal when `OLLAMA_API_KEY` not set
    - Include code example showing both scenarios
  - Verify: Default behavior clearly explained

- [ ] **Update Priority Order section**
  - File: `apps/docs/src/content/docs/reference/environment-variables.mdx:194-214`
  - Update API Keys priority list to include:
    - `OPENROUTER_API_KEY` for OpenRouter
    - `OLLAMA_API_KEY` for Ollama (with note about `"ollama"` default)
  - Verify: Priority order is clear and accurate

- [ ] **Update All Variables Reference table**
  - File: `apps/docs/src/content/docs/reference/environment-variables.mdx:263-280`
  - Add rows for:
    - `OPENROUTER_API_KEY | string | OpenRouter API key`
    - `OLLAMA_API_KEY | string | Ollama API key (optional, defaults to "ollama")`
  - Verify: Table complete and sorted logically

### Phase 5: Test Coverage

- [ ] **Update preset count test**
  - File: `packages/provider/test/claude-agent-sdk/model-provider.test.ts:37`
  - Change to: `expect(Object.keys(PRESETS)).toHaveLength(22);`
  - Run: `bun test packages/provider/test/claude-agent-sdk/model-provider.test.ts`
  - Verify: Test passes

- [ ] **Add OpenRouter preset configuration tests**
  - File: `packages/provider/test/claude-agent-sdk/model-provider.test.ts` (after line 102)
  - Test `OPENROUTER_PRESET` has correct `apiProvider`, `baseUrl`, and `mainModel`
  - Run: `bun test packages/provider/test/claude-agent-sdk/model-provider.test.ts`
  - Verify: All preset tests pass

- [ ] **Add Ollama preset configuration tests**
  - File: `packages/provider/test/claude-agent-sdk/model-provider.test.ts` (after OpenRouter tests)
  - Test `OLLAMA_GLM47_CLOUD` configuration
  - Test `OLLAMA_MINIMAX_M21_CLOUD` configuration
  - Run: `bun test packages/provider/test/claude-agent-sdk/model-provider.test.ts`
  - Verify: All preset tests pass

- [ ] **Add OpenRouter environment injection tests**
  - File: `packages/provider/test/claude-agent-sdk/model-provider.test.ts` (after line 388)
  - Test `OPENROUTER_API_KEY` auto-mapping
  - Test `authToken` priority over `OPENROUTER_API_KEY`
  - Test base URL detection for OpenRouter
  - Run: `bun test packages/provider/test/claude-agent-sdk/model-provider.test.ts`
  - Verify: All environment injection tests pass

- [ ] **Add Ollama environment injection tests**
  - File: `packages/provider/test/claude-agent-sdk/model-provider.test.ts` (after OpenRouter tests)
  - Test `OLLAMA_API_KEY` mapping when set
  - Test default to `"ollama"` when `OLLAMA_API_KEY` not set
  - Test `authToken` priority over `OLLAMA_API_KEY`
  - Test base URL detection for Ollama
  - Run: `bun test packages/provider/test/claude-agent-sdk/model-provider.test.ts`
  - Verify: All environment injection tests pass

### Phase 6: Quality Checks

- [ ] **Run type checking**
  - Command: `bun run check-types`
  - Verify: No TypeScript errors

- [ ] **Run full test suite**
  - Command: `bun test`
  - Verify: All tests pass

- [ ] **Run code quality check**
  - Command: `bun x ultracite check`
  - Verify: No linting errors

- [ ] **Fix any code quality issues**
  - Command: `bun x ultracite fix`
  - Verify: All issues auto-fixed

### Phase 7: Manual Testing

- [ ] **Test OpenRouter preset application**
  - Command: `looplia config provider preset OPENROUTER_PRESET`
  - Command: `looplia config provider show`
  - Verify: Preset applies correctly, shows OpenRouter configuration

- [ ] **Test Ollama preset application**
  - Command: `looplia config provider preset OLLAMA_GLM47_CLOUD`
  - Command: `looplia config provider show`
  - Verify: Preset applies correctly, shows Ollama configuration

- [ ] **Test help text display**
  - Command: `looplia config provider --help`
  - Verify: All new presets listed, documentation complete

- [ ] **Test manual provider configuration**
  - Command: `looplia config provider set api-provider openrouter`
  - Command: `looplia config provider set api-provider ollama`
  - Verify: Both provider types accepted without errors

### Phase 8: Documentation and Finalization

- [ ] **Update CHANGELOG.md**
  - Add entry under `## [Unreleased]` section:
    ```markdown
    ### Added
    - OpenRouter provider support with `OPENROUTER_PRESET`
    - Ollama provider support with `OLLAMA_GLM47_CLOUD` and `OLLAMA_MINIMAX_M21_CLOUD` presets
    - Auto-mapping for `OPENROUTER_API_KEY` and `OLLAMA_API_KEY` environment variables
    ```
  - Verify: Entry follows changelog format

- [ ] **Validate OpenSpec change**
  - Command: `openspec validate add-openrouter-ollama-presets --strict --no-interactive`
  - Verify: No validation errors

- [ ] **Create feature branch and commit**
  - Branch: `feature/add-openrouter-ollama-presets`
  - Commit message: `feat: add OpenRouter and Ollama provider presets`
  - Include co-author: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`
  - Verify: All changes committed

## Dependencies

- **No blocking dependencies**: All tasks can proceed independently once type system is updated
- **Parallel work possible**: Phases 3 (CLI) and 4 (Docs) can be done in parallel after Phase 2
- **Test phase depends on**: All implementation phases complete

## Verification Checklist

After all tasks complete, verify:

- [ ] TypeScript compilation: `bun run check-types` passes
- [ ] All tests pass: `bun test` passes
- [ ] Code quality: `bun x ultracite check` passes
- [ ] Manual testing: All presets apply correctly
- [ ] OpenSpec validation: `openspec validate add-openrouter-ollama-presets --strict` passes
- [ ] Documentation complete: README, .env.example, help text all updated
- [ ] CHANGELOG updated
- [ ] Git branch created and all changes committed
