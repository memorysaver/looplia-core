/**
 * Looplia Settings Configuration
 *
 * Enables model provider switching via CLI configuration.
 * Stores settings in ~/.looplia/looplia.setting.json and injects as
 * environment variables before SDK calls.
 *
 * @see https://github.com/memorysaver/looplia-core/docs/DESIGN-0.6.6.md
 */

import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * API provider types
 */
export type ApiProviderType = "anthropic" | "zenmux" | "custom";

/**
 * Looplia settings configuration
 * Stored at ~/.looplia/looplia.setting.json
 */
export type LoopliaSettings = {
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
     * API key for proxy providers (injected as ANTHROPIC_API_KEY)
     * Note: Stored in plain text. Users responsible for file permissions.
     * @example "sk-ai-v1-xxx"
     */
    authToken?: string;

    /**
     * Auth token source for subscription-based authentication
     * When set to "subscription", uses Claude Code subscription OAuth token
     * (from CLAUDE_CODE_OAUTH_TOKEN env var - must be set manually)
     */
    authTokenSource?: AuthTokenSource;
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
     * Model for executor agent (reserved for future use)
     * v0.6.9: Currently unused - using built-in general-purpose subagent
     * (injected as LOOPLIA_AGENT_MODEL_EXECUTOR)
     * @example "z-ai/glm-4.7" or "haiku"
     */
    executor: string;
  };
};

/**
 * Auth token source type
 * - "subscription": Use Claude Code subscription OAuth token
 *   (from CLAUDE_CODE_OAUTH_TOKEN env var - must be set manually)
 */
export type AuthTokenSource = "subscription";

/**
 * Preset definition type
 */
