/**
 * Discovery Module (v0.8.0)
 *
 * Provides skill discovery and auto-installation capabilities.
 */

export {
  ensureAutoDiscoveryPlugin,
  getAutoDiscoveryPluginPath,
  installSkillToAutoDiscovery,
  isSkillAutoDiscovered,
  listAutoDiscoveredSkills,
} from "./auto-discovery-plugin";

export {
  fetchSkillContent,
  type SkillSearchResult,
  searchSkills,
} from "./skills-search";
