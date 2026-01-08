/**
 * Registry Compiler (v0.7.1)
 *
 * Compiles skill catalog from multiple sources into a unified local cache.
 * - Scans local plugins for installed skills (always)
 * - Fetches remote registries only when explicitly requested (localOnly: false)
 * - Merges and deduplicates entries
 * - Writes skill-catalog.json for fast lookup
 *
 * v0.7.1 Change: Build command uses localOnly=true by default (no network).
 * Remote fetching is explicit via `looplia registry sync`.
 *
 * @see docs/DESIGN-0.7.1.md
 */

import { exec } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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
import {
  FRONTMATTER_REGEX,
  formatTitle,
  inferCapabilities,
  inferCategory,
  LEADING_DOT_SLASH_REGEX,
  PROTOCOL_REGEX,
  parseYamlFrontmatter,
  TRAILING_SLASH_REGEX,
} from "./utils";

/** Registry format version */
const REGISTRY_VERSION = "1.0.0";

/**
 * Default skill marketplace sources (v0.7.1)
 * These are pre-populated in sources.json during registry init
 */
export const DEFAULT_MARKETPLACE_SOURCES = [
  {
    name: "looplia-skills",
    url: "https://github.com/memorysaver/looplia-skills",
    description: "Looplia curated skills collection",
  },
  {
    name: "anthropic-skills",
    url: "https://github.com/anthropics/skills",
    description:
      "Official Anthropic skills - xlsx, pdf, pptx, docx, frontend-design, and more",
  },
  {
    name: "awesome-claude-skills",
    url: "https://github.com/ComposioHQ/awesome-claude-skills",
    description: "Community-curated Claude skills collection by ComposioHQ",
  },
] as const;

/**
 * Get the looplia home directory path
 * Respects LOOPLIA_HOME env var for testing/custom installations
 */
function getLoopliaHome(): string {
  return process.env.LOOPLIA_HOME ?? join(homedir(), ".looplia");
}

/**
 * Get the registry directory path
 */
export function getRegistryPath(): string {
  return join(getLoopliaHome(), "registry");
}

/**
 * Get the skill catalog file path
 * @alias getSkillCatalogPath
 */
export function getCompiledRegistryPath(): string {
  return join(getRegistryPath(), "skill-catalog.json");
}

/**
 * Get the skill catalog file path (preferred name)
 */
export const getSkillCatalogPath = getCompiledRegistryPath;

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

  // Create sources.json with predefined third-party sources if it doesn't exist or force
  // v0.7.1: Pre-populate with known skill marketplaces from DEFAULT_MARKETPLACE_SOURCES
  if (force || !(await pathExists(sourcesPath))) {
    const defaultSources: RegistrySource[] = DEFAULT_MARKETPLACE_SOURCES.map(
      (source, index) => ({
        id: `github:${source.url.replace("https://github.com/", "")}`,
        type: "github" as const,
        url: source.url,
        enabled: true,
        priority: 90 - index * 10, // First source gets highest priority
        addedAt: new Date().toISOString(),
      })
    );
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
 *
 * For GitHub sources, the format (marketplace.json vs registry.json)
 * is auto-detected during compilation.
 */
export async function addSource(
  url: string,
  type: "github" | "local" = "github"
): Promise<RegistrySource> {
  const sources = await loadSources();

  // Normalize URL for ID generation
  const normalizedPath = url
    .replace(PROTOCOL_REGEX, "")
    .replace("github.com/", "")
    .replace(TRAILING_SLASH_REGEX, "");

  // Generate unique ID from URL
  const id = type === "github" ? `github:${normalizedPath}` : `local:${url}`;

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
 * Marketplace JSON format from Anthropic skills repo
 */
type MarketplacePlugin = {
  name: string;
  description: string;
  skills: string[]; // ["./skills/xlsx", "./skills/pdf"]
};

type MarketplaceJson = {
  name: string;
  version?: string;
  plugins: MarketplacePlugin[];
};

/**
 * Result of fetching a remote registry with format detection
 */
type FetchResult = {
  manifest: RemoteRegistryManifest;
  format: "marketplace" | "registry";
};

/**
 * Try to fetch marketplace.json from a GitHub repo
 */
async function tryFetchMarketplace(
  repoPath: string
): Promise<RemoteRegistryManifest | null> {
  const url = `https://raw.githubusercontent.com/${repoPath}/main/.claude-plugin/marketplace.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const marketplace = (await response.json()) as MarketplaceJson;

    // Convert marketplace format to registry manifest format
    const items: RegistrySkillItem[] = [];
    for (const plugin of marketplace.plugins) {
      for (const skillPath of plugin.skills) {
        // Extract skill name from path (e.g., "./skills/xlsx" -> "xlsx")
        const skillName = skillPath.split("/").pop() ?? skillPath;

        items.push({
          name: skillName,
          type: "registry:skill",
          title: formatTitle(skillName),
          description: `Skill from ${plugin.name}`,
          author: plugin.name,
          plugin: plugin.name,
          category: inferCategory(skillName, plugin.description),
          capabilities: inferCapabilities(plugin.description),
          downloadUrl: `https://github.com/${repoPath}`,
          files: [],
          // Store skillPath for JIT installation
          skillPath: skillPath.replace(LEADING_DOT_SLASH_REGEX, ""),
        });
      }
    }

    return {
      name: marketplace.name,
      homepage: `https://github.com/${repoPath}`,
      version: marketplace.version ?? "1.0.0",
      updatedAt: new Date().toISOString(),
      items,
    };
  } catch {
    return null;
  }
}

