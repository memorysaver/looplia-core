/**
 * Registry Domain Types (v0.7.0)
 *
 * Defines the structure for the Skill Registry System, including:
 * - Remote registry manifest (hosted on GitHub releases)
 * - Registry source configuration
 * - Compiled registry cache
 *
 * Inspired by shadcn/ui's registry pattern for skill discovery and installation.
 *
 * @see docs/DESIGN-0.7.0.md
 */

/**
 * Skill category for filtering and organization
 */
export type SkillCategory =
  | "analysis" // media-reviewer, plugin-registry-scanner
  | "generation" // idea-synthesis, writing-enhancer
  | "assembly" // writing-kit-assembler, content-documenter
  | "validation" // workflow-validator
  | "search" // search
  | "orchestration" // workflow-executor, workflow-schema-composer
  | "utility"; // id-generator, user-profile-reader

/**
 * File included in a skill package
 */
export type SkillFile = {
  /** Relative path within skill directory */
  path: string; // "SKILL.md", "scripts/validate.ts"

  /** File type */
  type: "skill:definition" | "skill:script" | "skill:template" | "skill:schema";
};

/**
 * Single skill entry in registry manifest
 */
export type RegistrySkillItem = {
  /** Unique skill identifier (kebab-case) */
  name: string; // "media-reviewer"

  /** Skill type classification */
  type: "registry:skill";

  /** Human-readable title */
  title: string; // "Media Reviewer"

  /** Skill description (from SKILL.md frontmatter) */
  description: string;

  /** Author or plugin source */
  author: string; // "looplia-writer"

  /** Plugin this skill belongs to */
  plugin: string; // "looplia-writer"

  /** Skill category for filtering */
  category: SkillCategory;

  /** Inferred capabilities (from pattern matching) */
  capabilities: string[];

  /** Tools this skill uses (from SKILL.md tools: field) */
  tools?: string[];

  /** Model override if specified */
  model?: string;

  /** Whether skill can run without input files */
  inputless?: boolean;

  /** Dependencies on other skills */
  registryDependencies?: string[];

  /** Remote download URL for this skill */
  downloadUrl: string;

  /** SHA256 checksum for verification */
  checksum?: string;

  /** Files included in this skill */
  files: SkillFile[];
};

/**
 * Remote registry manifest (hosted on GitHub releases)
 * Similar to shadcn/ui's registry.json
 */
export type RemoteRegistryManifest = {
  /** Schema version for compatibility checking */
  $schema: string; // "https://looplia.com/schema/registry.json"

  /** Registry name identifier */
  name: string; // "looplia-official"

  /** Registry homepage/repo URL */
  homepage: string; // "https://github.com/memorysaver/looplia-core"

  /** Semantic version of registry */
  version: string; // "0.7.0"

  /** When registry was last updated */
  updatedAt: string; // ISO timestamp

  /** Available skills in this registry */
  items: RegistrySkillItem[];
};

/**
 * Registry source types
 */
export type RegistrySource = {
  /** Unique source identifier */
  id: string; // "official", "github:user/repo"

  /** Source type */
  type: "official" | "github" | "local";

  /** URL or path */
  url: string; // GitHub URL for third-party: "github.com/user/looplia-my-skills"

  /** Whether this source is enabled */
  enabled: boolean;

  /** Priority for deduplication (higher = preferred) */
  priority: number;

  /** When this source was added */
  addedAt: string; // ISO timestamp
};

/**
 * Compiled skill entry - enriched with local installation status
 */
export type CompiledSkill = {
  /** Unique skill name */
  name: string;

  /** Display title */
  title: string;

  /** Skill description */
  description: string;

  /** Plugin source */
  plugin: string;

  /** Category */
  category: SkillCategory;

  /** Capabilities for matching */
  capabilities: string[];

  /** Tools used */
  tools?: string[];

  /** Model override */
  model?: string;

  /** Input-less capable */
  inputless?: boolean;

  /** Source registry ID */
  source: string; // "official", "github:user/repo"

  /** Determines installation strategy */
  sourceType: "builtin" | "thirdparty";

  /** Whether installed locally */
  installed: boolean;

  /** Local installation path if installed */
  installedPath?: string;

  /** Remote git URL for third-party */
  gitUrl?: string;

  /** Checksum for integrity */
  checksum?: string;

  /** Dependencies */
  dependencies?: string[];
};

/**
 * Local compiled registry - aggregated from all sources
 * Used by build command for skill discovery
 */
export type CompiledRegistry = {
  /** When this cache was compiled */
  compiledAt: string; // ISO timestamp

  /** Version of registry format */
  version: string; // "1.0.0"

  /** Sources that were compiled */
  sources: RegistrySource[];

  /** All skills from all sources (deduplicated) */
  skills: CompiledSkill[];

  /** Summary statistics */
  summary: {
    totalSkills: number;
    byCategory: Record<SkillCategory, number>;
    bySource: Record<string, number>;
  };
};

/**
 * Result of skill installation
 */
export type InstallResult = {
  /** Skill name */
  skill: string;

  /** Installation status */
  status: "installed" | "updated" | "already_installed" | "failed";

  /** Installation path */
  path?: string;

  /** Error message if failed */
  error?: string;
};

/**
 * Result of ensuring workflow skills are installed
 */
export type EnsureSkillsResult = {
  /** Whether all required skills are ready */
  ready: boolean;

  /** Successfully installed skills */
  installed: InstallResult[];

  /** Skills that failed to install */
  failed: string[];
};
