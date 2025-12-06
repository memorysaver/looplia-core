import type { ProviderResult } from "@looplia-core/core";

/**
 * Configuration options for Claude Agent SDK providers
 */
export type ClaudeAgentConfig = {
  /** Model to use (default: claude-haiku-4-5-20251001) */
  model?: string;

  /** API key (default: ANTHROPIC_API_KEY env) */
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
  timeout: 60000,
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