export type PresetDefinition = {
  name: string;
  apiProvider: ApiProviderType;
  baseUrl?: string;
  /**
   * Auth token source for subscription-based presets
   * When set to "subscription", uses Claude Code OAuth token
   */
  authTokenSource?: AuthTokenSource;
  mainModel: string;
  executorModel: string;
  haikuModel: string;
  sonnetModel: string;
  opusModel: string;
};

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: LoopliaSettings = {
  version: "1.0",
  apiProvider: {
    type: "anthropic",
  },
  agents: {
    main: "claude-haiku-4-5-20251001",
    executor: "claude-haiku-4-5-20251001",
  },
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
    executorModel: "claude-haiku-4-5-20251001",
    haikuModel: "claude-haiku-4-5-20251001",
    sonnetModel: "claude-haiku-4-5-20251001",
    opusModel: "claude-haiku-4-5-20251001",
  },
  ANTHROPIC_CLAUDE_SONNET: {
    name: "Anthropic Claude Sonnet",
    apiProvider: "anthropic",
    mainModel: "claude-sonnet-4-5-20250929",
    executorModel: "claude-sonnet-4-5-20250929",
    haikuModel: "claude-sonnet-4-5-20250929",
    sonnetModel: "claude-sonnet-4-5-20250929",
    opusModel: "claude-sonnet-4-5-20250929",
  },

  // Claude Code Subscription (macOS Keychain)
  CLAUDE_CODE_SUBSCRIPTION_HAIKU: {
    name: "Claude Code Subscription (Haiku)",
    apiProvider: "anthropic",
    authTokenSource: "subscription",
    mainModel: "claude-haiku-4-5-20251001",
    executorModel: "claude-haiku-4-5-20251001",
    haikuModel: "claude-haiku-4-5-20251001",
    sonnetModel: "claude-haiku-4-5-20251001",
    opusModel: "claude-haiku-4-5-20251001",
  },
  CLAUDE_CODE_SUBSCRIPTION_SONNET: {
    name: "Claude Code Subscription (Sonnet)",
    apiProvider: "anthropic",
    authTokenSource: "subscription",
    mainModel: "claude-sonnet-4-5-20250929",
    executorModel: "claude-sonnet-4-5-20250929",
    haikuModel: "claude-sonnet-4-5-20250929",
    sonnetModel: "claude-sonnet-4-5-20250929",
    opusModel: "claude-sonnet-4-5-20250929",
  },
  CLAUDE_CODE_SUBSCRIPTION_OPUS: {
    name: "Claude Code Subscription (Opus)",
    apiProvider: "anthropic",
    authTokenSource: "subscription",
    mainModel: "claude-opus-4-5-20251101",
    executorModel: "claude-opus-4-5-20251101",
    haikuModel: "claude-opus-4-5-20251101",
    sonnetModel: "claude-opus-4-5-20251101",
    opusModel: "claude-opus-4-5-20251101",
  },

  // ZenMux Presets
  ZENMUX_ANTHROPIC_HAIKU45: {
    name: "ZenMux Claude Haiku 4.5",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "anthropic/claude-haiku-4.5",
    executorModel: "anthropic/claude-haiku-4.5",
    haikuModel: "anthropic/claude-haiku-4.5",
    sonnetModel: "anthropic/claude-haiku-4.5",
    opusModel: "anthropic/claude-haiku-4.5",
  },
  ZENMUX_ZAI_GLM47: {
    name: "ZenMux GLM-4.7",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "z-ai/glm-4.7",
    executorModel: "z-ai/glm-4.7",
    haikuModel: "z-ai/glm-4.7",
    sonnetModel: "z-ai/glm-4.7",
    opusModel: "z-ai/glm-4.7",
  },
  ZENMUX_MINIMAX_M21: {
    name: "ZenMux MiniMax-M2.1",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "minimax/minimax-m2.1",
    executorModel: "minimax/minimax-m2.1",
    haikuModel: "minimax/minimax-m2.1",
    sonnetModel: "minimax/minimax-m2.1",
    opusModel: "minimax/minimax-m2.1",
  },
  ZENMUX_GOOGLE_GEMINI3FLASH: {
    name: "ZenMux Gemini-3-Flash",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "google/gemini-3-flash-preview",
    executorModel: "google/gemini-3-flash-preview",
    haikuModel: "google/gemini-3-flash-preview",
    sonnetModel: "google/gemini-3-flash-preview",
    opusModel: "google/gemini-3-flash-preview",
  },
  ZENMUX_GOOGLE_GEMINI3FLASH_FREE: {
    name: "ZenMux Gemini-3-Flash (Free)",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "google/gemini-3-flash-preview-free",
    executorModel: "google/gemini-3-flash-preview-free",
    haikuModel: "google/gemini-3-flash-preview-free",
    sonnetModel: "google/gemini-3-flash-preview-free",
    opusModel: "google/gemini-3-flash-preview-free",
  },
  ZENMUX_XIAOMI_MIMOV2FLASH: {
    name: "ZenMux MiMo-v2-Flash",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "xiaomi/mimo-v2-flash",
    executorModel: "xiaomi/mimo-v2-flash",
    haikuModel: "xiaomi/mimo-v2-flash",
    sonnetModel: "xiaomi/mimo-v2-flash",
    opusModel: "xiaomi/mimo-v2-flash",
  },
  ZENMUX_XAI_GROK41FAST: {
    name: "ZenMux Grok-4.1-Fast",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "x-ai/grok-4.1-fast",
    executorModel: "x-ai/grok-4.1-fast",
    haikuModel: "x-ai/grok-4.1-fast",
    sonnetModel: "x-ai/grok-4.1-fast",
    opusModel: "x-ai/grok-4.1-fast",
  },
  ZENMUX_DEEPSEEK_V32: {
    name: "ZenMux DeepSeek-v3.2",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "deepseek/deepseek-v3.2",
    executorModel: "deepseek/deepseek-v3.2",
    haikuModel: "deepseek/deepseek-v3.2",
    sonnetModel: "deepseek/deepseek-v3.2",
    opusModel: "deepseek/deepseek-v3.2",
  },
  ZENMUX_DEEPSEEK_REASONER: {
    name: "ZenMux DeepSeek-Reasoner",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "deepseek/deepseek-reasoner",
    executorModel: "deepseek/deepseek-reasoner",
    haikuModel: "deepseek/deepseek-reasoner",
    sonnetModel: "deepseek/deepseek-reasoner",
    opusModel: "deepseek/deepseek-reasoner",
  },
  ZENMUX_VOLCENGINE_DOUBAO_SEED: {
    name: "ZenMux Doubao-Seed-1.8",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "volcengine/doubao-seed-1.8",
    executorModel: "volcengine/doubao-seed-1.8",
    haikuModel: "volcengine/doubao-seed-1.8",
    sonnetModel: "volcengine/doubao-seed-1.8",
    opusModel: "volcengine/doubao-seed-1.8",
  },
  ZENMUX_MISTRAL_LARGE2512: {
    name: "ZenMux Mistral-Large-2512",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "mistralai/mistral-large-2512",
    executorModel: "mistralai/mistral-large-2512",
    haikuModel: "mistralai/mistral-large-2512",
    sonnetModel: "mistralai/mistral-large-2512",
    opusModel: "mistralai/mistral-large-2512",
  },
  ZENMUX_ZAI_GLM46VFLASH: {
    name: "ZenMux GLM-4.6v-Flash",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "z-ai/glm-4.6v-flash",
    executorModel: "z-ai/glm-4.6v-flash",
    haikuModel: "z-ai/glm-4.6v-flash",
    sonnetModel: "z-ai/glm-4.6v-flash",
    opusModel: "z-ai/glm-4.6v-flash",
  },
  ZENMUX_ZAI_GLM46V: {
    name: "ZenMux GLM-4.6v",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "z-ai/glm-4.6v",
    executorModel: "z-ai/glm-4.6v",
    haikuModel: "z-ai/glm-4.6v",
    sonnetModel: "z-ai/glm-4.6v",
    opusModel: "z-ai/glm-4.6v",
  },
  ZENMUX_OPENAI_GPT51CODEXMINI: {
    name: "ZenMux GPT-5.1 Codex Mini",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "openai/gpt-5.1-codex-mini",
    executorModel: "openai/gpt-5.1-codex-mini",
    haikuModel: "openai/gpt-5.1-codex-mini",
    sonnetModel: "openai/gpt-5.1-codex-mini",
    opusModel: "openai/gpt-5.1-codex-mini",
  },
};

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
  const configPath = getConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content) as LoopliaSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // Handle corrupted JSON - backup and return null
    if (error instanceof SyntaxError) {
      const backupPath = `${configPath}.corrupted`;
      await rm(backupPath, { force: true });
      await rename(configPath, backupPath);
      console.warn(
        `Config file corrupted, backed up to ${backupPath}. Using defaults.`
      );
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
  const configPath = getConfigPath();
  await mkdir(getLoopliaHome(), { recursive: true });
  await writeFile(configPath, JSON.stringify(settings, null, 2), "utf-8");
  // Enforce restrictive permissions (owner read/write only)
  await chmod(configPath, 0o600);
}

