#!/usr/bin/env bun
/**
 * Plugin Registry Scanner
 *
 * Deterministic script to scan installed plugins and catalog available skills.
 * Outputs a JSON registry to stdout.
 *
 * Usage: bun plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.ts [plugins-dir]
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";

// Top-level regex for frontmatter extraction
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

// Capability inference lookup table
const CAPABILITY_PATTERNS: [string, string][] = [
  ["analy", "content analysis"],
  ["review", "content review"],
  ["theme", "theme extraction"],
  ["extract", "theme extraction"],
  ["quote", "quote identification"],
  ["generat", "content generation"],
  ["idea", "idea generation"],
  ["hook", "idea generation"],
  ["outline", "outline creation"],
  ["transform", "content transformation"],
  ["document", "structured output"],
  ["structur", "structured output"],
  ["assembl", "content assembly"],
  ["combin", "content assembly"],
  ["profile", "personalization"],
  ["user", "personalization"],
  ["valid", "validation"],
];

type SkillInfo = {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  capabilities: string[];
};

type PluginInfo = {
  name: string;
  path: string;
  skills: SkillInfo[];
};

type Registry = {
  plugins: PluginInfo[];
  summary: {
    totalPlugins: number;
    totalSkills: number;
  };
};

/**
 * Extract YAML frontmatter from markdown content
 */
function extractFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return null;
  }

  try {
    return parseYaml(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Infer capabilities from skill description using pattern matching
 */
function inferCapabilities(description: string): string[] {
  const descLower = description.toLowerCase();
  const capabilities = new Set<string>();

  for (const [pattern, capability] of CAPABILITY_PATTERNS) {
    if (descLower.includes(pattern)) {
      capabilities.add(capability);
    }
  }

  if (capabilities.size === 0) {
    capabilities.add("general processing");
  }

  return [...capabilities];
}

/**
 * Scan a single skill directory
 */
async function scanSkill(skillPath: string): Promise<SkillInfo | null> {
  const skillMdPath = join(skillPath, "SKILL.md");

  try {
    const content = await readFile(skillMdPath, "utf-8");
    const frontmatter = extractFrontmatter(content);

    if (!(frontmatter?.name && frontmatter.description)) {
      console.error(`Warning: Invalid frontmatter in ${skillMdPath}`);
      return null;
    }

    const description =
      typeof frontmatter.description === "string"
        ? frontmatter.description.trim()
        : String(frontmatter.description);

    let tools: string[] | undefined;
    if (Array.isArray(frontmatter.tools)) {
      tools = frontmatter.tools.map(String);
    } else if (typeof frontmatter.tools === "string") {
      tools = frontmatter.tools.split(",").map((t: string) => t.trim());
    }

    return {
      name: String(frontmatter.name),
      description,
      tools,
      model: frontmatter.model ? String(frontmatter.model) : undefined,
      capabilities: inferCapabilities(description),
    };
  } catch {
    // SKILL.md doesn't exist or can't be read
    return null;
  }
}

/**
 * Scan a single plugin directory
 */
async function scanPlugin(pluginPath: string): Promise<PluginInfo | null> {
  const skillsDir = join(pluginPath, "skills");

  try {
    const skillsStat = await stat(skillsDir);
    if (!skillsStat.isDirectory()) {
      return null;
    }
  } catch {
    // No skills directory
    return null;
  }

  const skillDirs = await readdir(skillsDir);
  const skills: SkillInfo[] = [];

  for (const skillDir of skillDirs) {
    const skillPath = join(skillsDir, skillDir);
    const skillStat = await stat(skillPath);

    if (skillStat.isDirectory()) {
      const skill = await scanSkill(skillPath);
      if (skill) {
        skills.push(skill);
      }
    }
  }

  if (skills.length === 0) {
    return null;
  }

  return {
    name: basename(pluginPath),
    path: pluginPath,
    skills,
  };
}

/**
 * Main scanner function
 */
async function scanPlugins(pluginsPath: string): Promise<Registry> {
  const plugins: PluginInfo[] = [];

  try {
    const entries = await readdir(pluginsPath);

    for (const entry of entries) {
      const pluginPath = join(pluginsPath, entry);
      const entryStat = await stat(pluginPath);

      if (entryStat.isDirectory() && !entry.startsWith(".")) {
        const plugin = await scanPlugin(pluginPath);
        if (plugin) {
          plugins.push(plugin);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning plugins directory: ${error}`);
  }

  const totalSkills = plugins.reduce((sum, p) => sum + p.skills.length, 0);

  return {
    plugins,
    summary: {
      totalPlugins: plugins.length,
      totalSkills,
    },
  };
}

// Main execution
const pluginsDir = process.argv[2] || "plugins";
const registry = await scanPlugins(pluginsDir);
console.log(JSON.stringify(registry, null, 2));
