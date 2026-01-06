/**
 * Skill Installer (v0.7.0)
 *
 * Provides selective plugin loading based on workflow skill requirements.
 * - Core skills are always loaded
 * - Workflow skills are loaded on demand
 * - Third-party skills are installed from git
 *
 * @see docs/DESIGN-0.7.0.md
 */

import { exec } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { InstallResult } from "@looplia-core/core";
import { isValidGitUrl, pathExists } from "../utils/fs";
import { getPluginPaths } from "./index";

/**
 * Default sources configuration type
 */
type DefaultSourcesConfig = {
  sources: Array<{
    name: string;
    url: string;
    description?: string;
  }>;
};

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

/**
 * Get path to default-sources.json config
 * Resolves from project root where .claude-plugin/ lives
 */
function getDefaultSourcesPath(): string {
  // Use import.meta.dir for Bun, fallback to __dirname pattern
  const currentDir =
    typeof import.meta.dir === "string"
      ? import.meta.dir
      : join(homedir(), ".looplia"); // Fallback

  // Navigate from src/bootstrap/ → project root → .claude-plugin/
  // Path: packages/provider/src/bootstrap/ → ../../../../.claude-plugin/
  return join(
    currentDir,
    "..",
    "..",
    "..",
    "..",
    ".claude-plugin",
    "default-sources.json"
  );
}

/**
 * Install all default marketplace sources during looplia init
 *
 * Reads from .claude-plugin/default-sources.json and:
 * 1. Clones repos to ~/.looplia/plugins/{name}/
 * 2. Generates registry/sources.json entries
 *
 * @returns Install results for each source
 */
export async function installDefaultSources(): Promise<InstallResult[]> {
  const loopliaPath = process.env.LOOPLIA_HOME ?? join(homedir(), ".looplia");
  const pluginsDir = join(loopliaPath, "plugins");
  const registryDir = join(loopliaPath, "registry");

  await mkdir(pluginsDir, { recursive: true });
  await mkdir(registryDir, { recursive: true });

  // Read default sources config
  const configPath = getDefaultSourcesPath();
  let config: DefaultSourcesConfig;
  try {
    const content = await readFile(configPath, "utf-8");
    config = JSON.parse(content);
  } catch {
    // Config not found - return empty (graceful degradation)
    return [];
  }

  // Type for parallel install results
  type SourceInstallResult = {
    result: InstallResult;
    sourceEntry?: {
      id: string;
      type: string;
      url: string;
      enabled: boolean;
      priority: number;
      addedAt: string;
    };
  };

  // Install all sources in parallel for faster initialization
  const installPromises = config.sources.map(
    async (source): Promise<SourceInstallResult> => {
      const targetPath = join(pluginsDir, source.name);

      try {
        if (await pathExists(targetPath)) {
          // Already cloned - do git pull
          await execAsync("git pull", { cwd: targetPath });
          return {
            result: {
              skill: source.name,
              status: "updated",
              path: targetPath,
            },
            sourceEntry: {
              id: `github:${source.name}`,
              type: "github",
              url: source.url,
              enabled: true,
              priority: 50,
              addedAt: new Date().toISOString(),
            },
          };
        }

        // Security: Validate git URL before shell execution
        if (!isValidGitUrl(source.url)) {
          return {
            result: {
              skill: source.name,
              status: "failed",
              error: `Invalid or untrusted git URL: ${source.url}`,
            },
          };
        }

        // Clone the repository
        await execAsync(`git clone "${source.url}" "${targetPath}"`);
        return {
          result: {
            skill: source.name,
            status: "installed",
            path: targetPath,
          },
          sourceEntry: {
            id: `github:${source.name}`,
            type: "github",
            url: source.url,
            enabled: true,
            priority: 50,
            addedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          result: {
            skill: source.name,
            status: "failed",
            error: message,
          },
        };
      }
    }
  );

  // Wait for all parallel installs to complete
  const installResults = await Promise.all(installPromises);

  // Collect results and source entries
  const results: InstallResult[] = [];
  const sourceEntries: SourceInstallResult["sourceEntry"][] = [];

  for (const { result, sourceEntry } of installResults) {
    results.push(result);
    if (sourceEntry) {
      sourceEntries.push(sourceEntry);
    }
  }

  // Write sources.json with all configured sources
  if (sourceEntries.length > 0) {
    const sourcesPath = join(registryDir, "sources.json");
    await writeFile(sourcesPath, JSON.stringify(sourceEntries, null, 2));
  }

  return results;
}