/**
 * Remove looplia settings file
 */
export async function removeLoopliaSettings(): Promise<void> {
  await rm(getConfigPath(), { force: true });
}

/**
 * Set environment variable if not already set
 */
function setEnvIfNotSet(key: string, value: string): void {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

/**
 * Inject model tier environment variables
 * All tiers default to the main agent model
 */
function injectModelTierEnv(mainModel: string, executorModel: string): void {
  // Model tier defaults (Claude Agent SDK uses these)
  setEnvIfNotSet("ANTHROPIC_DEFAULT_HAIKU_MODEL", mainModel);
  setEnvIfNotSet("ANTHROPIC_DEFAULT_SONNET_MODEL", mainModel);
  setEnvIfNotSet("ANTHROPIC_DEFAULT_OPUS_MODEL", mainModel);

  // Agent models (looplia-specific)
  setEnvIfNotSet("LOOPLIA_AGENT_MODEL_MAIN", mainModel);
  setEnvIfNotSet("LOOPLIA_AGENT_MODEL_EXECUTOR", executorModel);
}

/**
 * Inject OAuth token for Claude Code subscription
 *
 * Why clear ANTHROPIC_API_KEY?
 * The Claude Agent SDK checks env vars in this order:
 *   1. ANTHROPIC_API_KEY (direct API key)
 *   2. CLAUDE_CODE_OAUTH_TOKEN (subscription OAuth token)
 *
 * If ANTHROPIC_API_KEY exists (even empty/invalid), SDK uses it first.
 * By clearing it, we ensure the subscription OAuth token is used.
 *
 * SDK Logging Note:
 * When using OAuth token, SDK logs `apiKeySource: "none"` because
 * ANTHROPIC_API_KEY is not set. This is expected behavior - "none"
 * means the SDK is using CLAUDE_CODE_OAUTH_TOKEN (subscription auth).
 *
 * Usage: Set CLAUDE_CODE_OAUTH_TOKEN environment variable manually.
 * On macOS, you can extract it from Keychain:
 *   security find-generic-password -s "Claude Code-credentials" -w | jq -r '.claudeAiOauth.accessToken'
 */
function injectSubscriptionAuth(): void {
  // Clear ANTHROPIC_API_KEY so SDK falls back to CLAUDE_CODE_OAUTH_TOKEN
  // User must set CLAUDE_CODE_OAUTH_TOKEN manually
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.warn(
      "Warning: CLAUDE_CODE_OAUTH_TOKEN not set. " +
        "Set this environment variable to use Claude Code subscription auth."
    );
  }
  process.env.ANTHROPIC_API_KEY = undefined;
}

