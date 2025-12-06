/**
 * @looplia-core/provider
 *
 * Real provider implementations for Looplia Core.
 *
 * Prefer using subpath imports for tree-shaking:
 * @example
 * ```typescript
 * import { createClaudeProviders } from "@looplia-core/provider/claude-agent-sdk";
 * ```
 */

// Re-export common types used across providers
export type {
  ClaudeAgentConfig,
  ProviderResultWithUsage,
  ProviderUsage,
} from "./claude-agent-sdk/config";

// Re-export factory functions for convenience
// (prefer subpath import for better tree-shaking)
export {
  createClaudeIdeaGenerator,
  createClaudeOutlineGenerator,
  createClaudeProviders,
  createClaudeSummarizer,
  ensureWorkspace,
} from "./claude-agent-sdk/index";
