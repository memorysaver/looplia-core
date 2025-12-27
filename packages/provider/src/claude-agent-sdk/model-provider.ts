/**
 * Model Provider Configuration
 *
 * Enables ZenMux-style model provider switching via CLI configuration.
 * Stores settings in ~/.looplia/model-provider.json and injects as
 * environment variables before SDK calls.
 *
 * @see https://github.com/memorysaver/looplia-core/docs/DESIGN-0.6.6.md
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

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

/**
 * Default model IDs for each tier
 */
export const DEFAULT_MODELS: Record<ModelTier, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20250514",
  opus: "claude-opus-4-5-20251101",
} as const;

/**
 * Provider presets for one-command setup
 */
export type ProviderPreset = {
  name: string;
  baseUrl: string;
  models: Record<ModelTier, string>;
};

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  zenmux: {
    name: "ZenMux",
    baseUrl: "https://zenmux.ai/api/anthropic",
    models: {
      haiku: "anthropic/claude-haiku-4.5",
      sonnet: "anthropic/claude-sonnet-4.5",
      opus: "anthropic/claude-opus-4.5",
    },
  },
} as const;

const CONFIG_FILE = "model-provider.json";

/**
 * Get the path to the looplia home directory
 */
export function getLoopliaHome(): string {
  return join(homedir(), ".looplia");
}

/**
 * Get the path to the model provider config file
 */
export function getConfigPath(): string {
  return join(getLoopliaHome(), CONFIG_FILE);
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
  await mkdir(getLoopliaHome(), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Remove model provider configuration file
 */
export async function removeModelProviderConfig(): Promise<void> {
  await rm(getConfigPath(), { force: true });
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
    return config.models[tier];
  }

  // 3. Return default
  return DEFAULT_MODELS[tier];
}

/**
 * Display info type for status/show commands
 */
export type ProviderDisplayInfo = {
  status: "enabled" | "disabled" | "not-configured";
  provider: string;
  authToken?: string;
  models: Record<ModelTier, string>;
};

/**
 * Get display-friendly provider info for status/show commands
 */
export function getProviderDisplayInfo(
  config: ModelProviderConfig | null
): ProviderDisplayInfo {
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
    authToken: config.authToken,
    models: {
      haiku: config.models?.haiku ?? DEFAULT_MODELS.haiku,
      sonnet: config.models?.sonnet ?? DEFAULT_MODELS.sonnet,
      opus: config.models?.opus ?? DEFAULT_MODELS.opus,
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
