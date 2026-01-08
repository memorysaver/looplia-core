/**
 * Registry Loader (v0.7.1)
 *
 * Loads compiled registry and manages skill installation.
 * - Load compiled registry from cache
 * - Check skill installation status
 * - Install third-party skills from git (using unified sync.ts)
 * - JIT installation for workflow execution
 *
 * v0.7.1: Uses syncSource() from sync.ts for unified installation logic.
 *
 * @see docs/DESIGN-0.7.1.md section 7.7
 */

import { exec } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  CompiledRegistry,
  CompiledSkill,
  EnsureSkillsResult,
  InstallResult,
  ParsedWorkflow,
  RegistrySource,
} from "@looplia-core/core";
import { extractWorkflowSkills } from "@looplia-core/core";
import { pathExists } from "../utils/fs";
import { compileRegistry, getCompiledRegistryPath } from "./compiler";

const execAsync = promisify(exec);

// Regex patterns for URL parsing (used by installSkillFromUrl)
const GITHUB_FULL_PATTERN =
  /^https?:\/\/github\.com\/([^/]+\/[^/]+)(?:\/tree\/[^/]+\/(.+))?$/;
const GITHUB_SIMPLE_PATTERN =
  /^(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+)\/?$/;

/**
 * Checksum verification result (reserved for future use)
 */
export type ChecksumResult = {
  verified: boolean;
  expected?: string;
  actual?: string;
  method: "sha256" | "git-head" | "skipped";
  message?: string;
};

// v0.7.1: Helper functions (isValidPluginStructure, findSkillMdPath, etc.)
// are now in sync.ts for unified usage

/**
 * Load the compiled registry
 *
 * If registry doesn't exist or is stale, triggers a compilation.
 */
export async function loadCompiledRegistry(
  autoSync = false
): Promise<CompiledRegistry> {
  const compiledPath = getCompiledRegistryPath();

  // Check if compiled registry exists
  if (!(await pathExists(compiledPath))) {
    // No compiled registry - compile now
    return await compileRegistry();
  }

  // If auto-sync requested, recompile
  if (autoSync) {
    return await compileRegistry();
  }

  // Load existing registry
  const content = await readFile(compiledPath, "utf-8");
  return JSON.parse(content) as CompiledRegistry;
}

/**
 * Find a skill in the registry by name
 */
export function findSkill(
  registry: CompiledRegistry,
  skillName: string
): CompiledSkill | undefined {
  return registry.skills.find((s) => s.name === skillName);
}

/**
 * Get all installed skills
 */
export function getInstalledSkills(
  registry: CompiledRegistry
): CompiledSkill[] {
  return registry.skills.filter((s) => s.installed);
}

/**
 * Get all available (not installed) skills
 */
export function getAvailableSkills(
  registry: CompiledRegistry
): CompiledSkill[] {
  return registry.skills.filter((s) => !s.installed);
}

/**
 * Get skills by category
 */
export function getSkillsByCategory(
  registry: CompiledRegistry,
  category: string
): CompiledSkill[] {
  return registry.skills.filter((s) => s.category === category);
}

/**
 * Get skills by source
 */
export function getSkillsBySource(
  registry: CompiledRegistry,
  source: string
): CompiledSkill[] {
  return registry.skills.filter((s) => s.source === source);
}

/**
 * Install a third-party skill from git
 * v0.7.1: Uses unified syncSource() from sync.ts
 *
 * @param skill - The skill to install
 * @param showProgress - Whether to show progress indicators (default: false)
 * @see docs/DESIGN-0.7.1.md section 7.7
 */
