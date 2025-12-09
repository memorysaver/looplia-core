import type { ProviderResult } from "@looplia-core/core";

/**
 * Configuration options for Claude Agent SDK providers
 */
export type ClaudeAgentConfig = {
  /** Model to use (default: claude-haiku-4-5-20251001) */
  model?: string;

  /** API key (default: ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN env) */
  apiKey?: string;

  /** Workspace directory (default: ~/.looplia) */
  workspace?: string;

  /** Whether to seed + read filesystem agents/skills (default: true) */
  useFilesystemExtensions?: boolean;

  /** Additional plugins to load */
  plugins?: Array<{ type: "local"; path: string }>;

  /** Custom system prompt (overrides default) */
  systemPrompt?: string;

  /** Custom user prompt template function */
  promptBuilder?: (input: unknown) => string;

  /** Max retries on transient errors (default: 3) */
  maxRetries?: number;

  /** Request timeout in ms (default: 60000) */
  timeout?: number;
};

/**
 * Token and cost usage metrics for a provider call
 */
export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
};

/**
 * Provider result extended with usage metrics
 */
export type ProviderResultWithUsage<T> = ProviderResult<T> & {
  usage?: ProviderUsage;
};

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  model: "claude-haiku-4-5-20251001",
  workspace: "~/.looplia",
  useFilesystemExtensions: true,
  maxRetries: 3,
  timeout: 60_000,
} as const;

/**
 * Resolve configuration with defaults
 */
export function resolveConfig(
  config?: ClaudeAgentConfig
): Required<
  Pick<
    ClaudeAgentConfig,
    "model" | "workspace" | "useFilesystemExtensions" | "maxRetries" | "timeout"
  >
> &
  ClaudeAgentConfig {
  return {
    ...config,
    model: config?.model ?? DEFAULT_CONFIG.model,
    workspace: config?.workspace ?? DEFAULT_CONFIG.workspace,
    useFilesystemExtensions:
      config?.useFilesystemExtensions ?? DEFAULT_CONFIG.useFilesystemExtensions,
    maxRetries: config?.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    timeout: config?.timeout ?? DEFAULT_CONFIG.timeout,
  };
}

/**
 * Validation result for configuration
 */
export type ConfigValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Validate configuration before making API calls
 *
 * @param config - Configuration to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const validation = validateConfig(config);
 * if (!validation.valid) {
 *   console.error("Config errors:", validation.errors);
 * }
 * ```
 */
export function validateConfig(
  config?: ClaudeAgentConfig
): ConfigValidationResult {
  const errors: string[] = [];

  // Check API key (SDK supports both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN)
  const apiKey =
    config?.apiKey ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!apiKey) {
    errors.push(
      "API key is required. Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable, or provide apiKey in config"
    );
  }

  // Validate timeout if provided
  if (config?.timeout !== undefined && config.timeout <= 0) {
    errors.push("Timeout must be a positive number");
  }

  // Validate maxRetries if provided
  if (config?.maxRetries !== undefined && config.maxRetries < 0) {
    errors.push("maxRetries must be non-negative");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
