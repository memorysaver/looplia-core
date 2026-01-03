/**
 * Registry Compiler (v0.7.0)
 *
 * Compiles skill registry from multiple sources into a unified local cache.
 * - Fetches remote registries (official + third-party)
 * - Scans local plugins for installed skills
 * - Merges and deduplicates entries
 * - Writes compiled.json for fast lookup
 *
 * @see docs/DESIGN-0.7.0.md
 */

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  CompiledRegistry,
  CompiledSkill,
  RegistrySkillItem,
  RegistrySource,
  RemoteRegistryManifest,
  SkillCategory,
} from "@looplia/core";

/** Official registry URL */
const OFFICIAL_REGISTRY_URL =
  "https://github.com/memorysaver/looplia-core/releases/latest/download/registry.json";

/** Default schema URL */
const REGISTRY_SCHEMA_URL = "https://looplia.com/schema/registry.json";

/** Registry format version */
const REGISTRY_VERSION = "1.0.0";

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
 * Get the registry directory path
 */
export function getRegistryPath(): string {
  return join(homedir(), ".looplia", "registry");
}

/**
 * Get the compiled registry file path
 */
export function getCompiledRegistryPath(): string {
  return join(getRegistryPath(), "compiled.json");
}

/**
 * Get the sources configuration file path
 */
export function getSourcesPath(): string {
  return join(getRegistryPath(), "sources.json");
}

/**
 * Initialize registry directory structure
 */
export async function initializeRegistry(force = false): Promise<void> {
  const registryPath = getRegistryPath();
  const sourcesPath = getSourcesPath();

  // Create registry directory
  await mkdir(registryPath, { recursive: true });
  await mkdir(join(registryPath, "cache"), { recursive: true });

  // Create default sources.json if it doesn't exist or force
  if (force || !(await pathExists(sourcesPath))) {
    const defaultSources: RegistrySource[] = [
      {
        id: "official",
        type: "official",
        url: OFFICIAL_REGISTRY_URL,
        enabled: true,
        priority: 100,
        addedAt: new Date().toISOString(),
      },
    ];
    await writeFile(sourcesPath, JSON.stringify(defaultSources, null, 2));
  }
}

/**
 * Load configured registry sources
 */
export async function loadSources(): Promise<RegistrySource[]> {
  const sourcesPath = getSourcesPath();

  if (!(await pathExists(sourcesPath))) {
    return [];
  }

  const content = await readFile(sourcesPath, "utf-8");
  return JSON.parse(content) as RegistrySource[];
}

/**
 * Save registry sources
 */
export async function saveSources(sources: RegistrySource[]): Promise<void> {
  const sourcesPath = getSourcesPath();
  await writeFile(sourcesPath, JSON.stringify(sources, null, 2));
}

/**
 * Add a new registry source
 */
export async function addSource(
  url: string,
  type: "github" | "local" = "github"
): Promise<RegistrySource> {
  const sources = await loadSources();

  // Generate unique ID from URL
  const id =
    type === "github"
      ? `github:${url.replace("github.com/", "").replace(/\/$/, "")}`
      : `local:${url}`;

  // Check for duplicates
  if (sources.some((s) => s.id === id)) {
    throw new Error(`Source already exists: ${id}`);
  }

  const newSource: RegistrySource = {
    id,
    type,
    url,
    enabled: true,
    priority: 50,
    addedAt: new Date().toISOString(),
  };

  sources.push(newSource);
  await saveSources(sources);

  return newSource;
}

/**
 * Remove a registry source
 */
export async function removeSource(sourceId: string): Promise<boolean> {
  const sources = await loadSources();
  const filtered = sources.filter((s) => s.id !== sourceId);

  if (filtered.length === sources.length) {
    return false;
  }

  await saveSources(filtered);
  return true;
}

/**
 * Fetch remote registry manifest
 */
