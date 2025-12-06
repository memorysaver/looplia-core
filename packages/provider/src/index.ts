/**
 * @looplia-core/provider
 *
 * Real provider implementations for Looplia Core.
 *
 * @example
 * ```typescript
 * // Import Claude Agent SDK provider
 * import { createClaudeProviders } from "@looplia-core/provider/claude-agent-sdk";
 *
 * // Or import from main entry point
 * import { ClaudeAgentSDK } from "@looplia-core/provider";
 * const providers = ClaudeAgentSDK.createClaudeProviders();
 * ```
 */

// Re-export Claude Agent SDK module as namespace
export * as ClaudeAgentSDK from "./claude-agent-sdk/index";

// Re-export common types from config
export type {
  ClaudeAgentConfig,
  ProviderUsage,
  ProviderResultWithUsage,
} from "./claude-agent-sdk/config";
