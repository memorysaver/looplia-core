/**
 * Auto-Discovery Plugin Module (v0.8.0)
 *
 * Manages the auto-discovery-plugin, a Claude plugin structure that holds
 * skills discovered during `looplia build` from skills.sh registry.
 *
 * Structure:
 *   ~/.looplia/plugins/auto-discovery-plugin/
 *   ├── .claude-plugin/
 *   │   └── plugin.json
 *   └── skills/
 *       ├── pdf/
 *       │   └── SKILL.md
 *       └── xlsx/
 *           └── SKILL.md
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { InstallResult } from "@looplia-core/core";
import { getLoopliaPluginPath } from "../bootstrap/index";

const AUTO_DISCOVERY_PLUGIN_NAME = "auto-discovery-plugin";

/**
 * Get path to auto-discovery plugin
 */
export function getAutoDiscoveryPluginPath(): string {
  return join(getLoopliaPluginPath(), "plugins", AUTO_DISCOVERY_PLUGIN_NAME);
}

/**
 * Check if a path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize auto-discovery plugin structure if not exists
 *
 * Creates:
 *   - .claude-plugin/plugin.json
 *   - skills/
 */
export async function ensureAutoDiscoveryPlugin(): Promise<void> {
  const pluginPath = getAutoDiscoveryPluginPath();
  const pluginJsonPath = join(pluginPath, ".claude-plugin", "plugin.json");
  const skillsDir = join(pluginPath, "skills");

  // Check if already initialized
  if (await pathExists(join(pluginPath, ".claude-plugin"))) {
    return;
  }

  // Create plugin structure
  await mkdir(join(pluginPath, ".claude-plugin"), { recursive: true });
  await mkdir(skillsDir, { recursive: true });

  // Create plugin.json
  const pluginJson = {
    name: "auto-discovery-plugin",
    description: "Auto-discovered skills from skills.sh registry",
    version: "1.0.0",
  };
  await writeFile(pluginJsonPath, JSON.stringify(pluginJson, null, 2), "utf-8");
}

/**
 * Install a skill into auto-discovery plugin
 *
 * @param skillName - Name of the skill (used as directory name)
 * @param skillContent - Content of the SKILL.md file
 */
export async function installSkillToAutoDiscovery(
  skillName: string,
  skillContent: string
): Promise<InstallResult> {
  await ensureAutoDiscoveryPlugin();

  const skillDir = join(getAutoDiscoveryPluginPath(), "skills", skillName);
  await mkdir(skillDir, { recursive: true });

  const skillPath = join(skillDir, "SKILL.md");
  await writeFile(skillPath, skillContent, "utf-8");

  return {
    skill: skillName,
    status: "installed",
    path: skillDir,
  };
}

/**
 * List all skills installed in auto-discovery plugin
 */
export async function listAutoDiscoveredSkills(): Promise<string[]> {
  const skillsDir = join(getAutoDiscoveryPluginPath(), "skills");

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Check if a skill is already installed in auto-discovery plugin
 */
export async function isSkillAutoDiscovered(
  skillName: string
): Promise<boolean> {
  const skillDir = join(getAutoDiscoveryPluginPath(), "skills", skillName);
  return await pathExists(skillDir);
}