async function fetchRemoteRegistry(
  source: RegistrySource
): Promise<RemoteRegistryManifest | null> {
  try {
    let url = source.url;

    // For GitHub sources, construct registry.json URL
    if (source.type === "github" && !url.endsWith("registry.json")) {
      url = `https://${source.url}/releases/latest/download/registry.json`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch registry from ${url}: ${response.status}`);
      return null;
    }

    return (await response.json()) as RemoteRegistryManifest;
  } catch (error) {
    console.warn(`Error fetching registry from ${source.url}:`, error);
    return null;
  }
}

/**
 * Parse SKILL.md frontmatter for skill metadata
 */
async function parseSkillMetadata(
  skillPath: string
): Promise<Partial<CompiledSkill> | null> {
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
        const value = line.slice(colonIndex + 1).trim();
        metadata[key] = value;
      }
    }

    // Infer category from skill name or description
    const category = inferCategory(
      metadata.name ?? "",
      metadata.description ?? ""
    );

    // Infer capabilities from description
    const capabilities = inferCapabilities(metadata.description ?? "");

    return {
      name: metadata.name,
      title: formatTitle(metadata.name ?? ""),
      description: metadata.description ?? "",
      category,
      capabilities,
      model: metadata.model,
      inputless: metadata.inputless === "true",
      tools: metadata.tools?.split(",").map((t) => t.trim()),
    };
  } catch {
    return null;
  }
}

/**
 * Infer skill category from name and description
 */
function inferCategory(name: string, description: string): SkillCategory {
  const text = `${name} ${description}`.toLowerCase();

  if (
    text.includes("review") ||
    text.includes("analyze") ||
    text.includes("scan")
  ) {
    return "analysis";
  }
  if (
    text.includes("generate") ||
    text.includes("synthesis") ||
    text.includes("create")
  ) {
    return "generation";
  }
  if (
    text.includes("assemble") ||
    text.includes("document") ||
    text.includes("compile")
  ) {
    return "assembly";
  }
  if (text.includes("validate") || text.includes("check")) {
    return "validation";
  }
  if (text.includes("search") || text.includes("find")) {
    return "search";
  }
  if (
    text.includes("workflow") ||
    text.includes("execute") ||
    text.includes("orchestrat")
  ) {
    return "orchestration";
  }

  return "utility";
}

/**
 * Infer capabilities from description
 */
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

/**
 * Format skill name as title
 */
function formatTitle(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Scan local plugins for installed skills
 */
async function scanLocalPlugins(
  loopliaPath: string
): Promise<CompiledSkill[]> {
  const skills: CompiledSkill[] = [];

  try {
    const entries = await readdir(loopliaPath, { withFileTypes: true });
    const pluginDirs = entries.filter(
      (e) =>
        e.isDirectory() &&
        !e.name.startsWith(".") &&
        e.name !== "sandbox" &&
        e.name !== "workflows" &&
        e.name !== "registry" &&
        e.name !== "plugins"
    );

    for (const pluginDir of pluginDirs) {
      const pluginPath = join(loopliaPath, pluginDir.name);
      const skillsPath = join(pluginPath, "skills");

      if (!(await pathExists(skillsPath))) {
        continue;
      }

      const skillEntries = await readdir(skillsPath, { withFileTypes: true });

      for (const skillEntry of skillEntries) {
        if (!skillEntry.isDirectory()) {
          continue;
        }

        const skillPath = join(skillsPath, skillEntry.name);
        const metadata = await parseSkillMetadata(skillPath);

        if (metadata) {
          skills.push({
            name: metadata.name ?? skillEntry.name,
            title: metadata.title ?? formatTitle(skillEntry.name),
            description: metadata.description ?? "",
            plugin: pluginDir.name,
            category: metadata.category ?? "utility",
            capabilities: metadata.capabilities ?? [],
            tools: metadata.tools,
            model: metadata.model,
            inputless: metadata.inputless,
            source: "local",
            sourceType: "builtin",
            installed: true,
            installedPath: skillPath,
          });
        }
      }
    }
  } catch {
    // Ignore errors scanning plugins
  }

  return skills;
}

/**
 * Convert registry item to compiled skill
 */
function convertToCompiledSkill(
  item: RegistrySkillItem,
  source: RegistrySource,
  installedSkills: Map<string, CompiledSkill>
): CompiledSkill {
  const installed = installedSkills.get(item.name);

  return {
    name: item.name,
    title: item.title,
    description: item.description,
    plugin: item.plugin,
    category: item.category,
    capabilities: item.capabilities,
    tools: item.tools,
    model: item.model,
    inputless: item.inputless,
    source: source.id,
    sourceType: source.type === "official" ? "builtin" : "thirdparty",
    installed: installed !== undefined,
    installedPath: installed?.installedPath,
    gitUrl:
      source.type === "github" ? `https://${source.url}` : undefined,
    checksum: item.checksum,
    dependencies: item.registryDependencies,
  };
}

/**
 * Compile registry from all sources
 */
export async function compileRegistry(): Promise<CompiledRegistry> {
  const loopliaPath = join(homedir(), ".looplia");
  const sources = await loadSources();

  // Scan local plugins first
  const localSkills = await scanLocalPlugins(loopliaPath);
  const installedSkillsMap = new Map(localSkills.map((s) => [s.name, s]));

  // Fetch remote registries
  const allSkills: CompiledSkill[] = [...localSkills];
  const seenSkills = new Set(localSkills.map((s) => s.name));

  for (const source of sources.filter((s) => s.enabled)) {
    if (source.type === "local") {
      continue; // Already scanned
    }

    const manifest = await fetchRemoteRegistry(source);
    if (!manifest) {
      continue;
    }

    for (const item of manifest.items) {
      if (seenSkills.has(item.name)) {
        continue; // Skip duplicates, local takes priority
      }

      const skill = convertToCompiledSkill(item, source, installedSkillsMap);
      allSkills.push(skill);
      seenSkills.add(item.name);
    }
  }

  // Build summary
  const byCategory: Record<SkillCategory, number> = {
    analysis: 0,
    generation: 0,
    assembly: 0,
    validation: 0,
    search: 0,
    orchestration: 0,
    utility: 0,
  };

  const bySource: Record<string, number> = {};

  for (const skill of allSkills) {
    byCategory[skill.category]++;
    bySource[skill.source] = (bySource[skill.source] ?? 0) + 1;
  }

  const compiled: CompiledRegistry = {
    compiledAt: new Date().toISOString(),
    version: REGISTRY_VERSION,
    sources,
    skills: allSkills,
    summary: {
      totalSkills: allSkills.length,
      byCategory,
      bySource,
    },
  };

  // Write compiled registry
  const registryPath = getRegistryPath();
  await mkdir(registryPath, { recursive: true });
  await writeFile(
    getCompiledRegistryPath(),
    JSON.stringify(compiled, null, 2)
  );

  return compiled;
}

/**
 * Create an empty registry manifest
 */
export function createEmptyManifest(): RemoteRegistryManifest {
  return {
    $schema: REGISTRY_SCHEMA_URL,
    name: "looplia-official",
    homepage: "https://github.com/memorysaver/looplia-core",
    version: "0.7.0",
    updatedAt: new Date().toISOString(),
    items: [],
  };
}
