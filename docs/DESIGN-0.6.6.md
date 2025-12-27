# Looplia-Core Architecture Design v0.6.6

> **FEATURE RELEASE:** Model Provider Configuration (Agent-Based Model Switching)
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
5. [Preset System](#5-preset-system)
6. [Model Provider Module](#6-model-provider-module)
7. [CLI Commands](#7-cli-commands)
8. [Environment Injection](#8-environment-injection)
9. [Query Executor Integration](#9-query-executor-integration)
10. [Implementation Guide](#10-implementation-guide)
11. [File Changes Summary](#11-file-changes-summary)

---

## 1. Executive Summary

### Feature Release: v0.6.5 → v0.6.6

| Version | Focus | Key Achievement |
|---------|-------|-----------------|
| v0.6.5 | Plugin Loading Strategy | Run looplia from any directory via Agent SDK plugins |
| **v0.6.6** | **Model Provider Configuration** | **Switch to cheaper models/providers via CLI config** |

### What Changes in v0.6.6

v0.6.6 introduces an agent-based model provider configuration system:

1. **AGENT-BASED MODELS:** Configure models for main agent and skill executor separately
2. **STRUCTURED PRESETS:** `{API_PROVIDER}_{MODEL_VENDOR}_{MODEL_NAME}` format
3. **NEW CONFIG FILE:** Store settings in `~/.looplia/looplia.setting.json`
4. **ZENMUX SUPPORT:** GLM-4.7, MiniMax-M2.1, Gemini-3-Flash presets
5. **CLI COMMANDS:** Configure via `looplia config provider` commands

### Design Principle

> **Agent-Centric Model Configuration**
>
> Looplia uses two agents that can be configured independently:
> - **Main Agent:** Orchestrates the workflow (default: haiku)
> - **Skill Executor:** Executes individual skill steps (default: haiku)
>
> Settings are stored in `~/.looplia/looplia.setting.json` and injected as
> environment variables before SDK calls.

### The Shift

```
BEFORE (v0.6.5):
  # Model hardcoded, no provider switching
  model: "claude-haiku-4-5-20251001"
  agents: { "skill-executor": { model: "haiku" } }  # Fixed

AFTER (v0.6.6):
  # Set API keys in .env (looplia auto-maps based on provider)
  ANTHROPIC_API_KEY=sk-ant-xxx
  ZENMUX_API_KEY=sk-ai-v1-xxx

  # Just select preset - API key auto-mapped!
  looplia config provider preset ZENMUX_ZAI_GLM47
  looplia run writing-kit  # Uses ZENMUX_API_KEY automatically
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

### 2.2 Agent-Specific Model Requirements

Looplia has two distinct agents with different requirements:

| Agent | Current Behavior | Desired |
|-------|-----------------|---------|
| Main Agent | Hardcoded haiku | Configurable |
| Skill Executor | Hardcoded "haiku" | Configurable (same as main) |

### 2.3 Provider Lock-In

Current implementation is locked to Anthropic's API:

```typescript
// Current: No way to switch providers
const result = query({
  options: {
    model: "claude-haiku-4-5-20251001",  // Hardcoded
    agents: {
      "skill-executor": {
        model: "haiku",  // Fixed tier
      }
    }
  },
});
```

---

## 3. Solution Overview

### 3.1 Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      LOOPLIA MODEL PROVIDER CONFIGURATION                     │
└──────────────────────────────────────────────────────────────────────────────┘

                  CLI Commands                     Config File
                  ┌───────────────────────────────────────────────────┐
                  │ looplia config provider preset ZENMUX_ZAI_GLM47   │
                  │ looplia config provider set auth-token <token>    │
                  │ looplia config provider set main-model <model>    │
                  │ looplia config provider set executor-model <model>│
                  └──────────────────────┬────────────────────────────┘
                                         │
                                         ▼
                  ┌───────────────────────────────────────────────────┐
                  │ ~/.looplia/looplia.setting.json                   │
                  │ {                                                 │
                  │   "version": "1.0",                               │
                  │   "preset": "ZENMUX_ZAI_GLM47",                   │
                  │   "apiProvider": {                                │
                  │     "type": "zenmux",                             │
                  │     "baseUrl": "https://zenmux.ai/api/anthropic", │
                  │     "authToken": "sk-ai-v1-xxx"                   │
                  │   },                                              │
                  │   "agents": {                                     │
                  │     "main": "z-ai/glm-4.7",                       │
                  │     "executor": "z-ai/glm-4.7"                    │
                  │   }                                               │
                  │ }                                                 │
                  └──────────────────────┬────────────────────────────┘
                                         │
                                         │ Runtime: Read & Inject
                                         ▼
                  ┌───────────────────────────────────────────────────┐
                  │ process.env (before SDK call)                     │
                  │                                                   │
                  │ ANTHROPIC_BASE_URL=https://zenmux.ai/api/...      │
                  │ ANTHROPIC_API_KEY=sk-ai-v1-xxx (from authToken)   │
                  │ LOOPLIA_AGENT_MODEL_MAIN=z-ai/glm-4.7             │
                  │ LOOPLIA_AGENT_MODEL_EXECUTOR=z-ai/glm-4.7         │
                  └──────────────────────┬────────────────────────────┘
                                         │
                                         ▼
                  ┌───────────────────────────────────────────────────┐
                  │ Claude Agent SDK                                  │
                  │ query({                                           │
                  │   options: {                                      │
                  │     model: mainModel,                             │
                  │     agents: { "skill-executor": { model: exec } } │
                  │   }                                               │
                  │ })                                                │
                  └───────────────────────────────────────────────────┘
```

### 3.2 Precedence Order

Settings are resolved with clear precedence:

| Priority | Source | Example |
|----------|--------|---------|
| 1 (highest) | Environment variables | `export LOOPLIA_AGENT_MODEL_MAIN=...` |
| 2 | looplia.setting.json | `~/.looplia/looplia.setting.json` |
| 3 (lowest) | Hardcoded defaults | `claude-haiku-4-5-20251001` |

### 3.3 Feature Summary

| Feature | Description |
|---------|-------------|
| `looplia config provider` | Interactive setup wizard |
| `looplia config provider preset <name>` | Apply a provider preset |
| `looplia config provider set <key> <value>` | Direct key-value configuration |
| `looplia config provider show` | Display current configuration |
| `looplia config provider reset` | Remove all provider configuration |

---

## 4. Configuration Schema

### 4.1 Config File Location

```
~/.looplia/looplia.setting.json
```

### 4.2 Schema Definition

```typescript
/**
 * API provider types
 */
type ApiProviderType = "anthropic" | "zenmux" | "custom";

/**
 * Looplia settings configuration
 * Stored at ~/.looplia/looplia.setting.json
 */
type LoopliaSettings = {
  /**
   * Schema version for future migrations
   */
  version: "1.0";

  /**
   * Active preset name (optional)
   * When set, indicates which preset was used to configure
   */
  preset?: string;

  /**
   * API provider configuration
   */
  apiProvider: {
    /**
     * Provider type
     */
    type: ApiProviderType;

    /**
     * API base URL (injected as ANTHROPIC_BASE_URL)
     * Required for zenmux/custom providers
     * @example "https://zenmux.ai/api/anthropic"
     */
    baseUrl?: string;

    /**
     * Authentication token (injected as ANTHROPIC_API_KEY for SDK)
     * Note: Stored in plain text. Users responsible for file permissions.
     * @example "sk-ai-v1-xxx"
     */
    authToken?: string;
  };

  /**
   * Agent model configurations
   */
  agents: {
    /**
     * Model for main orchestrator agent
     * (injected as LOOPLIA_AGENT_MODEL_MAIN)
     * @example "z-ai/glm-4.7" or "claude-haiku-4-5-20251001"
     */
    main: string;

    /**
     * Model for skill executor agent
     * (injected as LOOPLIA_AGENT_MODEL_EXECUTOR)
     * @example "z-ai/glm-4.7" or "haiku"
     */
    executor: string;
  };
};
```

### 4.3 Example Configurations

**ZenMux GLM-4.7 Configuration:**
```json
{
  "version": "1.0",
  "preset": "ZENMUX_ZAI_GLM47",
  "apiProvider": {
    "type": "zenmux",
    "baseUrl": "https://zenmux.ai/api/anthropic",
    "authToken": "sk-ai-v1-your-key-here"
  },
  "agents": {
    "main": "z-ai/glm-4.7",
    "executor": "z-ai/glm-4.7"
  }
}
```

**Anthropic Default Configuration:**
```json
{
  "version": "1.0",
  "preset": "ANTHROPIC_CLAUDE_HAIKU",
  "apiProvider": {
    "type": "anthropic"
  },
  "agents": {
    "main": "claude-haiku-4-5-20251001",
    "executor": "haiku"
  }
}
```

**Custom Provider Configuration:**
```json
{
  "version": "1.0",
  "apiProvider": {
    "type": "custom",
    "baseUrl": "https://my-proxy.example.com/v1",
    "authToken": "my-api-key"
  },
  "agents": {
    "main": "openai/gpt-4o-mini",
    "executor": "openai/gpt-4o-mini"
  }
}
```

### 4.4 Default Values

```typescript
export const DEFAULT_SETTINGS: LoopliaSettings = {
  version: "1.0",
  apiProvider: {
    type: "anthropic",
  },
  agents: {
    main: "claude-haiku-4-5-20251001",
    executor: "haiku",
  },
};
```

---

## 5. Preset System

### 5.1 Preset Naming Convention

Format: `{API_PROVIDER}_{MODEL_VENDOR}_{MODEL_SHORT_NAME}`

Examples:
- `ANTHROPIC_CLAUDE_HAIKU` - Direct Anthropic, Claude Haiku
- `ZENMUX_ZAI_GLM47` - ZenMux provider, Z-AI vendor, GLM-4.7 model

### 5.2 Supported Presets

| Preset | Provider | Model String | Description |
|--------|----------|--------------|-------------|
| `ANTHROPIC_CLAUDE_HAIKU` | Anthropic | `claude-haiku-4-5-20251001` | Default, direct Anthropic |
| `ANTHROPIC_CLAUDE_SONNET` | Anthropic | `claude-sonnet-4-5-20250514` | Balanced capability |
| `ZENMUX_ZAI_GLM47` | ZenMux | `z-ai/glm-4.7` | GLM 4.7 via ZenMux |
| `ZENMUX_MINIMAX_M21` | ZenMux | `minimax/minimax-m2.1` | MiniMax M2.1 via ZenMux |
| `ZENMUX_GOOGLE_GEMINI3FLASH` | ZenMux | `google/gemini-3-flash-preview` | Gemini 3 Flash via ZenMux |
| `ZENMUX_GOOGLE_GEMINI3FLASH_FREE` | ZenMux | `google/gemini-3-flash-preview-free` | Gemini 3 Flash (Free) via ZenMux |
| `ZENMUX_XIAOMI_MIMOV2FLASH` | ZenMux | `xiaomi/mimo-v2-flash` | MiMo-v2-Flash via ZenMux |
| `ZENMUX_XAI_GROK41FAST` | ZenMux | `x-ai/grok-4.1-fast` | Grok-4.1-Fast via ZenMux |
| `ZENMUX_DEEPSEEK_V32` | ZenMux | `deepseek/deepseek-v3.2` | DeepSeek-v3.2 via ZenMux |
| `ZENMUX_MISTRAL_LARGE2512` | ZenMux | `mistralai/mistral-large-2512` | Mistral-Large-2512 via ZenMux |
| `ZENMUX_ZAI_GLM46VFLASH` | ZenMux | `z-ai/glm-4.6v-flash` | GLM-4.6v-Flash via ZenMux |

### 5.3 Preset Definitions (Code)

```typescript
/**
 * Preset definition type
 */
type PresetDefinition = {
  name: string;
  apiProvider: ApiProviderType;
  baseUrl?: string;
  mainModel: string;
  executorModel: string;
};

/**
 * Available presets
 */
export const PRESETS: Record<string, PresetDefinition> = {
  // Anthropic Direct
  ANTHROPIC_CLAUDE_HAIKU: {
    name: "Anthropic Claude Haiku",
    apiProvider: "anthropic",
    mainModel: "claude-haiku-4-5-20251001",
    executorModel: "haiku",
  },
  ANTHROPIC_CLAUDE_SONNET: {
    name: "Anthropic Claude Sonnet",
    apiProvider: "anthropic",
    mainModel: "claude-sonnet-4-5-20250514",
    executorModel: "haiku",
  },

  // ZenMux Presets
  ZENMUX_ZAI_GLM47: {
    name: "ZenMux GLM-4.7",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "z-ai/glm-4.7",
    executorModel: "z-ai/glm-4.7",
  },
  ZENMUX_MINIMAX_M21: {
    name: "ZenMux MiniMax-M2.1",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "minimax/minimax-m2.1",
    executorModel: "minimax/minimax-m2.1",
  },
  ZENMUX_GOOGLE_GEMINI3FLASH: {
    name: "ZenMux Gemini-3-Flash",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "google/gemini-3-flash-preview",
    executorModel: "google/gemini-3-flash-preview",
  },
  ZENMUX_GOOGLE_GEMINI3FLASH_FREE: {
    name: "ZenMux Gemini-3-Flash (Free)",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "google/gemini-3-flash-preview-free",
    executorModel: "google/gemini-3-flash-preview-free",
  },
  ZENMUX_XIAOMI_MIMOV2FLASH: {
    name: "ZenMux MiMo-v2-Flash",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "xiaomi/mimo-v2-flash",
    executorModel: "xiaomi/mimo-v2-flash",
  },
  ZENMUX_XAI_GROK41FAST: {
    name: "ZenMux Grok-4.1-Fast",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "x-ai/grok-4.1-fast",
    executorModel: "x-ai/grok-4.1-fast",
  },
  ZENMUX_DEEPSEEK_V32: {
    name: "ZenMux DeepSeek-v3.2",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "deepseek/deepseek-v3.2",
    executorModel: "deepseek/deepseek-v3.2",
  },
  ZENMUX_MISTRAL_LARGE2512: {
    name: "ZenMux Mistral-Large-2512",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "mistralai/mistral-large-2512",
    executorModel: "mistralai/mistral-large-2512",
  },
  ZENMUX_ZAI_GLM46VFLASH: {
    name: "ZenMux GLM-4.6v-Flash",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "z-ai/glm-4.6v-flash",
    executorModel: "z-ai/glm-4.6v-flash",
  },
};
```

---

## 6. Model Provider Module

### 6.1 File Location

```
packages/provider/src/claude-agent-sdk/model-provider.ts
```

### 6.2 Type Exports

```typescript
export type {
  ApiProviderType,
  LoopliaSettings,
  PresetDefinition,
};

export {
  PRESETS,
  DEFAULT_SETTINGS,
};
```

### 6.3 Core Functions

```typescript
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_FILE = "looplia.setting.json";

/**
 * Get the path to the looplia home directory
 */
export function getLoopliaHome(): string {
  return join(homedir(), ".looplia");
}

/**
 * Get the path to the settings config file
 */
export function getConfigPath(): string {
  return join(getLoopliaHome(), CONFIG_FILE);
}

/**
 * Read looplia settings from disk
 * Returns null if file doesn't exist
 */
export async function readLoopliaSettings(): Promise<LoopliaSettings | null> {
  try {
    const content = await readFile(getConfigPath(), "utf-8");
    return JSON.parse(content) as LoopliaSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Write looplia settings to disk
 */
export async function writeLoopliaSettings(
  settings: LoopliaSettings
): Promise<void> {
  await mkdir(getLoopliaHome(), { recursive: true });
  await writeFile(getConfigPath(), JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * Remove looplia settings file
 */
export async function removeLoopliaSettings(): Promise<void> {
  await rm(getConfigPath(), { force: true });
}

/**
 * Inject looplia settings as environment variables
 * Called before SDK query() invocation
 *
 * IMPORTANT: Only sets env vars if not already set (env vars take precedence)
 *
 * ZenMux API Pattern (per official sample):
 * ```python
 * client = anthropic.Anthropic(
 *     api_key="<ZENMUX_API_KEY>",
 *     base_url="https://zenmux.ai/api/anthropic"
 * )
 * ```
 * So we set ANTHROPIC_API_KEY (not AUTH_TOKEN) for ZenMux/custom providers.
 */
export function injectLoopliaSettingsEnv(settings: LoopliaSettings): void {
  // For non-anthropic providers (ZenMux, custom)
  if (settings.apiProvider.type !== "anthropic") {
    // Set API endpoint
    if (settings.apiProvider.baseUrl && !process.env.ANTHROPIC_BASE_URL) {
      process.env.ANTHROPIC_BASE_URL = settings.apiProvider.baseUrl;
    }

    // Set API key (from ZENMUX_API_KEY env var or config file authToken)
    // ZenMux uses api_key parameter, same as Anthropic SDK
    if (!process.env.ANTHROPIC_API_KEY) {
      if (settings.apiProvider.type === "zenmux" && process.env.ZENMUX_API_KEY) {
        process.env.ANTHROPIC_API_KEY = process.env.ZENMUX_API_KEY;
      } else if (settings.apiProvider.authToken) {
        process.env.ANTHROPIC_API_KEY = settings.apiProvider.authToken;
      }
    }
  }

  // Agent models (looplia-specific)
  if (!process.env.LOOPLIA_AGENT_MODEL_MAIN) {
    process.env.LOOPLIA_AGENT_MODEL_MAIN = settings.agents.main;
  }

  if (!process.env.LOOPLIA_AGENT_MODEL_EXECUTOR) {
    process.env.LOOPLIA_AGENT_MODEL_EXECUTOR = settings.agents.executor;
  }
}

/**
 * Display info type for status/show commands
 */
export type SettingsDisplayInfo = {
  status: "configured" | "not-configured";
  preset?: string;
  provider: string;
  authToken?: string;
  agents: {
    main: string;
    executor: string;
  };
};

/**
 * Get display-friendly settings info for status/show commands
 */
export function getSettingsDisplayInfo(
  settings: LoopliaSettings | null
): SettingsDisplayInfo {
  if (!settings) {
    return {
      status: "not-configured",
      provider: "Anthropic (default)",
      agents: {
        main: DEFAULT_SETTINGS.agents.main,
        executor: DEFAULT_SETTINGS.agents.executor,
      },
    };
  }

  const provider =
    settings.apiProvider.type === "anthropic"
      ? "Anthropic (direct)"
      : settings.apiProvider.baseUrl ?? settings.apiProvider.type;

  return {
    status: "configured",
    preset: settings.preset,
    provider,
    authToken: settings.apiProvider.authToken,
    agents: {
      main: settings.agents.main,
      executor: settings.agents.executor,
    },
  };
}

/**
 * Mask an auth token for display (show only last 4 chars)
 */
export function maskAuthToken(token: string): string {
  if (token.length <= 4) {
    return "****";
  }
  return `****${token.slice(-4)}`;
}

/**
 * Apply a preset to create settings
 * Preserves existing authToken if available
 */
export function applyPreset(
  presetName: string,
  existingSettings?: LoopliaSettings | null
): LoopliaSettings {
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  return {
    version: "1.0",
    preset: presetName,
    apiProvider: {
      type: preset.apiProvider,
      baseUrl: preset.baseUrl,
      authToken: existingSettings?.apiProvider.authToken,
    },
    agents: {
      main: preset.mainModel,
      executor: preset.executorModel,
    },
  };
}
```

---

## 7. CLI Commands

### 7.1 Command Structure

```
looplia config provider [subcommand] [args]

Subcommands:
  (none)           Interactive setup wizard
  show             Display current provider configuration
  preset <name>    Apply a provider preset
  set <key> <val>  Set a configuration value
  reset            Remove all provider configuration
```

### 7.2 Key Mappings for `set` Command

| CLI Key | Config Field | Environment Variable |
|---------|--------------|---------------------|
| `api-provider` | `apiProvider.type` | - |
| `base-url` | `apiProvider.baseUrl` | `ANTHROPIC_BASE_URL` |
| `auth-token` | `apiProvider.authToken` | `ANTHROPIC_API_KEY` |
| `main-model` | `agents.main` | `LOOPLIA_AGENT_MODEL_MAIN` |
| `executor-model` | `agents.executor` | `LOOPLIA_AGENT_MODEL_EXECUTOR` |

### 7.3 Command Examples

**Apply a Preset:**
```bash
$ looplia config provider preset ZENMUX_ZAI_GLM47
✓ Applied ZenMux GLM-4.7 preset
  Provider: https://zenmux.ai/api/anthropic
  Main Model: z-ai/glm-4.7
  Executor Model: z-ai/glm-4.7

Note: Set your API key with: looplia config provider set auth-token <your-key>
```

**Direct Set Commands:**
```bash
$ looplia config provider set api-provider zenmux
✓ Set api-provider = zenmux

$ looplia config provider set base-url https://zenmux.ai/api/anthropic
✓ Set base-url = https://zenmux.ai/api/anthropic

$ looplia config provider set auth-token sk-ai-v1-xxx
✓ Set auth-token = ****xxx (masked in output)

$ looplia config provider set main-model z-ai/glm-4.7
✓ Set main-model = z-ai/glm-4.7

$ looplia config provider set executor-model z-ai/glm-4.7
✓ Set executor-model = z-ai/glm-4.7
```

**Show Configuration:**
```bash
$ looplia config provider show

Model Provider Configuration:
  Status: configured
  Preset: ZENMUX_ZAI_GLM47
  Provider: https://zenmux.ai/api/anthropic
  Auth Token: ****xxx

  Agent Models:
    Main: z-ai/glm-4.7
    Executor: z-ai/glm-4.7

  Config file: ~/.looplia/looplia.setting.json
```

**Reset:**
```bash
$ looplia config provider reset
✓ Provider configuration removed
```

### 7.4 Help Output

```
looplia config provider - Configure model provider

Usage:
  looplia config provider              Interactive setup wizard
  looplia config provider show         Display current configuration
  looplia config provider preset <n>   Apply a provider preset
  looplia config provider set <k> <v>  Set a configuration value
  looplia config provider reset        Remove all provider configuration

Available presets:
  ANTHROPIC_CLAUDE_HAIKU           Anthropic Claude Haiku (default)
  ANTHROPIC_CLAUDE_SONNET          Anthropic Claude Sonnet
  ZENMUX_ZAI_GLM47                 ZenMux GLM-4.7
  ZENMUX_ZAI_GLM46VFLASH           ZenMux GLM-4.6v-Flash
  ZENMUX_MINIMAX_M21               ZenMux MiniMax-M2.1
  ZENMUX_GOOGLE_GEMINI3FLASH       ZenMux Gemini-3-Flash
  ZENMUX_GOOGLE_GEMINI3FLASH_FREE  ZenMux Gemini-3-Flash (Free)
  ZENMUX_XIAOMI_MIMOV2FLASH        ZenMux MiMo-v2-Flash
  ZENMUX_XAI_GROK41FAST            ZenMux Grok-4.1-Fast
  ZENMUX_DEEPSEEK_V32              ZenMux DeepSeek-v3.2
  ZENMUX_MISTRAL_LARGE2512         ZenMux Mistral-Large-2512

Configuration keys for 'set':
  api-provider     Provider type: anthropic, zenmux, custom
  base-url         API base URL (for zenmux/custom)
  auth-token       Authentication token (fallback if env var not set)
  main-model       Model for main agent
  executor-model   Model for skill executor

Examples:
  looplia config provider preset ZENMUX_ZAI_GLM47
  looplia config provider set auth-token sk-ai-v1-xxx
  looplia config provider show
```

---

## 8. Environment Injection

### 8.1 When Injection Happens

Environment variables are injected at the **start of each query execution**, before the SDK `query()` call:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           QUERY EXECUTION FLOW                                │
└──────────────────────────────────────────────────────────────────────────────┘

  looplia run writing-kit
         │
         ▼
  ┌──────────────────────────┐
  │ 1. Read settings file    │ ← readLoopliaSettings()
  │    ~/.looplia/looplia.   │
  │    setting.json          │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ 2. Inject env vars       │ ← injectLoopliaSettingsEnv(settings)
  │    (if not already set)  │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ 3. Read agent models     │ ← Read from LOOPLIA_AGENT_MODEL_*
  │    from env vars         │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ 4. Call SDK query()      │ ← Pass models to SDK
  │    with agent models     │
  └──────────────────────────┘
```

### 8.2 Environment Variable Mapping

| Setting Field | Environment Variable | Purpose |
|---------------|---------------------|---------|
| `apiProvider.baseUrl` | `ANTHROPIC_BASE_URL` | API endpoint for SDK |
| `apiProvider.authToken` | `ANTHROPIC_API_KEY` | API key for SDK |
| `agents.main` | `LOOPLIA_AGENT_MODEL_MAIN` | Main agent model ID |
| `agents.executor` | `LOOPLIA_AGENT_MODEL_EXECUTOR` | Skill executor model ID |

### 8.3 API Key Pattern

ZenMux uses the standard Anthropic SDK pattern with `api_key` parameter:

```python
# ZenMux official sample
client = anthropic.Anthropic(
    api_key="<ZENMUX_API_KEY>",
    base_url="https://zenmux.ai/api/anthropic"
)
```

| Provider | User Sets | Looplia Injects |
|----------|-----------|-----------------|
| `anthropic` | `ANTHROPIC_API_KEY` | (no action - SDK reads directly) |
| `zenmux` | `ZENMUX_API_KEY` | → `ANTHROPIC_API_KEY` |
| `custom` | CLI `set auth-token` | → `ANTHROPIC_API_KEY` |

**Example `.env` file:**
```bash
# API Keys - set the ones you need
ANTHROPIC_API_KEY=sk-ant-api03-xxx    # For Anthropic (direct)
ZENMUX_API_KEY=sk-ai-v1-xxx           # For ZenMux (auto-mapped)
```

**Usage:**
```bash
# Just select preset and run - API key auto-mapped!
looplia config provider preset ZENMUX_ZAI_GLM47
looplia run writing-kit  # Uses ZENMUX_API_KEY automatically
```

**Priority Order for API Key:**
1. `ANTHROPIC_API_KEY` env var (if already set by user)
2. Provider-specific env var (`ZENMUX_API_KEY` for zenmux)
3. Config file `authToken` value (from CLI `set auth-token` command)

### 8.4 Complete Injection Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         API KEY INJECTION FLOW (v0.6.6)                         │
└─────────────────────────────────────────────────────────────────────────────────┘

                          ┌─────────────────────────────┐
                          │         .env file           │
                          │                             │
                          │  ANTHROPIC_API_KEY=sk-ant.. │ ─────┐
                          │  ZENMUX_API_KEY=sk-ai-v1... │ ─┐   │
                          └─────────────────────────────┘  │   │
                                                           │   │
         Loaded at shell startup                           │   │
                    │                                      │   │
                    ▼                                      │   │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              process.env (shell)                                │
│                                                                                 │
│  ANTHROPIC_API_KEY ───────────────────────────────────────────────────────────┐ │
│  ZENMUX_API_KEY ─────────────────────────────────────────────────────────┐    │ │
└──────────────────────────────────────────────────────────────────────────│────│─┘
                                                                           │    │
   ╔═══════════════════════════════════════════════════════════════════════│════│═╗
   ║                                                                       │    │ ║
   ║                        looplia run writing-kit                        │    │ ║
   ║                                                                       │    │ ║
   ╚═══════════════════════════════════════════════════════════════════════│════│═╝
                    │                                                      │    │
                    ▼                                                      │    │
   ┌────────────────────────────────────────┐                              │    │
   │ 1. readLoopliaSettings()               │                              │    │
   │    ~/.looplia/looplia.setting.json     │                              │    │
   │                                        │                              │    │
   │    {                                   │                              │    │
   │      "preset": "ZENMUX_ZAI_GLM47",     │                              │    │
   │      "apiProvider": {                  │                              │    │
   │        "type": "zenmux",  ◄────────────│──────────────────────────────┤    │
   │        "baseUrl": "https://zenmux..."  │                              │    │
   │      },                                │                              │    │
   │      "agents": {                       │                              │    │
   │        "main": "z-ai/glm-4.7",         │                              │    │
   │        "executor": "z-ai/glm-4.7"      │                              │    │
   │      }                                 │                              │    │
   │    }                                   │                              │    │
   └───────────────────┬────────────────────┘                              │    │
                       │                                                   │    │
                       ▼                                                   │    │
   ┌────────────────────────────────────────────────────────────────────────────┐
   │ 2. injectLoopliaSettingsEnv(settings)                                      │
   │                                                                            │
   │    if (type === "zenmux" && ZENMUX_API_KEY exists) {  ◄───────────────────┤│
   │        ANTHROPIC_API_KEY = ZENMUX_API_KEY    ──────────────────────┐     ││
   │    }                                                               │     ││
   │                                                                    │     ││
   │    ANTHROPIC_BASE_URL = settings.apiProvider.baseUrl              │     ││
   │    LOOPLIA_AGENT_MODEL_MAIN = settings.agents.main                │     ││
   │    LOOPLIA_AGENT_MODEL_EXECUTOR = settings.agents.executor        │     ││
   └────────────────────────────────────────────────────────────────────│─────│┘
                       │                                                │     │
                       ▼                                                │     │
┌───────────────────────────────────────────────────────────────────────│─────│─┐
│                         process.env (after injection)                 │     │ │
│                                                                       │     │ │
│  ANTHROPIC_API_KEY = sk-ai-v1... (from ZENMUX_API_KEY or authToken) ◄─┴─────┘ │
│  ANTHROPIC_BASE_URL = https://zenmux.ai/api/anthropic                         │
│  LOOPLIA_AGENT_MODEL_MAIN = z-ai/glm-4.7                                      │
│  LOOPLIA_AGENT_MODEL_EXECUTOR = z-ai/glm-4.7                                  │
└───────────────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │ 3. Read models from env vars                                               │
   │                                                                            │
   │    mainModel = process.env.LOOPLIA_AGENT_MODEL_MAIN     → "z-ai/glm-4.7"   │
   │    executorModel = process.env.LOOPLIA_AGENT_MODEL_EXECUTOR → "z-ai/glm-4.7│
   └───────────────────┬────────────────────────────────────────────────────────┘
                       │
                       ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │ 4. Claude Agent SDK query()                                                │
   │                                                                            │
   │    query({                                                                 │
   │      options: {                                                            │
   │        model: "z-ai/glm-4.7",            ◄── mainModel                     │
   │        agents: {                                                           │
   │          "skill-executor": {                                               │
   │            model: "z-ai/glm-4.7"         ◄── executorModel                 │
   │          }                                                                 │
   │        }                                                                   │
   │      }                                                                     │
   │    })                                                                      │
   │                                                                            │
   │    SDK reads: ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY internally              │
   └────────────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
               ┌───────────────┐
               │   ZenMux API  │
               │  (or Anthropic)│
               └───────────────┘
```

**Code References:**
- Step 1-2: `query-executor.ts:135-137`
- Auto-mapping logic: `model-provider.ts:219-226`
- Model reading: `query-executor.ts:141-145`
- SDK call: `query-executor.ts:188-237`

### 8.5 Precedence Implementation

```typescript
// Only inject if not already set in environment
if (!process.env.LOOPLIA_AGENT_MODEL_MAIN) {
  process.env.LOOPLIA_AGENT_MODEL_MAIN = settings.agents.main;
}
```

This ensures:
1. User shell config (`~/.bashrc`) takes priority
2. CI/CD environment variables take priority
3. Per-command overrides work: `LOOPLIA_AGENT_MODEL_MAIN=... looplia run`

---

## 9. Query Executor Integration

### 9.1 File Location

```
packages/provider/src/claude-agent-sdk/streaming/query-executor.ts
```

### 9.2 Integration Changes

```typescript
import {
  readLoopliaSettings,
  injectLoopliaSettingsEnv,
  DEFAULT_SETTINGS,
} from "../model-provider";

export async function* executeAgenticQueryStreaming<T>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  config?: ClaudeAgentConfig
): AsyncGenerator<StreamingEvent, AgenticQueryResult<T>> {
  // ... existing setup ...

  // v0.6.6: Load and inject settings before SDK call
  const settings = await readLoopliaSettings();
  if (settings) {
    injectLoopliaSettingsEnv(settings);
  }

  // v0.6.6: Read agent models from environment (injected above or set by user)
  const mainModel =
    process.env.LOOPLIA_AGENT_MODEL_MAIN ?? DEFAULT_SETTINGS.agents.main;
  const executorModel =
    process.env.LOOPLIA_AGENT_MODEL_EXECUTOR ?? DEFAULT_SETTINGS.agents.executor;

  // ... rest of setup ...

  const result = query({
    prompt,
    options: {
      model: mainModel,  // v0.6.6: Use configured main model
      // ... other options ...
      agents: {
        "skill-executor": {
          description: "...",
          prompt: skillExecutorPrompt,
          tools: [...],
          model: executorModel,  // v0.6.6: Use configured executor model
        },
      },
    },
  });

  // ... rest of implementation ...
}
```

---

## 10. Implementation Guide

### 10.1 Implementation Order

| Step | Task | Dependencies |
|------|------|--------------|
| 1 | Refactor `model-provider.ts` to new schema | None |
| 2 | Update exports in `index.ts` | Step 1 |
| 3 | Update `query-executor.ts` for agent models | Steps 1-2 |
| 4 | Update CLI `config.ts` with new commands | Steps 1-2 |
| 5 | Update `.env.example` with documentation | None |
| 6 | Run build and fix any errors | All steps |

### 10.2 Migration Notes

**Clean Break:** v0.6.6 uses a new config file (`looplia.setting.json`). The old `model-provider.json` file is no longer used and can be safely deleted.

### 10.3 Key Implementation Notes

1. **File I/O**: Use async fs operations consistently
2. **Error Handling**: Gracefully handle missing config file (return null, not error)
3. **Token Security**: Mask auth tokens in all console output
4. **Validation**: Validate provider types and model strings

---

## 11. File Changes Summary

### 11.1 Files to Modify

| File | Changes |
|------|---------|
| `packages/provider/src/claude-agent-sdk/model-provider.ts` | Refactor to new `LoopliaSettings` schema, add presets |
| `packages/provider/src/claude-agent-sdk/index.ts` | Export new types and functions |
| `packages/provider/src/claude-agent-sdk/streaming/query-executor.ts` | Read agent models from env vars |
| `apps/cli/src/commands/config.ts` | Update provider subcommand with new keys |
| `.env.example` | Document new environment variables |

### 11.2 New Environment Variables

```bash
# API Keys (looplia auto-maps based on provider)
ANTHROPIC_API_KEY=sk-ant-api03-xxx    # For Anthropic (direct)
ZENMUX_API_KEY=sk-ai-v1-xxx           # For ZenMux (auto-mapped to ANTHROPIC_API_KEY)

# Looplia Agent Models (v0.6.6)
# These override the settings file when set
LOOPLIA_AGENT_MODEL_MAIN=z-ai/glm-4.7
LOOPLIA_AGENT_MODEL_EXECUTOR=z-ai/glm-4.7
```

---

## Cross-References

- **Local Plugin Loading (v0.6.5):** See [DESIGN-0.6.5.md](./DESIGN-0.6.5.md)
- **Agent SDK Documentation:** See [AGENT-SDK.md](./AGENT-SDK.md)
- **ZenMux Integration:** https://zenmux.ai

---

*This document serves as the single source of truth for Looplia-Core v0.6.6 Model Provider Configuration architecture.*
