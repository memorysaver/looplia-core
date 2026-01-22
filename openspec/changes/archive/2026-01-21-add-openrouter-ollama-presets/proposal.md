# Proposal: Add OpenRouter and Ollama Provider Presets

## Problem

Looplia currently supports three provider types:
- **Anthropic** (direct API and Claude Code subscription)
- **ZenMux** (proxy with 14+ model presets)
- **Custom** (user-configured providers)

Users want to leverage additional providers for cost optimization and local model access:
- **OpenRouter**: Unified API for accessing multiple LLM providers with centralized billing
- **Ollama**: Local LLM execution with cloud model support

Without native support, users must manually configure these as "custom" providers, which lacks:
- Type safety for provider-specific configurations
- Provider-specific environment variable auto-mapping
- Preset configurations for quick setup
- Clear documentation and examples

## Proposed Solution

Extend the model provider system to natively support OpenRouter and Ollama by:

1. **Add new provider types**: `"openrouter"` and `"ollama"` to `ApiProviderType`
2. **Follow ZenMux pattern**: Provider-specific env vars auto-map to `ANTHROPIC_API_KEY`
3. **OpenRouter strategy**: Single generic preset pointing to user-configured dashboard presets
4. **Ollama strategy**: Cloud model presets for popular models

### OpenRouter Integration

**Architecture:**
- Base URL: `https://openrouter.ai/api`
- Auth: `OPENROUTER_API_KEY` env var
- Model reference: `@preset/looplia-default` (users configure actual models in OpenRouter dashboard)

**Preset:**
- `OPENROUTER_PRESET` - Generic preset pointing to `@preset/looplia-default`

**User workflow:**
1. Create preset in OpenRouter dashboard (e.g., configure model selection, routing preferences)
2. Apply `OPENROUTER_PRESET` in looplia
3. Set `OPENROUTER_API_KEY` environment variable
4. Looplia references the dashboard-configured preset

### Ollama Integration

**Architecture:**
- Base URL: `http://localhost:11434` (local Ollama instance)
- Auth: Literal `"ollama"` string (per Ollama docs), overridable via `OLLAMA_API_KEY`

**Presets:**
- `OLLAMA_GLM47_CLOUD` - GLM-4.7 cloud model (`glm-4.7:cloud`)
- `OLLAMA_MINIMAX_M21_CLOUD` - MiniMax-M2.1 cloud model (`minimax-m2.1:cloud`)

### Implementation Approach

**Type System:**
```typescript
export type ApiProviderType = "anthropic" | "zenmux" | "openrouter" | "ollama" | "custom";
```

**Preset Definitions:**
```typescript
OPENROUTER_PRESET: {
  name: "OpenRouter (User-Configured Preset)",
  apiProvider: "openrouter",
  baseUrl: "https://openrouter.ai/api",
  mainModel: "@preset/looplia-default",
  // ... all tier models point to same preset
}

OLLAMA_GLM47_CLOUD: {
  name: "Ollama GLM-4.7 Cloud",
  apiProvider: "ollama",
  baseUrl: "http://localhost:11434",
  mainModel: "glm-4.7:cloud",
  // ...
}
```

**Environment Variable Mapping:**
- `OPENROUTER_API_KEY` → `ANTHROPIC_AUTH_TOKEN`
- `OLLAMA_API_KEY` (optional) → `ANTHROPIC_API_KEY` (defaults to `"ollama"` if not set)

## Impact Analysis

### Affected Components

**Core Provider System:**
- `packages/provider/src/claude-agent-sdk/model-provider.ts` - Type definitions, presets, env injection

**CLI Interface:**
- `apps/cli/src/commands/config.ts` - Help text, preset list

**Documentation:**
- `README.md` - Environment variables table
- `.env.example` - Example configurations
- `apps/docs/src/content/docs/index.mdx` - Landing page provider showcase (Tabs update)
- `apps/docs/src/content/docs/cli/config.mdx` - CLI config command reference
- `apps/docs/src/content/docs/reference/environment-variables.mdx` - Complete env var reference

**Tests:**
- `packages/provider/test/claude-agent-sdk/model-provider.test.ts` - Preset tests, env injection tests

### Backward Compatibility

✅ **Fully backward compatible**
- All existing presets remain unchanged
- No breaking changes to types or interfaces
- New provider types are additive only
- Existing workflows continue working unchanged

### Dependencies

**External Services:**
- OpenRouter API (https://openrouter.ai) - User account required
- Ollama (http://localhost:11434) - Local installation required

**Environment Variables:**
- `OPENROUTER_API_KEY` - New (optional)
- `OLLAMA_API_KEY` - New (optional, defaults to `"ollama"`)

### Documentation Strategy

**Provider Ordering:** All documentation will present providers in this sequence:
1. **Anthropic Official** (Direct API + Claude Code Subscription)
2. **Ollama** (Local LLM execution)
3. **OpenRouter** (Multi-provider aggregator)
4. **ZenMux** (Proxy provider)

This ordering prioritizes official/local options before third-party proxies.

## Alternatives Considered

### 1. Use "custom" provider type only
**Rejected**: Lacks type safety and provider-specific auto-mapping

### 2. Multiple OpenRouter model presets
**Rejected**: OpenRouter's preset system provides better centralized configuration

### 3. Ollama generic preset only
**Rejected**: Users prefer specific presets for popular cloud models

### 4. Ollama local model presets
**Rejected**: Too many local model variants, better to let users configure manually

## Success Criteria

1. **Type Safety**: `ApiProviderType` includes new providers
2. **Preset Count**: 22 total presets (19 existing + 3 new)
3. **Environment Mapping**: `OPENROUTER_API_KEY` and `OLLAMA_API_KEY` auto-map correctly
4. **Documentation**: README and help text include new presets
5. **Test Coverage**: All new presets and env mapping tested
6. **User Experience**: `looplia config provider preset OPENROUTER_PRESET` works end-to-end

## Next Steps

1. Review and approve this proposal
2. Create spec deltas in `specs/model-provider/spec.md`
3. Define implementation tasks in `tasks.md`
4. Validate with `openspec validate add-openrouter-ollama-presets --strict`
5. Implement after approval
6. Test with real OpenRouter and Ollama instances
7. Update CHANGELOG.md
8. Archive proposal after deployment

## References

- OpenRouter Documentation: https://openrouter.ai/docs/guides/guides/claude-code-integration
- OpenRouter Presets: https://openrouter.ai/docs/guides/features/presets
- Ollama Documentation: https://ollama.com/blog/claude
- Existing Model Provider Spec: `openspec/changes/archive/2026-01-19-add-claude-code-subscription-presets/specs/model-provider/spec.md`
- Implementation Plan: `/Users/memorysaver/.claude/plans/crispy-spinning-lamport.md`
