/**
 * Skill Installer (v0.7.1)
 *
 * Provides selective plugin loading based on workflow skill requirements.
 * - Core skills are always loaded
 * - Workflow skills are loaded on demand
 * - Third-party skills are installed from git
 *
 * @see docs/DESIGN-0.7.1.md
 */

import { exec } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import type { InstallResult } from "@looplia-core/core";
import { DEFAULT_MARKETPLACE_SOURCES } from "../registry/compiler";
import { isValidGitUrl, pathExists } from "../utils/fs";
import { getPluginPaths } from "./index";

const execAsync = promisify(exec);

/**
 * Marketplace.json structure from skill marketplace repos
 *
 * Two formats:
 * 1. Anthropic style: plugins have `skills` arrays grouping related skills
 * 2. ComposioHQ style: each plugin IS a single skill (source points to skill dir)
 */
type MarketplacePlugin = {
  name: string;
  description: string;
  source: string;
  category?: string;
  strict?: boolean;
  skills?: string[]; // Anthropic style: ["./skills/xlsx", "./skills/pdf"]
};

type MarketplaceManifest = {
  name: string;
  owner?: { name: string; email: string };
  metadata?: { description: string; version: string };
  plugins: MarketplacePlugin[];
};

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
 * Options for creating plugin structure
 */
type CreatePluginOptions = {
  pluginDir: string;
  plugin: { name: string; description: string };
  marketplace: { name: string; url: string };
};

/**
 * Create plugin directory structure and write plugin.json
 */
