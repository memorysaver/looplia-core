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
import { mkdir, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
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
 *
 * @param skill - The skill to install
 * @param showProgress - Whether to show progress indicators (default: false)
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

  const loopliaPath = join(homedir(), ".looplia");
  const pluginsDir = join(loopliaPath, "plugins");
  await mkdir(pluginsDir, { recursive: true });

  // Extract repo name from git URL
  const repoName = skill.gitUrl
    .replace(PROTOCOL_REGEX, "")
    .replace("github.com/", "")
    .replace(TRAILING_SLASH_REGEX, "")
    .replace(SLASH_TO_DASH_REGEX, "-");

  const targetPath = join(pluginsDir, repoName);

  try {
    if (await pathExists(targetPath)) {
      // Already cloned - do git pull
      progress?.start(`Updating ${skill.name}`);
      await execAsync("git pull", { cwd: targetPath });

      // Verify checksum after pull
      const checksumResult = await verifyGitChecksum(
        targetPath,
        skill.checksum
      );
      if (!checksumResult.verified) {
        console.warn(`Checksum warning: ${checksumResult.message}`);
      }

      progress?.succeed(`Updated ${skill.name}`);
      return {
        skill: skill.name,
        status: "updated",
        path: targetPath,
      };
    }

    // Clone the repository
    progress?.start(`Cloning ${skill.name}`);
    await execAsync(`git clone ${skill.gitUrl} "${targetPath}"`);

    // Verify checksum after clone
    const checksumResult = await verifyGitChecksum(targetPath, skill.checksum);
    if (!checksumResult.verified) {
      console.warn(`Checksum warning: ${checksumResult.message}`);
    } else if (
      checksumResult.method !== "skipped" &&
      checksumResult.message?.includes("skipped")
    ) {
      // SHA256 checksum provided but using git - log info
      console.info(`Note: ${checksumResult.message}`);
    }

    progress?.succeed(`Installed ${skill.name}`);
    return {
      skill: skill.name,
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
