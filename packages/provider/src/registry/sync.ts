/**
 * Registry Sync (v0.7.1)
 *
 * Unified source synchronization - the SINGLE function that handles
 * downloading/updating registry sources to local plugins directory.
 *
 * This replaces:
 * - skill-installer.ts:installDefaultSources() for bootstrap
 * - loader.ts:installMarketplaceSkill() for JIT installation
 *
 * @see docs/DESIGN-0.7.1.md section 7
 */

import { exec } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import type { InstallResult, RegistrySource } from "@looplia-core/core";
import { isValidGitUrl, isValidPathSegment, pathExists } from "../utils/fs";
import { loadSources } from "./compiler";
import { createProgress } from "./progress";
import {
  FRONTMATTER_REGEX,
  PROTOCOL_REGEX,
  TRAILING_SLASH_REGEX,
} from "./utils";

const execAsync = promisify(exec);

/** Result of syncing a single source */
export type SyncResult = {
  source: RegistrySource;
  status: "synced" | "updated" | "failed" | "skipped";
  plugins: InstallResult[];
  error?: string;
};

/** Options for syncing registry sources */
export type SyncOptions = {
  /** Show progress indicators */
  showProgress?: boolean;
  /** Only sync specific source IDs (default: all enabled) */
  sourcesToSync?: string[];
  /** Force re-download even if already exists */
  force?: boolean;
  /** Skill path for selective extraction (marketplace skills) */
  skillPath?: string;
};

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

// Maximum depth for searching SKILL.md files
const MAX_SKILL_SEARCH_DEPTH = 5;

/**
 * Get the looplia home directory path
 */
function getLoopliaHome(): string {
  return process.env.LOOPLIA_HOME ?? join(homedir(), ".looplia");
}

/**
 * Get the plugins directory path
 */
function getPluginsDir(): string {
  return join(getLoopliaHome(), "plugins");
}

/**
 * Find SKILL.md location in repository using recursive search
 * Returns the directory containing SKILL.md at the shallowest depth
 */
async function findSkillMdPath(repoPath: string): Promise<string | null> {
  async function searchDir(
    dirPath: string,
    depth: number,
    maxDepth: number
  ): Promise<string | null> {
    if (depth > maxDepth) {
      return null;
    }

    const entries = await readdir(dirPath, { withFileTypes: true }).catch(
      () => []
    );

    // Check for SKILL.md in current directory
    const hasSkillMd = entries.some((e) => e.isFile() && e.name === "SKILL.md");
    if (hasSkillMd) {
      return dirPath;
    }

    // Search subdirectories
    const subdirs = entries.filter(
      (e) =>
        e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules"
    );

    for (const subdir of subdirs) {
      const found = await searchDir(
        join(dirPath, subdir.name),
        depth + 1,
        maxDepth
      );
      if (found) {
        return found;
      }
    }

    return null;
  }

  return await searchDir(repoPath, 0, MAX_SKILL_SEARCH_DEPTH);
}

/**
 * Extract skill name from SKILL.md frontmatter
 */
async function extractSkillName(skillMdDir: string): Promise<string> {
  try {
    const content = await readFile(join(skillMdDir, "SKILL.md"), "utf-8");
    const match = content.match(FRONTMATTER_REGEX);

    if (match?.[1]) {
      const lines = match[1].split("\n");
      for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();
          if (key === "name" && value) {
            return value;
          }
        }
      }
    }
  } catch {
    // Fall through to basename
  }

  return basename(skillMdDir);
}

/**
 * Check if repository has valid Claude Code plugin structure
 */
async function isValidPluginStructure(repoPath: string): Promise<boolean> {
  const claudePluginDir = join(repoPath, ".claude-plugin");
  const pluginJsonPath = join(claudePluginDir, "plugin.json");
  const marketplaceJsonPath = join(claudePluginDir, "marketplace.json");

  return (
    (await pathExists(pluginJsonPath)) ||
    (await pathExists(marketplaceJsonPath))
  );
}

/**
 * Check if repository has marketplace.json
 */
async function hasMarketplaceJson(repoPath: string): Promise<boolean> {
  return await pathExists(join(repoPath, ".claude-plugin", "marketplace.json"));
}

/**
 * Create plugin directory structure and write plugin.json
 */