/**
 * Try to fetch registry.json from GitHub releases
 */
async function tryFetchRegistryJson(
  repoPath: string
): Promise<RemoteRegistryManifest | null> {
  const url = `https://github.com/${repoPath}/releases/latest/download/registry.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as RemoteRegistryManifest;
  } catch {
    return null;
  }
}

/**
 * Fetch remote registry manifest with auto-detection
 *
 * For GitHub sources, tries marketplace.json first, then falls back to registry.json.
 * This allows repos like anthropics/skills to work without special configuration.
 */
async function fetchRemoteRegistry(
  source: RegistrySource
): Promise<FetchResult | null> {
  // Auto-detect format from GitHub URL
  const repoPath = source.url
    .replace(PROTOCOL_REGEX, "")
    .replace("github.com/", "")
    .replace(TRAILING_SLASH_REGEX, "");

  // 1. Try marketplace.json first (most common for skill repos)
  const marketplaceManifest = await tryFetchMarketplace(repoPath);
  if (marketplaceManifest) {
    return { manifest: marketplaceManifest, format: "marketplace" };
  }

  // 2. Fall back to registry.json in releases
  const registryManifest = await tryFetchRegistryJson(repoPath);
  if (registryManifest) {
    return { manifest: registryManifest, format: "registry" };
  }

  console.warn(
    `No registry found for ${source.url} (tried marketplace.json and registry.json)`
  );
  return null;
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
 * Get git remote URL for a repository
 * Tries multiple methods:
 * 1. Read from plugin.json source.url (marketplace-installed plugins)
 * 2. Run git remote get-url origin (git-cloned plugins)
 */
async function getGitRemoteUrl(repoPath: string): Promise<string | undefined> {
  // 1. Try reading from plugin.json (marketplace plugins have source.url)
  const pluginJsonPath = join(repoPath, ".claude-plugin", "plugin.json");
  try {
    if (await pathExists(pluginJsonPath)) {
      const content = await readFile(pluginJsonPath, "utf-8");
      const pluginJson = JSON.parse(content) as {
        source?: { url?: string };
      };
      if (pluginJson.source?.url) {
        return pluginJson.source.url;
      }
    }
  } catch {
    // Fall through to git method
  }

  // 2. Try git remote (for directly cloned repos)
  try {
    const { stdout } = await execAsync("git remote get-url origin", {
      cwd: repoPath,
    });
    return stdout.trim() || undefined;
  } catch {
    return;
  }
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

  // For third-party plugins, try to get git remote URL
  const gitUrl =
    sourceType === "thirdparty" ? await getGitRemoteUrl(pluginPath) : undefined;

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
          gitUrl,
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
 *
 * For GitHub sources, auto-detects format (marketplace.json vs registry.json)
 * and processes accordingly.
 */
async function processRemoteSource(
  options: ProcessRemoteSourceOptions
): Promise<void> {
  const { source, seenSkills, allSkills, installedSkillsMap, progress } =
    options;

  progress?.start(`Fetching registry: ${source.id}`);

  const result = await fetchRemoteRegistry(source);
  if (!result) {
    progress?.fail(`Failed to fetch: ${source.id}`);
    return;
  }

  const { manifest, format } = result;
  let addedCount = 0;

  for (const item of manifest.items) {
    if (seenSkills.has(item.name)) {
      continue;
    }

    const installed = installedSkillsMap.get(item.name);

    // For marketplace format, include skillPath for JIT installation
    // The skillPath is already set in the item from tryFetchMarketplace
    const skill: CompiledSkill = {
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
      sourceType: "thirdparty",
      installed: installed !== undefined,
      installedPath: installed?.installedPath,
      gitUrl: item.downloadUrl,
      skillPath: item.skillPath, // Set by marketplace format, undefined for registry.json
      checksum: item.checksum,
      dependencies: item.registryDependencies,
    };

    allSkills.push(skill);
    seenSkills.add(item.name);
    addedCount += 1;
  }

  const formatLabel = format === "marketplace" ? "marketplace" : "registry";
  progress?.succeed(
    `Fetched ${source.id} (${formatLabel}): ${addedCount} skills`
  );
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
 * Options for compileRegistry
 */
export type CompileRegistryOptions = {
  /** Whether to show progress indicators (default: false) */
  showProgress?: boolean;
  /** Only scan local plugins, skip remote fetching (default: true)
   *
   * - `true`: Fast local-only compilation (used by `looplia build`)
   * - `false`: Full compilation with remote registry fetch (used by `looplia registry sync`)
   */
  localOnly?: boolean;
};

/**
 * Compile registry from all sources
 *
 * @param options - Compilation options
 * @param options.showProgress - Whether to show progress indicators (default: false)
 * @param options.localOnly - Only scan local plugins, skip remote fetching (default: true)
 */
export async function compileRegistry(
  options?: CompileRegistryOptions
): Promise<CompiledRegistry> {
  const { showProgress = false, localOnly = true } = options ?? {};
  const progress = showProgress ? createProgress() : null;
  const loopliaPath = getLoopliaHome();
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

  // v0.7.1: Only fetch remote registries when explicitly requested
  if (!localOnly) {
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
    name: "looplia",
    homepage: "https://github.com/memorysaver/looplia-core",
    version: "0.7.1",
    updatedAt: new Date().toISOString(),
    items: [],
  };
}