/**
 * Inject API configuration for non-Anthropic providers (ZenMux, custom)
 */
function injectNonAnthropicProviderEnv(
  apiProvider: LoopliaSettings["apiProvider"]
): void {
  // Set API endpoint (only if not already set in env)
  if (apiProvider.baseUrl && !process.env.ANTHROPIC_BASE_URL) {
    process.env.ANTHROPIC_BASE_URL = apiProvider.baseUrl;
  }

  // API key selection: settings file authToken takes priority
  if (apiProvider.authToken) {
    process.env.ANTHROPIC_API_KEY = apiProvider.authToken;
    return;
  }

  // Fallback: endpoint-specific env var (ZenMux)
  const isZenmuxEndpoint =
    apiProvider.type === "zenmux" || apiProvider.baseUrl?.includes("zenmux.ai");

  if (isZenmuxEndpoint && process.env.ZENMUX_API_KEY) {
    process.env.ANTHROPIC_API_KEY = process.env.ZENMUX_API_KEY;
  }
  // For custom endpoints: ANTHROPIC_API_KEY is used as-is (no override needed)
}

/**
 * Inject looplia settings as environment variables
 * Called before SDK query() invocation
 *
 * API Key Priority:
 * 1. Subscription auth (CLAUDE_CODE_OAUTH_TOKEN env var)
 * 2. Settings file authToken (user explicitly configured via CLI)
 * 3. Endpoint-specific env var (ZENMUX_API_KEY for ZenMux endpoint)
 * 4. Generic ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN
 *
 * ZenMux API Pattern (per official sample):
 * ```python
 * client = anthropic.Anthropic(
 *     api_key="<ZENMUX_API_KEY>",
 *     base_url="https://zenmux.ai/api/anthropic"
 * )
 * ```
 */
export function injectLoopliaSettingsEnv(settings: LoopliaSettings): void {
  // Subscription auth (CLAUDE_CODE_OAUTH_TOKEN env var)
  if (settings.apiProvider.authTokenSource === "subscription") {
    injectSubscriptionAuth();
  }

  // For non-anthropic providers (ZenMux, custom)
  if (settings.apiProvider.type !== "anthropic") {
    injectNonAnthropicProviderEnv(settings.apiProvider);
  }

  injectModelTierEnv(settings.agents.main, settings.agents.executor);
}

/**
 * Display info type for status/show commands
 */
export type SettingsDisplayInfo = {
  status: "configured" | "not-configured";
  preset?: string;
  provider: string;
  authToken?: string;
  authTokenSource?: AuthTokenSource;
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
      : (settings.apiProvider.baseUrl ?? settings.apiProvider.type);

  return {
    status: "configured",
    preset: settings.preset,
    provider,
    authToken: settings.apiProvider.authToken,
    authTokenSource: settings.apiProvider.authTokenSource,
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
      authTokenSource: preset.authTokenSource,
    },
    agents: {
      main: preset.mainModel,
      executor: preset.executorModel,
    },
  };
}