async function createPluginStructure(opts: {
  pluginDir: string;
  plugin: { name: string; description: string };
  marketplace: { name: string; url: string };
}): Promise<void> {
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
 * Wrap a standalone skill as a valid Claude Code plugin
 */
async function wrapSkillAsPlugin(
  skillPath: string,
  skillName: string,
  targetPath: string,
  originalUrl: string
): Promise<void> {
  // Security: Validate skill name to prevent path traversal
  if (!isValidPathSegment(skillName)) {
    throw new Error(
      `Invalid skill name: "${skillName}" - contains path traversal characters`
    );
  }

  // Create plugin directory structure
  await mkdir(join(targetPath, ".claude-plugin"), { recursive: true });
  const skillTargetDir = join(targetPath, "skills", skillName);
  await mkdir(skillTargetDir, { recursive: true });

  // Copy skill contents
  await cp(skillPath, skillTargetDir, { recursive: true });

  // Generate plugin.json
  const pluginJson = {
    name: skillName,
    version: "1.0.0",
    description: `Auto-wrapped skill from ${originalUrl}`,
    source: {
      type: "auto-wrapped",
      originalUrl,
      wrappedAt: new Date().toISOString(),
    },
  };
  await writeFile(
    join(targetPath, ".claude-plugin", "plugin.json"),
    JSON.stringify(pluginJson, null, 2)
  );
}

/**
 * Install a marketplace source by splitting into separate plugins
 */
async function installMarketplaceSource(
  tempDir: string,
  source: RegistrySource,
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
    const pluginDir = join(pluginsDir, plugin.name);

    try {
      await createPluginStructure({ pluginDir, plugin, marketplace });
      await copyPluginSkills(plugin, tempDir, pluginDir);
      results.push({
        skill: plugin.name,
        status: "installed",
        path: pluginDir,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ skill: plugin.name, status: "failed", error: message });
    }
  }

  return results;
}

/**
 * Install a standard plugin (has plugin.json, copy as-is)
 */
async function installPluginSource(
  tempDir: string,
  source: RegistrySource,
  pluginsDir: string
): Promise<InstallResult> {
  const repoName = source.url
    .replace(PROTOCOL_REGEX, "")
    .replace("github.com/", "")
    .replace(TRAILING_SLASH_REGEX, "")
    .replace(/\//g, "-");

  const targetPath = join(pluginsDir, repoName);

  if (await pathExists(targetPath)) {
    return {
      skill: repoName,
      status: "already_installed",
      path: targetPath,
    };
  }

  await cp(tempDir, targetPath, { recursive: true });
  return {
    skill: repoName,
    status: "installed",
    path: targetPath,
  };
}

/**
 * Install a standalone skill (has SKILL.md, auto-wrap as plugin)
 */
async function installStandaloneSkill(
  _tempDir: string,
  source: RegistrySource,
  pluginsDir: string,
  skillMdDir: string
): Promise<InstallResult> {
  const extractedName = await extractSkillName(skillMdDir);
  const targetPath = join(pluginsDir, extractedName);

  if (await pathExists(targetPath)) {
    return {
      skill: extractedName,
      status: "already_installed",
      path: targetPath,
    };
  }

  await wrapSkillAsPlugin(skillMdDir, extractedName, targetPath, source.url);

  return {
    skill: extractedName,
    status: "installed",
    path: targetPath,
  };
}

/**
 * Install a skill from a specific path within a marketplace (JIT installation)
 */
async function installSkillFromPath(
  tempDir: string,
  source: RegistrySource,
  pluginsDir: string,
  skillPath: string
): Promise<InstallResult> {
  const skillSourcePath = join(tempDir, skillPath);
  if (!(await pathExists(skillSourcePath))) {
    return {
      skill: skillPath,
      status: "failed",
      error: `Path not found in marketplace: ${skillPath}`,
    };
  }

  const skillMdDir = await findSkillMdPath(skillSourcePath);
  if (!skillMdDir) {
    return {
      skill: skillPath,
      status: "failed",
      error: `No SKILL.md found at ${skillPath}`,
    };
  }

  const extractedName = await extractSkillName(skillMdDir);
  const targetPath = join(pluginsDir, extractedName);

  if (await pathExists(targetPath)) {
    return {
      skill: extractedName,
      status: "already_installed",
      path: targetPath,
    };
  }

  await wrapSkillAsPlugin(
    skillMdDir,
    extractedName,
    targetPath,
    `${source.url}/${skillPath}`
  );

  return {
    skill: extractedName,
    status: "installed",
    path: targetPath,
  };
}

/**
 * Detect format and install source from temp directory
 * Extracted to reduce cognitive complexity of syncSource
 */
async function detectAndInstallSource(
  tempDir: string,
  source: RegistrySource,
  pluginsDir: string,
  progress: ReturnType<typeof createProgress> | null
): Promise<SyncResult> {
  // Check for marketplace.json first
  if (await hasMarketplaceJson(tempDir)) {
    progress?.start("Installing marketplace plugins");
    const results = await installMarketplaceSource(tempDir, source, pluginsDir);
    const installed = results.filter((r) => r.status === "installed").length;
    progress?.succeed(`Installed ${installed} plugins from ${source.id}`);
    return { source, status: "synced", plugins: results };
  }

  // Check for valid plugin structure
  if (await isValidPluginStructure(tempDir)) {
    progress?.start("Installing plugin");
    const result = await installPluginSource(tempDir, source, pluginsDir);
    progress?.succeed(`Installed ${result.skill}`);
    return {
      source,
      status: result.status === "installed" ? "synced" : "skipped",
      plugins: [result],
    };
  }

  // Fallback: Find SKILL.md and auto-wrap
  progress?.start("Analyzing structure");
  const skillMdDir = await findSkillMdPath(tempDir);

  if (!skillMdDir) {
    progress?.fail("No plugin structure or SKILL.md found");
    return {
      source,
      status: "failed",
      plugins: [],
      error: "No .claude-plugin/plugin.json or SKILL.md found in repository",
    };
  }

  progress?.start("Auto-wrapping as plugin");
  const result = await installStandaloneSkill(
    tempDir,
    source,
    pluginsDir,
    skillMdDir
  );
  progress?.succeed(`Installed ${result.skill} (auto-wrapped)`);
  return {
    source,
    status: result.status === "installed" ? "synced" : "skipped",
    plugins: [result],
  };
}

/**
 * Sync a single registry source
 *
 * @param source - The source to sync
 * @param options - Sync options
 */
export async function syncSource(
  source: RegistrySource,
  options?: Omit<SyncOptions, "sourcesToSync">
): Promise<SyncResult> {
  const {
    showProgress = false,
    force: _force = false,
    skillPath,
  } = options ?? {};
  const progress = showProgress ? createProgress() : null;
  const pluginsDir = getPluginsDir();

  await mkdir(pluginsDir, { recursive: true });

  // Security: Validate git URL before shell execution
  if (!isValidGitUrl(source.url)) {
    return {
      source,
      status: "failed",
      plugins: [],
      error: `Invalid or untrusted git URL: ${source.url}`,
    };
  }

  // Use source id in temp dir name to avoid race conditions when syncing in parallel
  const safeSourceId = source.id.replace(/[^a-zA-Z0-9-]/g, "-");
  const tempDir = join(tmpdir(), `looplia-sync-${safeSourceId}-${Date.now()}`);

  try {
    // Clone repository
    progress?.start(`Cloning ${source.id}`);
    await execAsync(`git clone --depth 1 "${source.url}" "${tempDir}"`);
    progress?.succeed(`Cloned ${source.id}`);

    // If skillPath is specified, do selective extraction (JIT installation)
    if (skillPath) {
      progress?.start(`Installing skill: ${skillPath}`);
      const result = await installSkillFromPath(
        tempDir,
        source,
        pluginsDir,
        skillPath
      );
      progress?.succeed(`Installed ${result.skill}`);

      return {
        source,
        status: result.status === "installed" ? "synced" : "skipped",
        plugins: [result],
      };
    }

    // Detect format and install using extracted helper
    return await detectAndInstallSource(tempDir, source, pluginsDir, progress);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress?.fail(`Failed to sync ${source.id}`);
    return {
      source,
      status: "failed",
      plugins: [],
      error: message,
    };
  } finally {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    });
  }
}

