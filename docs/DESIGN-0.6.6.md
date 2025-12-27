# Looplia-Core Architecture Design v0.6.6

> **FEATURE RELEASE:** Model Provider Configuration (ZenMux-style Model Switching)
>
> **Version:** 0.6.6
> **Date:** 2025-12-27
> **Related:** [DESIGN-0.6.5.md](./DESIGN-0.6.5.md) | [AGENT-SDK.md](./AGENT-SDK.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Configuration Schema](#4-configuration-schema)
5. [Model Provider Module](#5-model-provider-module)
6. [CLI Commands](#6-cli-commands)
7. [Environment Injection](#7-environment-injection)
8. [Query Executor Integration](#8-query-executor-integration)
9. [Provider Presets](#9-provider-presets)
10. [Implementation Guide](#10-implementation-guide)
11. [Testing Strategy](#11-testing-strategy)
12. [File Changes Summary](#12-file-changes-summary)

---

## 1. Executive Summary

### Feature Release: v0.6.5 → v0.6.6

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.5 | Plugin Loading Strategy | Run looplia from any directory via Agent SDK plugins |
| **v0.6.6** | **Model Provider Configuration** | **Switch to cheaper models/providers via CLI config** |

### What Changes in v0.6.6

v0.6.6 introduces a ZenMux-style model provider configuration system:

1. **MODEL PROVIDER CONFIG:** Store provider settings in `~/.looplia/model-provider.json`
2. **CLI COMMANDS:** Configure providers via `looplia config provider` commands
3. **ENVIRONMENT INJECTION:** Inject config as env vars before SDK calls
4. **PROVIDER PRESETS:** One-command setup for popular providers (ZenMux, etc.)
5. **MODEL TIER MAPPING:** Map haiku/sonnet/opus tiers to actual model IDs

### Design Principle

> **Follow the Platform, Extend the Experience**
>
> The Claude Agent SDK respects standard Anthropic environment variables:
> - `ANTHROPIC_BASE_URL` - API endpoint
> - `ANTHROPIC_AUTH_TOKEN` - Authentication token
> - `ANTHROPIC_DEFAULT_HAIKU_MODEL` - Default haiku model
> - `ANTHROPIC_DEFAULT_SONNET_MODEL` - Default sonnet model
> - `ANTHROPIC_DEFAULT_OPUS_MODEL` - Default opus model
>
> Looplia provides a CLI layer to manage these persistently.

### The Shift

```
BEFORE (v0.6.5):
  # Model hardcoded, no provider switching
  model: "claude-haiku-4-5-20251001"
  # Must set env vars manually in shell profile

AFTER (v0.6.6):
  # Configure once, use everywhere
  looplia config provider set base-url https://zenmux.ai/api/anthropic
  looplia config provider set auth-token sk-ai-v1-xxx
  looplia config provider set model-haiku anthropic/claude-haiku-4.5
  looplia config provider enable

  # At runtime: config loaded and injected as env vars before SDK call
```

---

## 2. Problem Statement

### 2.1 Cost Optimization Challenge

Using Claude directly through Anthropic can be expensive for high-volume workflows:

| Scenario | Current Cost | With Cheaper Provider |
|----------|--------------|----------------------|
| 1000 workflow runs | $X.XX | $X.XX × 0.5-0.7 |
| Development/testing | Full price | Reduced price |
| Experimenting | Full price | Lower tier models |

### 2.2 Provider Lock-In

Current implementation is locked to Anthropic's API:

```typescript
// Current: No way to switch providers
const result = query({
  prompt,
  options: {
    model: "claude-haiku-4-5-20251001",  // Hardcoded
    // No baseUrl option exposed
  },
});
```

### 2.3 Configuration Friction

Users who want to use alternative providers must:

1. Edit shell profile (`.bashrc`, `.zshrc`)
2. Set environment variables manually
3. Remember to source the file
4. Repeat for each terminal session

**Desired Experience:**
```bash
looplia config provider zenmux  # One command setup
looplia run writing-kit         # Uses ZenMux automatically
```

---

## 3. Solution Overview

### 3.1 Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         MODEL PROVIDER CONFIGURATION                          │
└──────────────────────────────────────────────────────────────────────────────┘

                    CLI Commands                    Config File
                    ┌──────────────────────────────────────────────────┐
                    │ looplia config provider set base-url <url>       │
                    │ looplia config provider set auth-token <token>   │
                    │ looplia config provider set model-haiku <model>  │
                    │ looplia config provider enable                   │
                    └──────────────────────┬───────────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────────┐
                    │ ~/.looplia/model-provider.json                   │
                    │ {                                                │
                    │   "enabled": true,                               │
                    │   "baseUrl": "https://zenmux.ai/api/anthropic",  │
                    │   "authToken": "sk-ai-v1-xxx",                   │
                    │   "models": {                                    │
                    │     "haiku": "anthropic/claude-haiku-4.5",       │
                    │     "sonnet": "anthropic/claude-sonnet-4.5",     │
                    │     "opus": "anthropic/claude-opus-4.5"          │
                    │   }                                              │
                    │ }                                                │
                    └──────────────────────┬───────────────────────────┘
                                           │
                                           │ Runtime: Read & Inject
                                           ▼
                    ┌──────────────────────────────────────────────────┐
                    │ process.env (before SDK call)                    │
                    │                                                  │
                    │ ANTHROPIC_BASE_URL=https://zenmux.ai/api/...     │
                    │ ANTHROPIC_AUTH_TOKEN=sk-ai-v1-xxx                │
                    │ ANTHROPIC_DEFAULT_HAIKU_MODEL=anthropic/...      │
                    │ ANTHROPIC_DEFAULT_SONNET_MODEL=anthropic/...     │
                    │ ANTHROPIC_DEFAULT_OPUS_MODEL=anthropic/...       │
                    └──────────────────────┬───────────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────────┐
                    │ Claude Agent SDK                                 │
                    │ query({ prompt, options: { model: "haiku" } })   │
                    │                                                  │
                    │ SDK reads ANTHROPIC_* env vars automatically     │
                    └──────────────────────────────────────────────────┘
```

### 3.2 Precedence Order

Settings are resolved with clear precedence:

| Priority | Source | Example |
|----------|--------|---------|
| 1 (highest) | Environment variables | `export ANTHROPIC_BASE_URL=...` |
| 2 | model-provider.json | `~/.looplia/model-provider.json` |
| 3 (lowest) | Hardcoded defaults | `claude-haiku-4-5-20251001` |

**Rationale:** Environment variables take precedence to allow:
- CI/CD overrides
- Per-session testing
- Compatibility with existing shell configs

### 3.3 Feature Summary

| Feature | Description |
|---------|-------------|
| `looplia config provider` | Interactive setup wizard |
| `looplia config provider set` | Direct key-value configuration |
| `looplia config provider show` | Display current configuration |
| `looplia config provider enable` | Enable provider configuration |
| `looplia config provider disable` | Use default Anthropic settings |
| `looplia config provider reset` | Remove all provider configuration |
| Provider presets | One-command setup for ZenMux, etc. |

---

## 4. Configuration Schema

### 4.1 Config File Location

```
~/.looplia/model-provider.json
```

### 4.2 Schema Definition

```typescript
/**
 * Model tier names following Claude's naming convention
 */
export type ModelTier = "haiku" | "sonnet" | "opus";

/**
 * Model provider configuration
 * Stored at ~/.looplia/model-provider.json
 */
export type ModelProviderConfig = {
  /**
   * Whether to apply this configuration
   * When false, looplia uses default Anthropic settings
   */
  enabled: boolean;

  /**
   * API base URL (injected as ANTHROPIC_BASE_URL)
   * @example "https://zenmux.ai/api/anthropic"
   */
  baseUrl?: string;

  /**
   * Authentication token for proxy services (injected as ANTHROPIC_AUTH_TOKEN)
   * Note: Stored in plain text. Users responsible for file permissions.
   * @example "sk-ai-v1-xxx"
   */
  authToken?: string;

  /**
   * Model ID mappings for each tier
   */
  models?: {
    /** Model ID for haiku tier (injected as ANTHROPIC_DEFAULT_HAIKU_MODEL) */
    haiku?: string;
    /** Model ID for sonnet tier (injected as ANTHROPIC_DEFAULT_SONNET_MODEL) */
    sonnet?: string;
    /** Model ID for opus tier (injected as ANTHROPIC_DEFAULT_OPUS_MODEL) */
    opus?: string;
  };
};
```

### 4.3 Example Configurations

**ZenMux Configuration:**
```json
{
  "enabled": true,
  "baseUrl": "https://zenmux.ai/api/anthropic",
  "authToken": "sk-ai-v1-your-key-here",
  "models": {
    "haiku": "anthropic/claude-haiku-4.5",
    "sonnet": "anthropic/claude-sonnet-4.5",
    "opus": "anthropic/claude-opus-4.5"
  }
}
```

**Custom Provider with Mixed Models:**
```json
{
  "enabled": true,
  "baseUrl": "https://my-proxy.example.com/v1",
  "authToken": "my-api-key",
  "models": {
    "haiku": "openai/gpt-4o-mini",
    "sonnet": "anthropic/claude-sonnet-4.5",
    "opus": "google/gemini-2.0-flash"
  }
}
```

**Disabled (Use Anthropic Defaults):**
```json
{
  "enabled": false
}
```

### 4.4 Default Values

```typescript
export const DEFAULT_MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20250514",
  opus: "claude-opus-4-5-20251101",
} as const;
```

---

## 5. Model Provider Module

### 5.1 File Location

```
packages/provider/src/claude-agent-sdk/model-provider.ts
```

### 5.2 Type Exports

```typescript
export type { ModelTier, ModelProviderConfig };
export { DEFAULT_MODELS };
```

### 5.3 Core Functions

```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_FILE = "model-provider.json";

/**
 * Get the path to the model provider config file
 */
export function getConfigPath(): string {
  return join(homedir(), ".looplia", CONFIG_FILE);
}

/**
 * Read model provider configuration from disk
 * Returns null if file doesn't exist
 */
export async function readModelProviderConfig(): Promise<ModelProviderConfig | null> {
  try {
    const content = await readFile(getConfigPath(), "utf-8");
    return JSON.parse(content) as ModelProviderConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Write model provider configuration to disk
 */
export async function writeModelProviderConfig(
  config: ModelProviderConfig
): Promise<void> {
  const configPath = getConfigPath();
  await mkdir(join(homedir(), ".looplia"), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Inject model provider config as environment variables
 * Called before SDK query() invocation
 *
 * IMPORTANT: Only sets env vars if not already set (env vars take precedence)
 */
export function injectModelProviderEnv(config: ModelProviderConfig): void {
  if (!config.enabled) {
    return;
  }

  // Only inject if env var not already set (precedence: env > config)
  if (config.baseUrl && !process.env.ANTHROPIC_BASE_URL) {
    process.env.ANTHROPIC_BASE_URL = config.baseUrl;
  }

  if (config.authToken && !process.env.ANTHROPIC_AUTH_TOKEN) {
    process.env.ANTHROPIC_AUTH_TOKEN = config.authToken;
  }

  if (config.models?.haiku && !process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL) {
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.models.haiku;
  }

  if (config.models?.sonnet && !process.env.ANTHROPIC_DEFAULT_SONNET_MODEL) {
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.models.sonnet;
  }

  if (config.models?.opus && !process.env.ANTHROPIC_DEFAULT_OPUS_MODEL) {
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = config.models.opus;
  }
}

/**
 * Resolve model tier to actual model ID
 * Checks env vars first, then config, then defaults
 */
export function resolveModelFromTier(
  tier: ModelTier,
  config?: ModelProviderConfig | null
): string {
  const envVarMap: Record<ModelTier, string> = {
    haiku: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    sonnet: "ANTHROPIC_DEFAULT_SONNET_MODEL",
    opus: "ANTHROPIC_DEFAULT_OPUS_MODEL",
  };

  // 1. Check environment variable (highest priority)
  const envValue = process.env[envVarMap[tier]];
  if (envValue) {
    return envValue;
  }

  // 2. Check config file
  if (config?.enabled && config.models?.[tier]) {
    return config.models[tier]!;
  }

  // 3. Return default
  return DEFAULT_MODELS[tier];
}

/**
 * Get display-friendly provider info for status/show commands
 */
export function getProviderDisplayInfo(config: ModelProviderConfig | null): {
  status: "enabled" | "disabled" | "not-configured";
  provider: string;
  models: Record<ModelTier, string>;
} {
  if (!config) {
    return {
      status: "not-configured",
      provider: "Anthropic (default)",
      models: { ...DEFAULT_MODELS },
    };
  }

  if (!config.enabled) {
    return {
      status: "disabled",
      provider: "Anthropic (default)",
      models: { ...DEFAULT_MODELS },
    };
  }

  return {
    status: "enabled",
    provider: config.baseUrl ?? "Anthropic (default)",
    models: {
      haiku: config.models?.haiku ?? DEFAULT_MODELS.haiku,
      sonnet: config.models?.sonnet ?? DEFAULT_MODELS.sonnet,
      opus: config.models?.opus ?? DEFAULT_MODELS.opus,
    },
  };
}
```

---

## 6. CLI Commands

### 6.1 Command Structure

```
looplia config provider [subcommand] [args]

Subcommands:
  (none)        Interactive setup wizard
  show          Display current provider configuration
  set <k> <v>   Set a configuration value
  enable        Enable provider configuration
  disable       Disable (use Anthropic defaults)
  reset         Remove all provider configuration
```

### 6.2 Implementation Location

```
apps/cli/src/commands/config.ts
```

### 6.3 Key Mappings for `set` Command

| CLI Key | Config Field | Environment Variable |
|---------|--------------|---------------------|
| `base-url` | `baseUrl` | `ANTHROPIC_BASE_URL` |
| `auth-token` | `authToken` | `ANTHROPIC_AUTH_TOKEN` |
| `model-haiku` | `models.haiku` | `ANTHROPIC_DEFAULT_HAIKU_MODEL` |
| `model-sonnet` | `models.sonnet` | `ANTHROPIC_DEFAULT_SONNET_MODEL` |
| `model-opus` | `models.opus` | `ANTHROPIC_DEFAULT_OPUS_MODEL` |

### 6.4 Command Examples

**Interactive Wizard:**
```bash
$ looplia config provider

? Select a provider preset:
  > Anthropic (default)
    ZenMux
    Custom

? Enter your ZenMux API Key: sk-ai-v1-xxx

? Select default model tier for main agent:
  > haiku (fastest, cheapest)
    sonnet (balanced)
    opus (most capable)

✓ Provider configured successfully
  Base URL: https://zenmux.ai/api/anthropic
  Auth: ****xxx (masked)
  Haiku: anthropic/claude-haiku-4.5
  Sonnet: anthropic/claude-sonnet-4.5
  Opus: anthropic/claude-opus-4.5
```

**Direct Set Commands:**
```bash
$ looplia config provider set base-url https://zenmux.ai/api/anthropic
✓ Set base-url = https://zenmux.ai/api/anthropic

$ looplia config provider set auth-token sk-ai-v1-xxx
✓ Set auth-token = ****xxx (masked in output)

$ looplia config provider set model-haiku anthropic/claude-haiku-4.5
✓ Set model-haiku = anthropic/claude-haiku-4.5

$ looplia config provider enable
✓ Provider configuration enabled
```

**Show Configuration:**
```bash
$ looplia config provider show

Model Provider Configuration:
  Status: enabled
  Base URL: https://zenmux.ai/api/anthropic
  Auth Token: ****xxx

  Model Mappings:
    haiku: anthropic/claude-haiku-4.5
    sonnet: anthropic/claude-sonnet-4.5
    opus: anthropic/claude-opus-4.5

  Config file: ~/.looplia/model-provider.json
```

**Disable/Reset:**
```bash
$ looplia config provider disable
✓ Provider configuration disabled (using Anthropic defaults)

$ looplia config provider reset
✓ Provider configuration removed
```

### 6.5 Implementation Snippet

```typescript
// In apps/cli/src/commands/config.ts

import {
  readModelProviderConfig,
  writeModelProviderConfig,
  getProviderDisplayInfo,
  type ModelProviderConfig,
} from "@looplia-core/provider/claude-agent-sdk";

async function runProviderCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case undefined:
      // Interactive wizard
      await runProviderWizard();
      break;

    case "show":
      await showProviderConfig();
      break;

    case "set":
      await setProviderValue(args[1], args[2]);
      break;

    case "enable":
      await setProviderEnabled(true);
      break;

    case "disable":
      await setProviderEnabled(false);
      break;

    case "reset":
      await resetProviderConfig();
      break;

    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      printProviderHelp();
      process.exit(1);
  }
}

async function setProviderValue(key: string, value: string): Promise<void> {
  if (!key || !value) {
    console.error("Usage: looplia config provider set <key> <value>");
    process.exit(1);
  }

  const config = (await readModelProviderConfig()) ?? { enabled: false };

  switch (key) {
    case "base-url":
      config.baseUrl = value;
      break;
    case "auth-token":
      config.authToken = value;
      break;
    case "model-haiku":
      config.models = { ...config.models, haiku: value };
      break;
    case "model-sonnet":
      config.models = { ...config.models, sonnet: value };
      break;
    case "model-opus":
      config.models = { ...config.models, opus: value };
      break;
    default:
      console.error(`Unknown key: ${key}`);
      console.error("Valid keys: base-url, auth-token, model-haiku, model-sonnet, model-opus");
      process.exit(1);
  }

  await writeModelProviderConfig(config);

  // Mask auth token in output
  const displayValue = key === "auth-token"
    ? `****${value.slice(-4)}`
    : value;
  console.log(`✓ Set ${key} = ${displayValue}`);
}
```

---

## 7. Environment Injection

### 7.1 When Injection Happens

Environment variables are injected at the **start of each query execution**, before the SDK `query()` call:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUERY EXECUTION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

  looplia run writing-kit
         │
         ▼
  ┌──────────────────────────┐
  │ 1. Read config file      │ ← readModelProviderConfig()
  │    ~/.looplia/model-     │
  │    provider.json         │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ 2. Inject env vars       │ ← injectModelProviderEnv(config)
  │    (if enabled &&        │
  │     not already set)     │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ 3. Call SDK query()      │ ← SDK reads env vars automatically
  │                          │
  └──────────────────────────┘
```

### 7.2 Environment Variable Mapping

| Config Field | Environment Variable | SDK Behavior |
|--------------|---------------------|--------------|
| `baseUrl` | `ANTHROPIC_BASE_URL` | SDK sends requests to this URL |
| `authToken` | `ANTHROPIC_AUTH_TOKEN` | SDK uses for authentication |
| `models.haiku` | `ANTHROPIC_DEFAULT_HAIKU_MODEL` | SDK resolves "haiku" tier |
| `models.sonnet` | `ANTHROPIC_DEFAULT_SONNET_MODEL` | SDK resolves "sonnet" tier |
| `models.opus` | `ANTHROPIC_DEFAULT_OPUS_MODEL` | SDK resolves "opus" tier |

### 7.3 Precedence Implementation

```typescript
// Only inject if not already set in environment
if (config.baseUrl && !process.env.ANTHROPIC_BASE_URL) {
  process.env.ANTHROPIC_BASE_URL = config.baseUrl;
}
```

This ensures:
1. User shell config (`~/.bashrc`) takes priority
2. CI/CD environment variables take priority
3. Per-command overrides work: `ANTHROPIC_BASE_URL=... looplia run`

---

## 8. Query Executor Integration

### 8.1 File Location

```
packages/provider/src/claude-agent-sdk/streaming/query-executor.ts
```

### 8.2 Integration Point

Add config loading and injection at the start of `executeAgenticQueryStreaming()`:

```typescript
import {
  readModelProviderConfig,
  injectModelProviderEnv,
} from "../model-provider";

export async function* executeAgenticQueryStreaming<T>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  config?: ClaudeAgentConfig
): AsyncGenerator<StreamingEvent, AgenticQueryResult<T>> {
  const resolvedConfig = resolveConfig(config);
  const apiKey = getApiKey(config);

  if (!apiKey) {
    throw new Error(
      "API key is required. Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN environment variable"
    );
  }

  // v0.6.6: Load and inject model provider configuration
  const providerConfig = await readModelProviderConfig();
  if (providerConfig?.enabled) {
    injectModelProviderEnv(providerConfig);
  }

  try {
    // ... rest of implementation unchanged
  }
}
```

### 8.3 Model Resolution

The SDK handles model resolution internally via the environment variables. No changes needed to the `query()` call - just ensure env vars are set before invocation.

---

## 9. Provider Presets

### 9.1 Preset Definitions

```typescript
// In apps/cli/src/commands/config.ts

type ProviderPreset = {
  name: string;
  baseUrl: string;
  models: {
    haiku: string;
    sonnet: string;
    opus: string;
  };
};

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  zenmux: {
    name: "ZenMux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    models: {
      haiku: "anthropic/claude-haiku-4.5",
      sonnet: "anthropic/claude-sonnet-4.5",
      opus: "anthropic/claude-opus-4.5",
    },
  },
  // Future presets can be added here
};
```

### 9.2 Preset Application in Wizard

```typescript
async function runProviderWizard(): Promise<void> {
  // Using inquirer or similar for interactive prompts
  const { preset } = await prompt({
    type: "select",
    name: "preset",
    message: "Select a provider preset:",
    choices: [
      { name: "Anthropic (default)", value: "anthropic" },
      { name: "ZenMux", value: "zenmux" },
      { name: "Custom", value: "custom" },
    ],
  });

  if (preset === "anthropic") {
    await writeModelProviderConfig({ enabled: false });
    console.log("✓ Using Anthropic defaults");
    return;
  }

  let config: ModelProviderConfig;

  if (preset === "custom") {
    config = await promptCustomConfig();
  } else {
    const presetConfig = PROVIDER_PRESETS[preset];
    const { authToken } = await prompt({
      type: "password",
      name: "authToken",
      message: `Enter your ${presetConfig.name} API Key:`,
    });

    config = {
      enabled: true,
      baseUrl: presetConfig.baseUrl,
      authToken,
      models: presetConfig.models,
    };
  }

  await writeModelProviderConfig(config);
  displayConfigSummary(config);
}
```

---

## 10. Implementation Guide

### 10.1 Implementation Order

| Step | Task | Dependencies |
|------|------|--------------|
| 1 | Create `model-provider.ts` with types and utilities | None |
| 2 | Add exports to `packages/provider/src/claude-agent-sdk/index.ts` | Step 1 |
| 3 | Add `provider` subcommand to `config.ts` CLI | Steps 1-2 |
| 4 | Integrate into `query-executor.ts` | Steps 1-2 |
| 5 | Update `.env.example` with documentation | None |
| 6 | Add tests for model-provider module | Step 1 |
| 7 | Add integration tests for CLI commands | Step 3 |

### 10.2 Development Workflow

```bash
# Step 1: Create model-provider.ts
# Run tests to verify utilities work

# Step 2: Update exports
# Verify imports work from CLI package

# Step 3: Add CLI commands
LOOPLIA_DEV=true looplia config provider show
LOOPLIA_DEV=true looplia config provider set base-url https://test.example.com

# Step 4: Integration
# Full end-to-end test with provider config enabled

# Step 5-7: Polish and test
```

### 10.3 Key Implementation Notes

1. **File I/O**: Use async fs operations consistently
2. **Error Handling**: Gracefully handle missing config file (return null, not error)
3. **Token Security**: Mask auth tokens in all console output
4. **Validation**: Validate URLs before saving (basic format check)

---

## 11. Testing Strategy

### 11.1 Unit Tests

**File:** `packages/provider/test/claude-agent-sdk/model-provider.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  readModelProviderConfig,
  writeModelProviderConfig,
  injectModelProviderEnv,
  resolveModelFromTier,
  DEFAULT_MODELS,
} from "../src/claude-agent-sdk/model-provider";

describe("model-provider", () => {
  describe("injectModelProviderEnv", () => {
    beforeEach(() => {
      // Clear env vars
      delete process.env.ANTHROPIC_BASE_URL;
      delete process.env.ANTHROPIC_AUTH_TOKEN;
      delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
    });

    test("injects all config values", () => {
      const config = {
        enabled: true,
        baseUrl: "https://test.example.com",
        authToken: "test-token",
        models: { haiku: "test-model" },
      };

      injectModelProviderEnv(config);

      expect(process.env.ANTHROPIC_BASE_URL).toBe("https://test.example.com");
      expect(process.env.ANTHROPIC_AUTH_TOKEN).toBe("test-token");
      expect(process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("test-model");
    });

    test("does not override existing env vars", () => {
      process.env.ANTHROPIC_BASE_URL = "existing-url";

      injectModelProviderEnv({
        enabled: true,
        baseUrl: "new-url",
      });

      expect(process.env.ANTHROPIC_BASE_URL).toBe("existing-url");
    });

    test("does nothing when disabled", () => {
      injectModelProviderEnv({
        enabled: false,
        baseUrl: "should-not-be-set",
      });

      expect(process.env.ANTHROPIC_BASE_URL).toBeUndefined();
    });
  });

  describe("resolveModelFromTier", () => {
    test("returns default when no config", () => {
      expect(resolveModelFromTier("haiku", null)).toBe(DEFAULT_MODELS.haiku);
    });

    test("returns config value when enabled", () => {
      const config = {
        enabled: true,
        models: { haiku: "custom-haiku" },
      };
      expect(resolveModelFromTier("haiku", config)).toBe("custom-haiku");
    });

    test("env var takes precedence", () => {
      process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = "env-haiku";
      const config = { enabled: true, models: { haiku: "config-haiku" } };

      expect(resolveModelFromTier("haiku", config)).toBe("env-haiku");

      delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
    });
  });
});
```

### 11.2 CLI Integration Tests

**File:** `apps/cli/test/commands/config-provider.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_PATH = join(homedir(), ".looplia", "model-provider.json");

describe("looplia config provider", () => {
  beforeEach(async () => {
    // Remove config file before each test
    await rm(CONFIG_PATH, { force: true });
  });

  test("set base-url creates config file", async () => {
    execSync("looplia config provider set base-url https://test.example.com");

    const content = await readFile(CONFIG_PATH, "utf-8");
    const config = JSON.parse(content);

    expect(config.baseUrl).toBe("https://test.example.com");
  });

  test("enable sets enabled flag", async () => {
    execSync("looplia config provider set base-url https://test.example.com");
    execSync("looplia config provider enable");

    const content = await readFile(CONFIG_PATH, "utf-8");
    const config = JSON.parse(content);

    expect(config.enabled).toBe(true);
  });

  test("reset removes config file", async () => {
    execSync("looplia config provider set base-url https://test.example.com");
    execSync("looplia config provider reset");

    await expect(readFile(CONFIG_PATH)).rejects.toThrow();
  });
});
```

### 11.3 End-to-End Test

```bash
#!/bin/bash
# scripts/test-model-provider.sh

set -e

echo "Testing model provider configuration..."

# Clean state
rm -f ~/.looplia/model-provider.json

# Configure ZenMux (without real API key)
looplia config provider set base-url https://zenmux.ai/api/anthropic
looplia config provider set model-haiku anthropic/claude-haiku-4.5
looplia config provider enable

# Verify config
looplia config provider show | grep -q "zenmux.ai"
echo "✓ Config file created correctly"

# Verify show output
looplia config provider show | grep -q "enabled"
echo "✓ Show command works"

# Reset
looplia config provider reset
test ! -f ~/.looplia/model-provider.json
echo "✓ Reset command works"

echo "All model provider tests passed!"
```

---

## 12. File Changes Summary

### 12.1 Files to Create

| File | Purpose |
|------|---------|
| `packages/provider/src/claude-agent-sdk/model-provider.ts` | Model provider types, read/write/inject utilities |

### 12.2 Files to Modify

| File | Changes |
|------|---------|
| `packages/provider/src/claude-agent-sdk/index.ts` | Export model-provider utilities |
| `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts` | Load and inject provider config before SDK call |
| `apps/cli/src/commands/config.ts` | Add `provider` subcommand with wizard and set commands |
| `.env.example` | Document provider environment variables |

### 12.3 Files to Add (Tests)

| File | Purpose |
|------|---------|
| `packages/provider/test/claude-agent-sdk/model-provider.test.ts` | Unit tests for model-provider module |
| `apps/cli/test/commands/config-provider.test.ts` | CLI integration tests |

---

## Cross-References

- **Local Plugin Loading (v0.6.5):** See [DESIGN-0.6.5.md](./DESIGN-0.6.5.md)
- **Agent SDK Documentation:** See [AGENT-SDK.md](./AGENT-SDK.md)
- **ZenMux Integration Guide:** Referenced external documentation

---

*This document serves as the single source of truth for Looplia-Core v0.6.6 Model Provider Configuration architecture.*
