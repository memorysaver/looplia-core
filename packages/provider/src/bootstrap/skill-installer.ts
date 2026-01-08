/**
 * Skill Installer (v0.7.1)
 *
 * Provides selective plugin loading based on workflow skill requirements.
 * - Core skills are always loaded
 * - Workflow skills are loaded on demand
 * - Third-party skills are installed from git
 *
 * v0.7.1: installDefaultSources() removed - now uses syncRegistrySources()
 * from registry/sync.ts for unified installation flow.
 *
 * @see docs/DESIGN-0.7.1.md section 7.6
 */

import { exec } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { InstallResult } from "@looplia-core/core";
import { isValidGitUrl, pathExists } from "../utils/fs";
import { getPluginPaths } from "./index";

const execAsync = promisify(exec);

// Top-level regex patterns for URL normalization
const PROTOCOL_REGEX = /^https?:\/\//;
const TRAILING_SLASH_REGEX = /\/$/;
const SLASH_TO_DASH_REGEX = /\//g;

/**
 * Core skills that are always loaded regardless of workflow
 */
export const CORE_SKILLS = [
  "workflow-executor",
  "workflow-executor-inline",
  "workflow-validator",
  "registry-loader",
];

/**
 * Build mapping of skill name to plugin path
 */
async function buildSkillPluginMap(
  pluginPaths: Array<{ type: "local"; path: string }>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const { path: pluginPath } of pluginPaths) {
    const skillsDir = join(pluginPath, "skills");
    if (!(await pathExists(skillsDir))) {
      continue;
    }

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          map.set(entry.name, pluginPath);
        }
      }
    } catch {
      // Ignore errors reading skills directory
    }
  }

  return map;
}

/**
 * Get plugin paths with selective skill loading
 *
 * @param requiredSkills - Skills required by the workflow
 * @returns Plugin paths filtered to only include required skills
 */
export async function getSelectivePluginPaths(
  requiredSkills?: string[]
): Promise<Array<{ type: "local"; path: string }>> {
  const allPluginPaths = await getPluginPaths();

  if (!requiredSkills || requiredSkills.length === 0) {
    // No filtering - load all (backward compatibility)
    return allPluginPaths;
  }

  // Combine core skills with required skills
  const neededSkills = new Set([...CORE_SKILLS, ...requiredSkills]);

  // Build skill-to-plugin mapping
  const skillToPlugin = await buildSkillPluginMap(allPluginPaths);

  // Determine which plugins to load
  const pluginsToLoad = new Set<string>();
  for (const skill of neededSkills) {
    const pluginPath = skillToPlugin.get(skill);
    if (pluginPath) {
      pluginsToLoad.add(pluginPath);
    }
  }

  // Return filtered plugin paths
  return allPluginPaths.filter((p) => pluginsToLoad.has(p.path));
}

/**
 * Install a third-party plugin from git
 *
 * @param gitUrl - Git repository URL (e.g., "github.com/user/looplia-my-skills")
 * @param skillName - Optional skill name for result reporting
 */
export async function installThirdPartyPlugin(
  gitUrl: string,
  skillName?: string
): Promise<InstallResult> {
  const loopliaPath = join(homedir(), ".looplia");
  const pluginsDir = join(loopliaPath, "plugins");
  await mkdir(pluginsDir, { recursive: true });

  // Extract repo name for local folder
  const repoName = gitUrl
    .replace(PROTOCOL_REGEX, "")
    .replace("github.com/", "")
    .replace(TRAILING_SLASH_REGEX, "")
    .replace(SLASH_TO_DASH_REGEX, "-");

  const targetPath = join(pluginsDir, repoName);

  try {
    if (await pathExists(targetPath)) {
      // Already cloned - do git pull
      await execAsync("git pull", { cwd: targetPath });
      return {
        skill: skillName ?? repoName,
        status: "updated",
        path: targetPath,
      };
    }

    // Clone the repository
    const fullUrl = gitUrl.startsWith("http") ? gitUrl : `https://${gitUrl}`;

    // Security: Validate git URL before shell execution
    if (!isValidGitUrl(fullUrl)) {
      return {
        skill: skillName ?? repoName,
        status: "failed",
        error: `Invalid or untrusted git URL: ${fullUrl}`,
      };
    }

    await execAsync(`git clone "${fullUrl}" "${targetPath}"`);

    return {
      skill: skillName ?? repoName,
      status: "installed",
      path: targetPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      skill: skillName ?? repoName,
      status: "failed",
      error: message,
    };
  }
}

/**
 * Check if a skill is a core skill
 */
export function isCoreSkill(skillName: string): boolean {
  return CORE_SKILLS.includes(skillName);
}

/**
 * Get all skills available in a plugin
 */
export async function getPluginSkills(pluginPath: string): Promise<string[]> {
  const skillsDir = join(pluginPath, "skills");
  if (!(await pathExists(skillsDir))) {
    return [];
  }

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