export async function installThirdPartySkill(
  skill: CompiledSkill,
  showProgress = false
): Promise<InstallResult> {
  if (!skill.gitUrl) {
    return {
      skill: skill.name,
      status: "failed",
      error: "No git URL available for skill",
    };
  }

  // Create a temporary source for this skill
  const source: RegistrySource = {
    id: `temp:${skill.name}`,
    type: "github",
    url: skill.gitUrl,
    enabled: true,
    priority: 0,
    addedAt: new Date().toISOString(),
  };

  // Use unified sync logic with optional skillPath for selective extraction
  const { syncSource: sync } = await import("./sync");
  const result = await sync(source, {
    showProgress,
    skillPath: skill.skillPath, // For marketplace skills
  });

  // Return first plugin result (single skill install)
  const firstPlugin = result.plugins[0];
  if (firstPlugin) {
    return firstPlugin;
  }

  return {
    skill: skill.name,
    status: "failed",
    error: result.error ?? "Unknown error during installation",
  };
}

/**
 * Install a skill by name
 */
export async function installSkill(
  skillName: string,
  registry?: CompiledRegistry
): Promise<InstallResult> {
  const reg = registry ?? (await loadCompiledRegistry());
  const skill = findSkill(reg, skillName);

  if (!skill) {
    return {
      skill: skillName,
      status: "failed",
      error: `Skill not found in registry: ${skillName}`,
    };
  }

  if (skill.installed) {
    return {
      skill: skillName,
      status: "already_installed",
      path: skill.installedPath,
    };
  }

  if (skill.sourceType === "builtin") {
    // Built-in skills should already be installed
    return {
      skill: skillName,
      status: "failed",
      error:
        "Built-in skill not found in local installation. Run 'looplia init' to reinstall.",
    };
  }

  // Third-party skill - install from git
  return await installThirdPartySkill(skill);
}

/**
 * Update a third-party skill (git pull)
 */
export async function updateSkill(
  skillName: string,
  registry?: CompiledRegistry
): Promise<InstallResult> {
  const reg = registry ?? (await loadCompiledRegistry());
  const skill = findSkill(reg, skillName);

  if (!skill) {
    return {
      skill: skillName,
      status: "failed",
      error: `Skill not found in registry: ${skillName}`,
    };
  }

  if (!(skill.installed && skill.installedPath)) {
    return {
      skill: skillName,
      status: "failed",
      error: "Skill is not installed",
    };
  }

  if (skill.sourceType === "builtin") {
    return {
      skill: skillName,
      status: "failed",
      error: "Cannot update built-in skills. Run 'looplia init' to refresh.",
    };
  }

  try {
    // Find the plugin directory (parent of skills directory)
    const skillsDir = join(skill.installedPath, "..", "..");
    await execAsync("git pull", { cwd: skillsDir });
    return {
      skill: skillName,
      status: "updated",
      path: skill.installedPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      skill: skillName,
      status: "failed",
      error: message,
    };
  }
}

/**
 * Ensure all workflow skills are installed (JIT installation)
 */
export async function ensureWorkflowSkills(
  workflow: ParsedWorkflow,
  registry?: CompiledRegistry
): Promise<EnsureSkillsResult> {
  const reg = registry ?? (await loadCompiledRegistry());
  const requiredSkills = extractWorkflowSkills(workflow);

  const installed: InstallResult[] = [];
  const failed: string[] = [];

  for (const skillName of requiredSkills) {
    const skill = findSkill(reg, skillName);

    if (!skill) {
      failed.push(skillName);
      continue;
    }

    if (skill.installed) {
      continue; // Already installed
    }

    if (skill.sourceType === "builtin") {
      // Built-in skills should always be installed
      failed.push(skillName);
      continue;
    }

    // Third-party skill - install from git
    const result = await installThirdPartySkill(skill);
    if (result.status === "failed") {
      failed.push(skillName);
    } else {
      installed.push(result);
    }
  }

  return {
    ready: failed.length === 0,
    installed,
    failed,
  };
}

// v0.7.1: CORE_SKILLS and isCoreSkill are in bootstrap/skill-installer.ts
// Exported directly from registry/index.ts to avoid barrel file pattern

/**
 * Install a skill from a direct URL (not from catalog)
 * Uses unified syncSource() for installation.
 *
 * Supports:
 * - Full GitHub repo URL: https://github.com/user/repo
 * - Skill path within repo: https://github.com/user/repo/tree/main/skills/name
 *
 * @param url - The URL to install from
 * @param showProgress - Whether to show progress indicators
 */
