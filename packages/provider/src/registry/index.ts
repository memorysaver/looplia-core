/**
 * Registry Module (v0.7.0)
 *
 * Skill Registry System for discovery and installation.
 *
 * @see docs/DESIGN-0.7.0.md
 */

export {
  addSource,
  compileRegistry,
  createEmptyManifest,
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