/**
 * Sync all enabled registry sources to local plugins directory
 *
 * This is the SINGLE function that handles downloading/updating sources:
 * 1. Read sources.json for enabled sources
 * 2. For each source, clone or update the repository
 * 3. Detect format and install appropriately:
 *    - marketplace.json: Split into separate plugin directories
 *    - plugin.json: Copy as-is
 *    - SKILL.md only: Auto-wrap as plugin
 *
 * Called by:
 * - looplia init (initial setup after sources.json created)
 * - looplia registry sync (explicit refresh)
 */
export async function syncRegistrySources(
  options?: SyncOptions
): Promise<SyncResult[]> {
  const { showProgress = false, sourcesToSync, force = false } = options ?? {};
  const progress = showProgress ? createProgress() : null;

  // Load enabled sources
  const allSources = await loadSources();
  const sources = allSources.filter((s) => {
    if (!s.enabled) {
      return false;
    }
    if (sourcesToSync && !sourcesToSync.includes(s.id)) {
      return false;
    }
    return true;
  });

  if (sources.length === 0) {
    progress?.succeed("No sources to sync");
    return [];
  }

  progress?.start(`Syncing ${sources.length} sources`);

  // Sync sources in parallel for faster initialization
  const results = await Promise.all(
    sources.map((source) => syncSource(source, { showProgress: false, force }))
  );

  const successCount = results.filter((r) => r.status === "synced").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  if (failedCount > 0) {
    progress?.warn(
      `Synced ${successCount}/${sources.length} sources (${failedCount} failed)`
    );
  } else {
    progress?.succeed(`Synced ${successCount} sources`);
  }

  return results;
}
