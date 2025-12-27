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

/**
 * Preset definition type
 */
export type PresetDefinition = {
  name: string;
  apiProvider: ApiProviderType;
  baseUrl?: string;
  mainModel: string;
  executorModel: string;
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
    executor: "haiku",
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
    executorModel: "haiku",
  },
  ANTHROPIC_CLAUDE_SONNET: {
    name: "Anthropic Claude Sonnet",
    apiProvider: "anthropic",
    mainModel: "claude-sonnet-4-5-20250514",
    executorModel: "haiku",
  },

  // ZenMux Presets
  ZENMUX_ANTHROPIC_HAIKU45: {
    name: "ZenMux Claude Haiku 4.5",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "anthropic/claude-haiku-4.5",
    executorModel: "anthropic/claude-haiku-4.5",
  },
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
  ZENMUX_DEEPSEEK_REASONER: {
    name: "ZenMux DeepSeek-Reasoner",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "deepseek/deepseek-reasoner",
    executorModel: "deepseek/deepseek-reasoner",
  },
  ZENMUX_VOLCENGINE_DOUBAO_SEED: {
    name: "ZenMux Doubao-Seed-1.8",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "volcengine/doubao-seed-1.8",
    executorModel: "volcengine/doubao-seed-1.8",
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
  ZENMUX_ZAI_GLM46V: {
    name: "ZenMux GLM-4.6v",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "z-ai/glm-4.6v",
    executorModel: "z-ai/glm-4.6v",
  },
  ZENMUX_OPENAI_GPT51CODEXMINI: {
    name: "ZenMux GPT-5.1 Codex Mini",
    apiProvider: "zenmux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    mainModel: "openai/gpt-5.1-codex-mini",
    executorModel: "openai/gpt-5.1-codex-mini",
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

    // Set API key for proxy providers
    // For ZenMux: ALWAYS use ZENMUX_API_KEY when available (user explicitly selected ZenMux preset)
    // This overrides any existing ANTHROPIC_API_KEY since we're targeting ZenMux endpoint
    if (settings.apiProvider.type === "zenmux" && process.env.ZENMUX_API_KEY) {
      process.env.ANTHROPIC_API_KEY = process.env.ZENMUX_API_KEY;
    } else if (
      !process.env.ANTHROPIC_API_KEY &&
      settings.apiProvider.authToken
    ) {
      // Fallback to authToken from config if no API key is set
      process.env.ANTHROPIC_API_KEY = settings.apiProvider.authToken;
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
      : (settings.apiProvider.baseUrl ?? settings.apiProvider.type);

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