async function createPluginStructure(opts: CreatePluginOptions): Promise<void> {
  const { pluginDir, plugin, marketplace } = opts;

  await mkdir(join(pluginDir, ".claude-plugin"), { recursive: true });
  await mkdir(join(pluginDir, "skills"), { recursive: true });

  const pluginJson = {
    name: plugin.name,
    description: plugin.description,
    source: { marketplace: marketplace.name, url: marketplace.url },
  };
  await writeFile(
    join(pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify(pluginJson, null, 2)
  );
}

/**
 * Copy skills into plugin directory based on marketplace format
 */
async function copyPluginSkills(
  plugin: MarketplacePlugin,
  tempDir: string,
  pluginDir: string
): Promise<void> {
  if (plugin.skills?.length) {
    // Anthropic style: copy each skill from skills array
    for (const skillPath of plugin.skills) {
      const skillName = basename(skillPath);
      const srcPath = join(tempDir, skillPath);
      const destPath = join(pluginDir, "skills", skillName);
      if (await pathExists(srcPath)) {
        await cp(srcPath, destPath, { recursive: true });
      }
    }
  } else {
    // ComposioHQ style: source IS the skill, copy as skill named after plugin
    const srcPath = join(tempDir, plugin.source);
    const destPath = join(pluginDir, "skills", plugin.name);
    if (await pathExists(srcPath)) {
      await cp(srcPath, destPath, { recursive: true });
    }
  }
}

/**
 * Options for installing a marketplace plugin
 */
type InstallPluginOptions = {
  plugin: MarketplacePlugin;
  tempDir: string;
  pluginsDir: string;
  marketplace: { name: string; url: string };
};

/**
 * Install a single plugin from marketplace entry
 */
async function installMarketplacePlugin(
  opts: InstallPluginOptions
): Promise<InstallResult> {
  const { plugin, tempDir, pluginsDir, marketplace } = opts;
  const pluginDir = join(pluginsDir, plugin.name);

  try {
    await createPluginStructure({ pluginDir, plugin, marketplace });
    await copyPluginSkills(plugin, tempDir, pluginDir);

    return { skill: plugin.name, status: "installed", path: pluginDir };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { skill: plugin.name, status: "failed", error: message };
  }
}

/**
 * Install a marketplace source by creating one plugin per plugins[] entry
 *
 * Unified handling for both marketplace formats:
 * - Anthropic: entry has `skills` array → copy those skills into plugin
 * - ComposioHQ: entry has no `skills` → copy `source` dir as single skill
 */
async function installMarketplaceSource(
  source: { name: string; url: string; description: string },
  tempDir: string,
  pluginsDir: string
): Promise<InstallResult[]> {
  const marketplacePath = join(tempDir, ".claude-plugin", "marketplace.json");
  if (!(await pathExists(marketplacePath))) {
    return [];
  }

  const marketplaceContent = await readFile(marketplacePath, "utf-8");
  const manifest = JSON.parse(marketplaceContent) as MarketplaceManifest;
  const marketplace = { name: manifest.name, url: source.url };

  const results: InstallResult[] = [];
  for (const plugin of manifest.plugins) {
    const result = await installMarketplacePlugin({
      plugin,
      tempDir,
      pluginsDir,
      marketplace,
    });
    results.push(result);
  }

  return results;
}

/**
 * Install all default marketplace sources during looplia init
 *
 * Uses embedded DEFAULT_MARKETPLACE_SOURCES config and:
 * 1. Clones repos to temp, splits by marketplace.json plugins
 * 2. Creates separate plugin folders for selective loading
 * 3. Generates registry/sources.json entries
 *
 * @returns Install results for each source
 */
export async function installDefaultSources(): Promise<InstallResult[]> {
  const loopliaPath = process.env.LOOPLIA_HOME ?? join(homedir(), ".looplia");
  const pluginsDir = join(loopliaPath, "plugins");
  const registryDir = join(loopliaPath, "registry");

  await mkdir(pluginsDir, { recursive: true });
  await mkdir(registryDir, { recursive: true });

  // Type for source entry in sources.json
  type SourceEntry = {
    id: string;
    type: string;
    url: string;
    enabled: boolean;
    priority: number;
    addedAt: string;
  };

  // Type for parallel install results
  type SourceInstallResult = {
    results: InstallResult[];
    sourceEntry?: SourceEntry;
  };

  // Install all sources in parallel for faster initialization
  const installPromises = DEFAULT_MARKETPLACE_SOURCES.map(
    async (source): Promise<SourceInstallResult> => {
      // Clone to temp directory first to detect structure
      const tempDir = join(tmpdir(), `looplia-${source.name}-${Date.now()}`);

      try {
        // Security: Validate git URL before shell execution
        if (!isValidGitUrl(source.url)) {
          return {
            results: [
              {
                skill: source.name,
                status: "failed",
                error: `Invalid or untrusted git URL: ${source.url}`,
              },
            ],
          };
        }

        // Clone to temp
        await execAsync(`git clone --depth 1 "${source.url}" "${tempDir}"`);

        // Check if it's a marketplace (has marketplace.json)
        const marketplacePath = join(
          tempDir,
          ".claude-plugin",
          "marketplace.json"
        );
        const hasMarketplace = await pathExists(marketplacePath);

        let installResults: InstallResult[];

        if (hasMarketplace) {
          // Split marketplace into separate plugins
          installResults = await installMarketplaceSource(
            source,
            tempDir,
            pluginsDir
          );
        } else {
          // Regular plugin - copy as-is
          const targetPath = join(pluginsDir, source.name);
          await cp(tempDir, targetPath, { recursive: true });
          installResults = [
            {
              skill: source.name,
              status: "installed",
              path: targetPath,
            },
          ];
        }

        return {
          results: installResults,
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
          results: [
            {
              skill: source.name,
              status: "failed",
              error: message,
            },
          ],
        };
      } finally {
        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true }).catch(() => {
          // Ignore cleanup errors
        });
      }
    }
  );

  // Wait for all parallel installs to complete
  const installResults = await Promise.all(installPromises);

  // Collect results and source entries
  const results: InstallResult[] = [];
  const sourceEntries: SourceEntry[] = [];

  for (const { results: pluginResults, sourceEntry } of installResults) {
    results.push(...pluginResults);
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
