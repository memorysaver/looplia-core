#!/usr/bin/env bun
/**
 * Build Registry Script (v0.7.0)
 *
 * Generates registry.json for GitHub releases.
 * Scans local plugins for skills and outputs a registry manifest.
 *
 * Usage:
 *   bun scripts/build-registry.ts
 *   bun scripts/build-registry.ts --output dist/registry.json
 *   bun scripts/build-registry.ts --version 0.7.0
 *
 * @see docs/DESIGN-0.7.0.md
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Schema URL for registry manifest */
const REGISTRY_SCHEMA_URL = "https://looplia.com/schema/registry.json";

/** Registry homepage */
const REGISTRY_HOMEPAGE = "https://github.com/memorysaver/looplia-core";

/** Plugins directory relative to project root */
const PLUGINS_DIR = "plugins";

/** Skill categories */
type SkillCategory =
  | "analysis"
  | "generation"
  | "assembly"
  | "validation"
  | "search"
  | "orchestration"
  | "utility";

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

/** Format title from skill name */
function formatTitle(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Infer category from skill name and description */
function inferCategory(name: string, description: string): SkillCategory {
  const text = `${name} ${description}`.toLowerCase();

  if (text.includes("review") || text.includes("analyze") || text.includes("scan")) {
    return "analysis";
  }
  if (text.includes("generate") || text.includes("synthesis") || text.includes("create")) {
    return "generation";
  }
  if (text.includes("assemble") || text.includes("document") || text.includes("compile")) {
    return "assembly";
  }
  if (text.includes("validate") || text.includes("check")) {
    return "validation";
  }
  if (text.includes("search") || text.includes("find")) {
    return "search";
  }
  if (text.includes("workflow") || text.includes("execute") || text.includes("orchestrat")) {
    return "orchestration";
  }

  return "utility";
}

/** Infer capabilities from description */
function inferCapabilities(description: string): string[] {
  const capabilities: string[] = [];
  const text = description.toLowerCase();

  const capabilityPatterns = [
    { pattern: /media|video|audio|image/, capability: "media-processing" },
    { pattern: /content|text|document/, capability: "content-analysis" },
    { pattern: /json|schema|structured/, capability: "structured-output" },
    { pattern: /workflow|orchestrat/, capability: "workflow-management" },
    { pattern: /search|find|discover/, capability: "search" },
    { pattern: /generat|creat|produc/, capability: "generation" },
    { pattern: /valid|check|verify/, capability: "validation" },
  ];

  for (const { pattern, capability } of capabilityPatterns) {
    if (pattern.test(text)) {
      capabilities.push(capability);
    }
  }

  return capabilities;
}

/** Parse SKILL.md frontmatter */
async function parseSkillMd(
  skillPath: string
): Promise<{
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

    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch?.[1]) {
      return null;
    }

    const frontmatter = frontmatterMatch[1];
    const lines = frontmatter.split("\n");
    const metadata: Record<string, string> = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();

        // Handle multi-line description (starts with |)
        if (value === "|") {
          const descLines: string[] = [];
          const lineIndex = lines.indexOf(line);
          for (let i = lineIndex + 1; i < lines.length; i++) {
            const descLine = lines[i];
            if (descLine.startsWith("  ")) {
              descLines.push(descLine.trim());
            } else {
              break;
            }
          }
          value = descLines.join(" ");
        }

        metadata[key] = value;
      }
    }

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

/** Scan skill directory for files */
async function scanSkillFiles(skillPath: string): Promise<SkillFile[]> {
  const files: SkillFile[] = [];

  // Check for SKILL.md
  if (await pathExists(join(skillPath, "SKILL.md"))) {
    files.push({ path: "SKILL.md", type: "skill:definition" });
  }

  // Check for scripts directory
  const scriptsDir = join(skillPath, "scripts");
  if (await pathExists(scriptsDir)) {
    try {
      const entries = await readdir(scriptsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".ts")) {
          files.push({ path: `scripts/${entry.name}`, type: "skill:script" });
        }
      }
    } catch {
      // Ignore errors reading scripts
    }
  }

  // Check for templates directory
  const templatesDir = join(skillPath, "templates");
  if (await pathExists(templatesDir)) {
    try {
      const entries = await readdir(templatesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          files.push({ path: `templates/${entry.name}`, type: "skill:template" });
        }
      }
    } catch {
      // Ignore errors reading templates
    }
  }

  // Check for SCHEMA.md
  if (await pathExists(join(skillPath, "SCHEMA.md"))) {
    files.push({ path: "SCHEMA.md", type: "skill:schema" });
  }

  return files;
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
    $schema: REGISTRY_SCHEMA_URL,
    name: "looplia-official",
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

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) {
      output = args[i + 1];
      i++;
    } else if (args[i] === "--version" && args[i + 1]) {
      version = args[i + 1];
      i++;
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
