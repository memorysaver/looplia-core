#!/usr/bin/env bun
/**
 * Build Registry Script (v0.7.1)
 *
 * Generates registry.json for GitHub releases.
 * Scans local plugins for skills and outputs a registry manifest.
 *
 * Usage:
 *   bun scripts/build-registry.ts
 *   bun scripts/build-registry.ts --output dist/registry.json
 *   bun scripts/build-registry.ts --version 0.7.1
 *
 * @see docs/DESIGN-0.7.1.md
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
// Import types from core
import type { SkillCategory } from "../packages/core/src/domain/registry";
// Import shared utilities from registry module (v0.7.1)
import {
  FRONTMATTER_REGEX,
  formatTitle,
  inferCapabilities,
  inferCategory,
  parseYamlFrontmatter,
} from "../packages/provider/src/registry/utils";

/** Registry homepage */
const REGISTRY_HOMEPAGE = "https://github.com/memorysaver/looplia-core";

/** Plugins directory relative to project root */
const PLUGINS_DIR = "plugins";

/** Skill file metadata */
type SkillFile = {
  path: string;
  type: "skill:definition" | "skill:script" | "skill:template" | "skill:schema";
};

/** Registry skill item */
type RegistrySkillItem = {
  name: string;
  type: "registry:skill";
  title: string;
  description: string;
  author: string;
  plugin: string;
  category: SkillCategory;
  capabilities: string[];
  tools?: string[];
  model?: string;
  inputless?: boolean;
  registryDependencies?: string[];
  downloadUrl: string;
  checksum?: string;
  files: SkillFile[];
};

/** Remote registry manifest */
type RemoteRegistryManifest = {
  $schema: string;
  name: string;
  homepage: string;
  version: string;
  updatedAt: string;
  items: RegistrySkillItem[];
};

/** Check if path exists */
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Parse SKILL.md frontmatter */
async function parseSkillMd(skillPath: string): Promise<{
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  inputless?: boolean;
} | null> {
  const skillMdPath = join(skillPath, "SKILL.md");

  if (!(await pathExists(skillMdPath))) {
    return null;
  }

  try {
    const content = await readFile(skillMdPath, "utf-8");
    const frontmatterMatch = content.match(FRONTMATTER_REGEX);

    if (!frontmatterMatch?.[1]) {
      return null;
    }

    const metadata = parseYamlFrontmatter(frontmatterMatch[1]);

    return {
      name: metadata.name ?? "",
      description: metadata.description ?? "",
      tools: metadata.tools?.split(",").map((t) => t.trim()),
      model: metadata.model,
      inputless: metadata.inputless === "true",
    };
  } catch {
    return null;
  }
}

/** Scan a subdirectory for files of a given type */
async function scanSubdirectory(
  skillPath: string,
  subdir: string,
  type: SkillFile["type"],
  extension?: string
): Promise<SkillFile[]> {
  const dirPath = join(skillPath, subdir);
  if (!(await pathExists(dirPath))) {
    return [];
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && (!extension || e.name.endsWith(extension)))
      .map((e) => ({ path: `${subdir}/${e.name}`, type }));
  } catch {
    return [];
  }
}

/** Scan skill directory for files */
async function scanSkillFiles(skillPath: string): Promise<SkillFile[]> {
  const files: SkillFile[] = [];

  // Check for definition files
  if (await pathExists(join(skillPath, "SKILL.md"))) {
    files.push({ path: "SKILL.md", type: "skill:definition" });
  }
  if (await pathExists(join(skillPath, "SCHEMA.md"))) {
    files.push({ path: "SCHEMA.md", type: "skill:schema" });
  }

  // Scan subdirectories
  const scripts = await scanSubdirectory(
    skillPath,
    "scripts",
    "skill:script",
    ".ts"
  );
  const templates = await scanSubdirectory(
    skillPath,
    "templates",
    "skill:template"
  );

  return [...files, ...scripts, ...templates];
}

/** Scan a single plugin for skills */
async function scanPlugin(
  pluginPath: string,
  pluginName: string,
  version: string
): Promise<RegistrySkillItem[]> {
  const skills: RegistrySkillItem[] = [];
  const skillsDir = join(pluginPath, "skills");

  if (!(await pathExists(skillsDir))) {
    return skills;
  }

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillPath = join(skillsDir, entry.name);
      const metadata = await parseSkillMd(skillPath);

      if (!metadata) {
        console.warn(`Warning: No valid SKILL.md in ${skillPath}`);
        continue;
      }

      const files = await scanSkillFiles(skillPath);
      const category = inferCategory(metadata.name, metadata.description);
      const capabilities = inferCapabilities(metadata.description);

      // Build download URL for GitHub releases
      const downloadUrl = `${REGISTRY_HOMEPAGE}/releases/download/v${version}/skills/${metadata.name}.tar.gz`;

      skills.push({
        name: metadata.name || entry.name,
        type: "registry:skill",
        title: formatTitle(metadata.name || entry.name),
        description: metadata.description,
        author: pluginName,
        plugin: pluginName,
        category,
        capabilities,
        tools: metadata.tools,
        model: metadata.model,
        inputless: metadata.inputless,
        downloadUrl,
        files,
      });
    }
  } catch (error) {
    console.warn(`Warning: Error scanning plugin ${pluginName}:`, error);
  }

  return skills;
}

/** Scan all plugins and build registry */
async function buildRegistry(
  projectRoot: string,
  version: string
): Promise<RemoteRegistryManifest> {
  const pluginsPath = join(projectRoot, PLUGINS_DIR);
  const items: RegistrySkillItem[] = [];

  try {
    const entries = await readdir(pluginsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }

      const pluginPath = join(pluginsPath, entry.name);
      const skills = await scanPlugin(pluginPath, entry.name, version);
      items.push(...skills);

      console.log(`Scanned ${entry.name}: ${skills.length} skills`);
    }
  } catch (error) {
    console.error("Error scanning plugins:", error);
  }

  return {
    name: "looplia",
    homepage: REGISTRY_HOMEPAGE,
    version,
    updatedAt: new Date().toISOString(),
    items,
  };
}

/** Parse command line arguments */
function parseArgs(): { output: string; version: string } {
  const args = process.argv.slice(2);
  let output = "registry.json";
  let version = "0.7.0";

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--output" && args[i + 1]) {
      output = args[i + 1];
      i += 1;
    } else if (args[i] === "--version" && args[i + 1]) {
      version = args[i + 1];
      i += 1;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Build Registry Script (v0.7.0)

Usage:
  bun scripts/build-registry.ts [options]

Options:
  --output <path>   Output file path (default: registry.json)
  --version <ver>   Registry version (default: 0.7.0)
  --help, -h        Show this help

Examples:
  bun scripts/build-registry.ts
  bun scripts/build-registry.ts --output dist/registry.json
  bun scripts/build-registry.ts --version 0.7.1
`);
      process.exit(0);
    }
  }

  return { output, version };
}

/** Main entry point */
async function main(): Promise<void> {
  const { output, version } = parseArgs();
  const projectRoot = process.cwd();

  console.log(`Building registry v${version}...`);
  console.log(`Project root: ${projectRoot}`);

  const registry = await buildRegistry(projectRoot, version);

  console.log(`\nTotal skills: ${registry.items.length}`);

  // Write registry.json
  await writeFile(output, JSON.stringify(registry, null, 2));
  console.log(`\nWritten: ${output}`);

  // Print summary by category
  const byCategory: Record<string, number> = {};
  for (const item of registry.items) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  console.log("\nBy category:");
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`  ${category}: ${count}`);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
