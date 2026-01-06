/**
 * Registry Loader (v0.7.0)
 *
 * Loads compiled registry and manages skill installation.
 * - Load compiled registry from cache
 * - Check skill installation status
 * - Install third-party skills from git
 * - JIT installation for workflow execution
 *
 * @see docs/DESIGN-0.7.0.md
 */

import { exec } from "node:child_process";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import type {
  CompiledRegistry,
  CompiledSkill,
  EnsureSkillsResult,
  InstallResult,
  ParsedWorkflow,
} from "@looplia-core/core";
import { extractWorkflowSkills } from "@looplia-core/core";
import { pathExists } from "../utils/fs";
import { compileRegistry, getCompiledRegistryPath } from "./compiler";
import { createProgress } from "./progress";

const execAsync = promisify(exec);

// Top-level regex patterns
const GIT_COMMIT_HASH_REGEX = /^[a-f0-9]{40}$/i;
const PROTOCOL_REGEX = /^https?:\/\//;
const TRAILING_SLASH_REGEX = /\/$/;
const SLASH_TO_DASH_REGEX = /\//g;
const GITHUB_FULL_PATTERN =
  /^https?:\/\/github\.com\/([^/]+\/[^/]+)(?:\/tree\/[^/]+\/(.+))?$/;
const GITHUB_SIMPLE_PATTERN =
  /^(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+)\/?$/;

/**
 * Checksum verification result
 */
export type ChecksumResult = {
  verified: boolean;
  expected?: string;
  actual?: string;
  method: "sha256" | "git-head" | "skipped";
  message?: string;
};

/**
 * Verify git repository HEAD matches expected commit (if provided)
 */
async function verifyGitChecksum(
  repoPath: string,
  expectedChecksum?: string
): Promise<ChecksumResult> {
  if (!expectedChecksum) {
    return {
      verified: true,
      method: "skipped",
      message: "No checksum provided",
    };
  }

  try {
    // Get current HEAD commit hash
    const { stdout } = await execAsync("git rev-parse HEAD", { cwd: repoPath });
    const actualHead = stdout.trim();

    // If checksum looks like a git commit hash (40 hex chars)
    if (GIT_COMMIT_HASH_REGEX.test(expectedChecksum)) {
      const verified = actualHead === expectedChecksum.toLowerCase();
      return {
        verified,
        expected: expectedChecksum,
        actual: actualHead,
        method: "git-head",
        message: verified
          ? "Git HEAD matches expected commit"
          : `Git HEAD mismatch: expected ${expectedChecksum.slice(0, 8)}, got ${actualHead.slice(0, 8)}`,
      };
    }

    // Checksum is SHA256 (64 hex chars) - can't verify for git clone
    // This is meant for tarball downloads (future feature)
    return {
      verified: true, // Don't fail, just warn
      expected: expectedChecksum,
      method: "sha256",
      message:
        "SHA256 checksum provided but git clone used - verification skipped",
    };
  } catch {
    return {
      verified: true, // Don't fail on verification errors
      method: "git-head",
      message: "Could not verify git HEAD",
    };
  }
}

// Frontmatter regex for extracting skill name
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

/**
 * Check if repository has valid Claude Code plugin structure
 * Supports both plugin.json and marketplace.json formats
 */
async function isValidPluginStructure(repoPath: string): Promise<boolean> {
  const claudePluginDir = join(repoPath, ".claude-plugin");

  // Check for plugin.json (standard format)
  const pluginJsonPath = join(claudePluginDir, "plugin.json");
  if (await pathExists(pluginJsonPath)) {
    return true;
  }

  // Check for marketplace.json (Anthropic marketplace format)
  const marketplaceJsonPath = join(claudePluginDir, "marketplace.json");
  if (await pathExists(marketplaceJsonPath)) {
    return true;
  }

  return false;
}

/**
 * Find SKILL.md location in repository using glob pattern
 * Returns the directory containing SKILL.md at the shallowest depth
 */
