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
export type { RemoveResult, SyncOptions, SyncResult } from "./registry/index";
// Re-export registry module (v0.7.1)
export {
  addSource,
  CORE_SKILLS,
  compileRegistry,
  ensureWorkflowSkills,
  findSkill,
  getAvailableSkills,
  getCompiledRegistryPath,
  getInstalledSkills,
  getRegistryPath,
  getSkillCatalogPath,
  getSkillsByCategory,
  getSkillsBySource,
  getSourcesPath,
  initializeRegistry,
  installSkill,
  installSkillFromUrl,
  isCoreSkill,
  loadCompiledRegistry,
  loadSources,
  removeSkill,
  removeSource,
  saveSources,
  syncRegistrySources,
  syncSource,
  updateSkill,
} from "./registry/index";
