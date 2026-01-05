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

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  CompiledRegistry,
  CompiledSkill,
  RegistrySkillItem,
  RegistrySource,
  RemoteRegistryManifest,
  SkillCategory,
} from "@looplia-core/core";
import { pathExists } from "../utils/fs";
import { createProgress } from "./progress";

/** Official registry URL */
const OFFICIAL_REGISTRY_URL =
  "https://github.com/memorysaver/looplia-core/releases/latest/download/registry.json";

/** Default schema URL */
const REGISTRY_SCHEMA_URL = "https://looplia.com/schema/registry.json";

/** Registry format version */
const REGISTRY_VERSION = "1.0.0";

// Top-level regex patterns
const TRAILING_SLASH_REGEX = /\/$/;
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

// Capability inference patterns
const CAPABILITY_PATTERNS = [
  { pattern: /media|video|audio|image/, capability: "media-processing" },
  { pattern: /content|text|document/, capability: "content-analysis" },
  { pattern: /json|schema|structured/, capability: "structured-output" },
  { pattern: /workflow|orchestrat/, capability: "workflow-management" },
  { pattern: /search|find|discover/, capability: "search" },
  { pattern: /generat|creat|produc/, capability: "generation" },
  { pattern: /valid|check|verify/, capability: "validation" },
] as const;

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
      ? `github:${url.replace("github.com/", "").replace(TRAILING_SLASH_REGEX, "")}`
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
 * Parse YAML frontmatter into a key-value map
 * Handles multiline values with YAML literal block scalar (|)
 */
function parseYamlFrontmatter(frontmatter: string): Record<string, string> {
  const lines = frontmatter.split("\n");
  const metadata: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) {
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Handle multi-line values with YAML literal block scalar (|)
    if (value === "|") {
      value = parseMultilineValue(lines, i + 1);
    }

    metadata[key] = value;
  }

  return metadata;
}

/**
 * Extract multiline value from indented lines
 */
function parseMultilineValue(lines: string[], startIndex: number): string {
  const multilineLines: string[] = [];
  for (let j = startIndex; j < lines.length; j++) {
    const nextLine = lines[j];
    if (nextLine === undefined) {
      break;
    }
    if (nextLine.startsWith("  ")) {
      multilineLines.push(nextLine.trim());
    } else if (nextLine.trim() !== "") {
      break;
    }
  }
  return multilineLines.join(" ");
}

/**
 * Build CompiledSkill from parsed metadata
 */
function buildSkillFromMetadata(
  metadata: Record<string, string>
): Partial<CompiledSkill> {
  const category = inferCategory(
    metadata.name ?? "",
    metadata.description ?? ""
  );
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
    const frontmatterMatch = content.match(FRONTMATTER_REGEX);

    if (!frontmatterMatch?.[1]) {
      return null;
    }

    const metadata = parseYamlFrontmatter(frontmatterMatch[1]);
    return buildSkillFromMetadata(metadata);
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

  for (const { pattern, capability } of CAPABILITY_PATTERNS) {
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
 * Scan a single plugin directory for skills
 */
async function scanPluginDirectory(
  pluginPath: string,
  pluginName: string,
  sourceType: "builtin" | "thirdparty"
): Promise<CompiledSkill[]> {
  const skills: CompiledSkill[] = [];
  const skillsPath = join(pluginPath, "skills");

  if (!(await pathExists(skillsPath))) {
    return skills;
  }

  try {
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
          plugin: pluginName,
          category: metadata.category ?? "utility",
          capabilities: metadata.capabilities ?? [],
          tools: metadata.tools,
          model: metadata.model,
          inputless: metadata.inputless,
          source: "local",
          sourceType,
          installed: true,
          installedPath: skillPath,
        });
      }
    }
  } catch {
    // Ignore errors scanning skills
  }

  return skills;
}

/**
 * Scan local plugins for installed skills
 * Scans both built-in plugins (looplia-*) and third-party plugins (plugins/*)
 */
async function scanLocalPlugins(loopliaPath: string): Promise<CompiledSkill[]> {
  const skills: CompiledSkill[] = [];

  // Scan built-in plugins (looplia-core, looplia-writer, etc.)
  try {
    const entries = await readdir(loopliaPath, { withFileTypes: true });
    const builtinDirs = entries.filter(
      (e) =>
        e.isDirectory() &&
        !e.name.startsWith(".") &&
        e.name !== "sandbox" &&
        e.name !== "workflows" &&
        e.name !== "registry" &&
        e.name !== "plugins"
    );

    for (const pluginDir of builtinDirs) {
      const pluginPath = join(loopliaPath, pluginDir.name);
      const pluginSkills = await scanPluginDirectory(
        pluginPath,
        pluginDir.name,
        "builtin"
      );
      skills.push(...pluginSkills);
    }
  } catch {
    // Ignore errors scanning built-in plugins
  }

  // Scan third-party plugins (~/.looplia/plugins/*)
  const pluginsDir = join(loopliaPath, "plugins");
  if (await pathExists(pluginsDir)) {
    try {
      const entries = await readdir(pluginsDir, { withFileTypes: true });
      const thirdPartyDirs = entries.filter(
        (e) => e.isDirectory() && !e.name.startsWith(".")
      );

      for (const pluginDir of thirdPartyDirs) {
        const pluginPath = join(pluginsDir, pluginDir.name);
        const pluginSkills = await scanPluginDirectory(
          pluginPath,
          pluginDir.name,
          "thirdparty"
        );
        skills.push(...pluginSkills);
      }
    } catch {
      // Ignore errors scanning third-party plugins
    }
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
    gitUrl: source.type === "github" ? `https://${source.url}` : undefined,
    checksum: item.checksum,
    dependencies: item.registryDependencies,
  };
}

