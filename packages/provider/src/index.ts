/**
 * @looplia-core/provider
 *
 * Real provider implementations for Looplia Core.
 *
 * Prefer using subpath imports for tree-shaking:
 * @example
 * ```typescript
 * import { ensureWorkspace } from "@looplia-core/provider/claude-agent-sdk";
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
export { ensureWorkspace } from "./claude-agent-sdk/index";
// Re-export streaming types
export type { StreamingEvent } from "./claude-agent-sdk/streaming/types";
// Re-export registry module (v0.7.0)
export {
  addSource,
  compileRegistry,
  CORE_SKILLS,
  ensureWorkflowSkills,
  findSkill,
  getAvailableSkills,
  getCompiledRegistryPath,
  getInstalledSkills,
  getRegistryPath,
  getSkillsByCategory,
  getSkillsBySource,
  getSourcesPath,
  initializeRegistry,
  installSkill,
  isCoreSkill,
  loadCompiledRegistry,
  loadSources,
  removeSource,
  saveSources,
  updateSkill,
} from "./registry/index";
