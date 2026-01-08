/**
 * Registry Module (v0.7.1)
 *
 * Skill Registry System for discovery and installation.
 *
 * v0.7.1 Change: compileRegistry() now accepts localOnly option.
 * Build command uses localOnly=true (no remote fetching).
 *
 * @see docs/DESIGN-0.7.1.md
 */

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
  CORE_SKILLS,
  ensureWorkflowSkills,
  findSkill,
  getAvailableSkills,
  getInstalledSkills,
  getSkillsByCategory,
  getSkillsBySource,
  installMarketplaceSkill,
  installSkill,
  installSkillFromUrl,
  installThirdPartySkill,
  isCoreSkill,
  loadCompiledRegistry,
  removeSkill,
  updateSkill,
} from "./loader";
export type { ProgressIndicator } from "./progress";
export { createProgress, withProgress } from "./progress";