/**
 * Process a single local source and add skills
 */
async function processLocalSource(
  source: RegistrySource,
  seenSkills: Set<string>,
  allSkills: CompiledSkill[],
  progress: ReturnType<typeof createProgress> | null
): Promise<void> {
  progress?.start(`Scanning local source: ${source.id}`);

  try {
    const localPath = source.url.startsWith("~")
      ? source.url.replace("~", homedir())
      : source.url;

    if (!(await pathExists(localPath))) {
      progress?.fail(`Local source not found: ${source.url}`);
      return;
    }

    const skills = await scanPluginDirectory(
      localPath,
      source.id,
      "thirdparty"
    );
    let addedCount = 0;

    for (const skill of skills) {
      if (seenSkills.has(skill.name)) {
        continue;
      }
      skill.source = source.id;
      allSkills.push(skill);
      seenSkills.add(skill.name);
      addedCount += 1;
    }

    progress?.succeed(`Scanned ${source.id}: ${addedCount} skills`);
  } catch {
    progress?.fail(`Failed to scan: ${source.id}`);
  }
}

/**
 * Options for processing a remote source
 */
type ProcessRemoteSourceOptions = {
  source: RegistrySource;
  seenSkills: Set<string>;
  allSkills: CompiledSkill[];
  installedSkillsMap: Map<string, CompiledSkill>;
  progress: ReturnType<typeof createProgress> | null;
};

/**
 * Process a single remote source and add skills
 */
async function processRemoteSource(
  options: ProcessRemoteSourceOptions
): Promise<void> {
  const { source, seenSkills, allSkills, installedSkillsMap, progress } =
    options;
  progress?.start(`Fetching registry: ${source.id}`);

  const manifest = await fetchRemoteRegistry(source);
  if (!manifest) {
    progress?.fail(`Failed to fetch: ${source.id}`);
    return;
  }

  let addedCount = 0;
  for (const item of manifest.items) {
    if (seenSkills.has(item.name)) {
      continue;
    }
    const skill = convertToCompiledSkill(item, source, installedSkillsMap);
    allSkills.push(skill);
    seenSkills.add(item.name);
    addedCount += 1;
  }

  progress?.succeed(`Fetched ${source.id}: ${addedCount} new skills`);
}

/**
 * Build registry summary from skills
 */
function buildRegistrySummary(skills: CompiledSkill[]): {
  byCategory: Record<SkillCategory, number>;
  bySource: Record<string, number>;
} {
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

  for (const skill of skills) {
    byCategory[skill.category] += 1;
    bySource[skill.source] = (bySource[skill.source] ?? 0) + 1;
  }

  return { byCategory, bySource };
}

/**
 * Compile registry from all sources
 *
 * @param showProgress - Whether to show progress indicators (default: false)
 */
export async function compileRegistry(
  showProgress = false
): Promise<CompiledRegistry> {
  const progress = showProgress ? createProgress() : null;
  const loopliaPath = join(homedir(), ".looplia");
  const sources = await loadSources();

  // Scan local plugins first
  progress?.start("Scanning local plugins");
  const localSkills = await scanLocalPlugins(loopliaPath);
  const installedSkillsMap = new Map(localSkills.map((s) => [s.name, s]));
  progress?.succeed(`Found ${localSkills.length} local skills`);

  // Collect all skills
  const allSkills: CompiledSkill[] = [...localSkills];
  const seenSkills = new Set(localSkills.map((s) => s.name));

  // Process local sources (custom plugin directories)
  const localSources = sources.filter((s) => s.enabled && s.type === "local");
  for (const source of localSources) {
    await processLocalSource(source, seenSkills, allSkills, progress);
  }

  // Fetch remote registries (sorted by priority, higher priority wins)
  const remoteSources = sources
    .filter((s) => s.enabled && s.type !== "local")
    .sort((a, b) => b.priority - a.priority);

  for (const source of remoteSources) {
    await processRemoteSource({
      source,
      seenSkills,
      allSkills,
      installedSkillsMap,
      progress,
    });
  }

  // Build summary and compiled registry
  const { byCategory, bySource } = buildRegistrySummary(allSkills);

  const compiled: CompiledRegistry = {
    compiledAt: new Date().toISOString(),
    version: REGISTRY_VERSION,
    sources,
    skills: allSkills,
    summary: { totalSkills: allSkills.length, byCategory, bySource },
  };

  // Write compiled registry
  const registryPath = getRegistryPath();
  await mkdir(registryPath, { recursive: true });
  await writeFile(getCompiledRegistryPath(), JSON.stringify(compiled, null, 2));

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
