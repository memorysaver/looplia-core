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
import { mkdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  CompiledRegistry,
  CompiledSkill,
  EnsureSkillsResult,
  InstallResult,
  ParsedWorkflow,
} from "@looplia/core";
import { extractWorkflowSkills } from "@looplia/core";
import { compileRegistry, getCompiledRegistryPath } from "./compiler";

const execAsync = promisify(exec);

/**
 * Check if a path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
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
export function getInstalledSkills(registry: CompiledRegistry): CompiledSkill[] {
  return registry.skills.filter((s) => s.installed);
}

/**
 * Get all available (not installed) skills
 */
export function getAvailableSkills(registry: CompiledRegistry): CompiledSkill[] {
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
 */
export async function installThirdPartySkill(
  skill: CompiledSkill
): Promise<InstallResult> {
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
    .replace(/^https?:\/\//, "")
    .replace("github.com/", "")
    .replace(/\/$/, "")
    .replace(/\//g, "-");

  const targetPath = join(pluginsDir, repoName);

  try {
    if (await pathExists(targetPath)) {
      // Already cloned - do git pull
      await execAsync("git pull", { cwd: targetPath });
      return {
        skill: skill.name,
        status: "updated",
        path: targetPath,
      };
    }

    // Clone the repository
    await execAsync(`git clone ${skill.gitUrl} "${targetPath}"`);
    return {
      skill: skill.name,
      status: "installed",
      path: targetPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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
      error: "Built-in skill not found in local installation. Run 'looplia init' to reinstall.",
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

  if (!skill.installed || !skill.installedPath) {
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