async function findSkillMdPath(repoPath: string): Promise<string | null> {
  // Use a simple recursive search with early termination
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

  // Search up to 5 levels deep
  return await searchDir(repoPath, 0, 5);
}

/**
 * Extract skill name from SKILL.md frontmatter
 */
async function extractSkillName(skillMdDir: string): Promise<string> {
  try {
    const content = await readFile(join(skillMdDir, "SKILL.md"), "utf-8");
    const match = content.match(FRONTMATTER_REGEX);

    if (match?.[1]) {
      // Parse frontmatter for name field
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

  // Fallback: use directory name
  return basename(skillMdDir);
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
  // 1. Create plugin directory structure
  await mkdir(join(targetPath, ".claude-plugin"), { recursive: true });
  const skillTargetDir = join(targetPath, "skills", skillName);
  await mkdir(skillTargetDir, { recursive: true });

  // 2. Copy skill contents (everything at SKILL.md level)
  await cp(skillPath, skillTargetDir, { recursive: true });

  // 3. Generate plugin.json
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
 * Supports both full plugins and standalone skills (auto-wrapped)
 *
 * Installation Strategy:
 * 1. If skillPath exists (marketplace skill): use selective extraction
 * 2. Clone to temp directory
 * 3. Check if valid Claude Code plugin structure (.claude-plugin/plugin.json)
 * 4. If valid plugin: move directly to ~/.looplia/plugins/
 * 5. If no plugin structure: find SKILL.md, auto-wrap as plugin
 *
 * @param skill - The skill to install
 * @param showProgress - Whether to show progress indicators (default: false)
 * @see docs/DESIGN-0.7.0.md section 7.3
 */
export async function installThirdPartySkill(
  skill: CompiledSkill,
  showProgress = false
): Promise<InstallResult> {
  const progress = showProgress ? createProgress() : null;

  if (!skill.gitUrl) {
    return {
      skill: skill.name,
      status: "failed",
      error: "No git URL available for skill",
    };
  }

  // Check if this is a marketplace skill (has skillPath for selective extraction)
  if (skill.skillPath) {
    return await installMarketplaceSkill(skill, showProgress);
  }

  const loopliaPath = join(homedir(), ".looplia");
  const pluginsDir = join(loopliaPath, "plugins");
  await mkdir(pluginsDir, { recursive: true });

  // Extract repo name from git URL for naming
  const repoName = skill.gitUrl
    .replace(PROTOCOL_REGEX, "")
    .replace("github.com/", "")
    .replace(TRAILING_SLASH_REGEX, "")
    .replace(SLASH_TO_DASH_REGEX, "-");

  try {
    // 1. Clone to temp directory first
    const tempPath = join(tmpdir(), `looplia-install-${Date.now()}`);
    progress?.start(`Cloning ${skill.name}`);
    await execAsync(`git clone ${skill.gitUrl} "${tempPath}"`);

    // Verify checksum after clone
    const checksumResult = await verifyGitChecksum(tempPath, skill.checksum);
    if (!checksumResult.verified) {
      console.warn(`Checksum warning: ${checksumResult.message}`);
    }

    // 2. Check if valid plugin structure (Priority 1)
    if (await isValidPluginStructure(tempPath)) {
      const targetPath = join(pluginsDir, repoName);

      if (await pathExists(targetPath)) {
        // Already exists - update via git pull
        await rm(tempPath, { recursive: true, force: true });
        progress?.start(`Updating ${skill.name}`);
        await execAsync("git pull", { cwd: targetPath });
        progress?.succeed(`Updated ${skill.name}`);
        return {
          skill: skill.name,
          status: "updated",
          path: targetPath,
        };
      }

      // Move to plugins directory
      await rename(tempPath, targetPath);
      progress?.succeed(`Installed ${skill.name} (plugin)`);
      return {
        skill: skill.name,
        status: "installed",
        path: targetPath,
      };
    }

    // 3. Fallback: Find SKILL.md and auto-wrap (Priority 2)
    progress?.start(`Analyzing ${skill.name} structure`);
    const skillMdDir = await findSkillMdPath(tempPath);

    if (!skillMdDir) {
      await rm(tempPath, { recursive: true, force: true });
      progress?.fail("No plugin structure or SKILL.md found");
      return {
        skill: skill.name,
        status: "failed",
        error: "No .claude-plugin/plugin.json or SKILL.md found in repository",
      };
    }

    // 4. Extract skill name and auto-wrap
    const extractedName = await extractSkillName(skillMdDir);
    const targetPath = join(pluginsDir, extractedName);

    if (await pathExists(targetPath)) {
      await rm(tempPath, { recursive: true, force: true });
      progress?.succeed(`${extractedName} already installed`);
      return {
        skill: extractedName,
        status: "already_installed",
        path: targetPath,
      };
    }

    progress?.start(`Auto-wrapping ${extractedName} as plugin`);
    await wrapSkillAsPlugin(
      skillMdDir,
      extractedName,
      targetPath,
      skill.gitUrl
    );

    // 5. Cleanup temp
    await rm(tempPath, { recursive: true, force: true });

    progress?.succeed(`Installed ${extractedName} (auto-wrapped)`);
    return {
      skill: extractedName,
      status: "installed",
      path: targetPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress?.fail(`Failed to install ${skill.name}`);
    return {
      skill: skill.name,
      status: "failed",
      error: message,
    };
  }
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
 * Check if a skill is a core skill
 */
export function isCoreSkill(skillName: string): boolean {
  return CORE_SKILLS.includes(skillName);
}

/**
 * Install a skill from a direct URL (not from catalog)
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
  const progress = showProgress ? createProgress() : null;

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
  const loopliaPath = join(homedir(), ".looplia");
  const pluginsDir = join(loopliaPath, "plugins");
  await mkdir(pluginsDir, { recursive: true });

  try {
    // 1. Clone repo to temp
    const tempPath = join(tmpdir(), `looplia-install-${Date.now()}`);
    progress?.start(`Cloning ${repoUrl}`);
    await execAsync(`git clone --depth 1 ${repoUrl} "${tempPath}"`);

    // 2. Determine source directory
    const sourcePath = skillPath ? join(tempPath, skillPath) : tempPath;
    if (skillPath && !(await pathExists(sourcePath))) {
      await rm(tempPath, { recursive: true, force: true });
      progress?.fail(`Skill path not found: ${skillPath}`);
      return {
        skill: skillPath,
        status: "failed",
        error: `Path not found in repository: ${skillPath}`,
      };
    }

    // 3. Check for valid plugin structure
    if (await isValidPluginStructure(tempPath)) {
      // Full plugin - install directly
      const repoName = repoUrl
        .split("/")
        .slice(-2)
        .join("-")
        .replace(".git", "");
      const targetPath = join(pluginsDir, repoName);

      if (await pathExists(targetPath)) {
        await rm(tempPath, { recursive: true, force: true });
        progress?.succeed("Plugin already installed");
        return {
          skill: repoName,
          status: "already_installed",
          path: targetPath,
        };
      }

      await rename(tempPath, targetPath);
      progress?.succeed(`Installed plugin: ${repoName}`);
      return {
        skill: repoName,
        status: "installed",
        path: targetPath,
      };
    }

    // 4. Find SKILL.md in source path
    progress?.start("Analyzing skill structure");
    const skillMdDir = await findSkillMdPath(sourcePath);

    if (!skillMdDir) {
      await rm(tempPath, { recursive: true, force: true });
      progress?.fail("No plugin structure or SKILL.md found");
      return {
        skill: "unknown",
        status: "failed",
        error: "No .claude-plugin/plugin.json or SKILL.md found",
      };
    }

    // 5. Extract skill name and auto-wrap
    const extractedName = await extractSkillName(skillMdDir);
    const targetPath = join(pluginsDir, extractedName);

    if (await pathExists(targetPath)) {
      await rm(tempPath, { recursive: true, force: true });
      progress?.succeed(`${extractedName} already installed`);
      return {
        skill: extractedName,
        status: "already_installed",
        path: targetPath,
      };
    }

    progress?.start(`Auto-wrapping ${extractedName} as plugin`);
    await wrapSkillAsPlugin(skillMdDir, extractedName, targetPath, url);

    // 6. Cleanup and recompile
    await rm(tempPath, { recursive: true, force: true });
    progress?.succeed(`Installed ${extractedName} (auto-wrapped)`);

    // Recompile registry to include new skill
    await compileRegistry();

    return {
      skill: extractedName,
      status: "installed",
      path: targetPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress?.fail("Failed to install from URL");
    return {
      skill: "unknown",
      status: "failed",
      error: message,
    };
  }
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

/**
 * Install a marketplace skill (selective extraction by skillPath)
 *
 * Marketplace skills have a skillPath like "skills/xlsx" that points
 * to a specific skill within a larger repository.
 */
export async function installMarketplaceSkill(
  skill: CompiledSkill,
  showProgress = false
): Promise<InstallResult> {
  const progress = showProgress ? createProgress() : null;

  if (!(skill.gitUrl && skill.skillPath)) {
    return {
      skill: skill.name,
      status: "failed",
      error: "Missing gitUrl or skillPath for marketplace skill",
    };
  }

  const loopliaPath = join(homedir(), ".looplia");
  const pluginsDir = join(loopliaPath, "plugins");
  await mkdir(pluginsDir, { recursive: true });

  try {
    // 1. Clone marketplace repo (shallow)
    const tempPath = join(tmpdir(), `looplia-marketplace-${Date.now()}`);
    progress?.start(`Cloning marketplace: ${skill.name}`);
    await execAsync(`git clone --depth 1 ${skill.gitUrl} "${tempPath}"`);

    // 2. Navigate to skill path
    const skillSourcePath = join(tempPath, skill.skillPath);
    if (!(await pathExists(skillSourcePath))) {
      await rm(tempPath, { recursive: true, force: true });
      progress?.fail(`Skill path not found: ${skill.skillPath}`);
      return {
        skill: skill.name,
        status: "failed",
        error: `Path not found in marketplace: ${skill.skillPath}`,
      };
    }

    // 3. Find SKILL.md
    const skillMdDir = await findSkillMdPath(skillSourcePath);
    if (!skillMdDir) {
      await rm(tempPath, { recursive: true, force: true });
      progress?.fail("No SKILL.md found in skill path");
      return {
        skill: skill.name,
        status: "failed",
        error: `No SKILL.md found at ${skill.skillPath}`,
      };
    }

    // 4. Extract skill name and auto-wrap
    const extractedName = await extractSkillName(skillMdDir);
    const targetPath = join(pluginsDir, extractedName);

    if (await pathExists(targetPath)) {
      await rm(tempPath, { recursive: true, force: true });
      progress?.succeed(`${extractedName} already installed`);
      return {
        skill: extractedName,
        status: "already_installed",
        path: targetPath,
      };
    }

    progress?.start(`Auto-wrapping ${extractedName} as plugin`);
    await wrapSkillAsPlugin(
      skillMdDir,
      extractedName,
      targetPath,
      `${skill.gitUrl}/${skill.skillPath}`
    );

    // 5. Cleanup
    await rm(tempPath, { recursive: true, force: true });
    progress?.succeed(`Installed ${extractedName} (marketplace)`);

    return {
      skill: extractedName,
      status: "installed",
      path: targetPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress?.fail(`Failed to install ${skill.name}`);
    return {
      skill: skill.name,
      status: "failed",
      error: message,
    };
  }
}

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
