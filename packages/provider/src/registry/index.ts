/**
 * Registry Module (v0.7.1)
 *
 * Skill Registry System for discovery and installation.
 *
 * v0.7.1 Changes:
 * - Single Registry Loop: sources.json → syncRegistrySources() → compileRegistry()
 * - Shared utilities in utils.ts
 * - Unified sync in sync.ts replaces installDefaultSources/installMarketplaceSkill
 *
 * @see docs/DESIGN-0.7.1.md section 7
 */

// v0.7.1: Export directly from skill-installer to avoid barrel file pattern
export { CORE_SKILLS, isCoreSkill } from "../bootstrap/skill-installer";
export type { CompileRegistryOptions } from "./compiler";
export {
  addSource,
  compileRegistry,
  createEmptyManifest,
  DEFAULT_MARKETPLACE_SOURCES,
  getCompiledRegistryPath,
  getRegistryPath,
  getSkillCatalogPath,
  getSourcesPath,
  initializeRegistry,
  loadSources,
  removeSource,
  saveSources,
} from "./compiler";
export type { ChecksumResult, RemoveResult } from "./loader";
export {
  ensureWorkflowSkills,
  findSkill,
  getAvailableSkills,
  getInstalledSkills,
  getSkillsByCategory,
  getSkillsBySource,
  installSkill,
  installSkillFromUrl,
  installThirdPartySkill,
  loadCompiledRegistry,
  removeSkill,
  updateSkill,
} from "./loader";
export type { ProgressIndicator } from "./progress";
export { createProgress, withProgress } from "./progress";
// v0.7.1: Unified sync
export type { SyncOptions, SyncResult } from "./sync";
export { syncRegistrySources, syncSource } from "./sync";
// v0.7.1: Shared utilities
export {
  CAPABILITY_PATTERNS,
  FRONTMATTER_REGEX,
  formatTitle,
  inferCapabilities,
  inferCategory,
  LEADING_DOT_SLASH_REGEX,
  PROTOCOL_REGEX,
  parseMultilineValue,
  parseYamlFrontmatter,
  SLASH_TO_DASH_REGEX,
  TRAILING_SLASH_REGEX,
} from "./utils";