export async function installSkillFromUrl(
  url: string,
  showProgress = false
): Promise<InstallResult> {
  // Parse URL to extract repo and optional skill path
  const urlParts = parseGitHubUrl(url);
  if (!urlParts) {
    return {
      skill: "unknown",
      status: "failed",
      error: `Invalid GitHub URL: ${url}`,
    };
  }

  const { repoUrl, skillPath } = urlParts;

  // Create a temporary source for this URL
  const source: RegistrySource = {
    id: `url:${url.replace(/[^a-zA-Z0-9]/g, "-")}`,
    type: "github",
    url: repoUrl,
    enabled: true,
    priority: 0,
    addedAt: new Date().toISOString(),
  };

  // Use unified sync logic with optional skillPath for selective extraction
  const { syncSource: sync } = await import("./sync");
  const result = await sync(source, {
    showProgress,
    skillPath,
  });

  // If installation succeeded, recompile registry
  if (result.status === "synced") {
    await compileRegistry();
  }

  // Return first plugin result
  const firstPlugin = result.plugins[0];
  if (firstPlugin) {
    return firstPlugin;
  }

  return {
    skill: "unknown",
    status: "failed",
    error: result.error ?? "Unknown error during installation",
  };
}

/**
 * Parse GitHub URL to extract repo and optional skill path
 */
function parseGitHubUrl(
  url: string
): { repoUrl: string; skillPath?: string } | null {
  // Pattern: https://github.com/user/repo(/tree/branch/path)?
  const match = url.match(GITHUB_FULL_PATTERN);

  if (!match) {
    // Try simple format: github.com/user/repo
    const simpleMatch = url.match(GITHUB_SIMPLE_PATTERN);
    if (simpleMatch?.[1]) {
      return { repoUrl: `https://github.com/${simpleMatch[1]}.git` };
    }
    return null;
  }

  const repo = match[1];
  const path = match[2];

  return {
    repoUrl: `https://github.com/${repo}.git`,
    skillPath: path,
  };
}

// v0.7.1: installMarketplaceSkill is now handled by syncSource() via skillPath option

/**
 * Remove result type
 */
export type RemoveResult = {
  skill: string;
  status: "removed" | "failed";
  path?: string;
  error?: string;
};

/**
 * Remove a third-party skill (delete plugin directory)
 */
export async function removeSkill(
  skillName: string,
  registry?: CompiledRegistry
): Promise<RemoveResult> {
  const reg = registry ?? (await loadCompiledRegistry());
  const skill = findSkill(reg, skillName);

  if (!skill) {
    return {
      skill: skillName,
      status: "failed",
      error: `Skill not found in registry: ${skillName}`,
    };
  }

  if (!skill.installed) {
    return {
      skill: skillName,
      status: "failed",
      error: "Skill is not installed",
    };
  }

  if (skill.sourceType === "builtin") {
    return {
      skill: skillName,
      status: "failed",
      error: "Cannot remove built-in skills",
    };
  }

  if (!skill.installedPath) {
    return {
      skill: skillName,
      status: "failed",
      error: "Skill installation path not found",
    };
  }

  try {
    // The installed path is like ~/.looplia/plugins/repo-name/skills/skill-name
    // We need to remove the plugin directory: ~/.looplia/plugins/repo-name
    const pluginDir = join(skill.installedPath, "..", "..");
    const loopliaPath = join(homedir(), ".looplia");
    const pluginsDir = join(loopliaPath, "plugins");

    // Safety check: only delete if within plugins directory
    if (!pluginDir.startsWith(pluginsDir)) {
      return {
        skill: skillName,
        status: "failed",
        error: "Cannot remove: path is outside plugins directory",
      };
    }

    await rm(pluginDir, { recursive: true, force: true });

    // Recompile registry to update installation status
    await compileRegistry();

    return {
      skill: skillName,
      status: "removed",
      path: pluginDir,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      skill: skillName,
      status: "failed",
      error: message,
    };
  }
}
