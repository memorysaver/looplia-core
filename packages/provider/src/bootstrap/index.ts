/**
 * Bootstrap Module
 *
 * Handles plugin installation for different modes:
 * - NPM Bundle: Copy from npm package to ~/.looplia
 * - Remote: Download from GitHub release to ~/.looplia
 * - Development: Uses ./plugins directly (no copy needed)
 *
 * Uses marketplace.json for dynamic plugin discovery.
 */

import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Marketplace plugin entry
 */
type MarketplacePlugin = {
  name: string;
  description: string;
  source: string; // e.g., "./plugins/looplia-core"
  category: string;
  homepage?: string;
};

/**
 * Marketplace manifest structure
 */
type Marketplace = {
  name: string;
  description: string;
  plugins: MarketplacePlugin[];
};

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
 * Compute SHA256 hash of a file
 */
async function computeSha256(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Validate that all extracted paths stay within the base directory
 * (Protection against path traversal attacks in tarballs)
 */
async function validateExtractedPaths(baseDir: string): Promise<void> {
  const realBase = await realpath(baseDir);
  const entries = await readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(baseDir, entry.name);
    const entryRealPath = await realpath(fullPath);

    if (!entryRealPath.startsWith(realBase)) {
      throw new Error(
        `Security: Path traversal detected in extracted file: ${entry.name}`
      );
    }

    // Recursively check subdirectories
    if (entry.isDirectory()) {
      await validateExtractedPaths(fullPath);
    }
  }
}

/**
 * Get the looplia plugin path (~/.looplia)
 */
export function getLoopliaPluginPath(): string {
  return join(homedir(), ".looplia");
}

/**
 * Get the bundled plugins directory from the npm package
 *
 * When installed via npm, plugins are bundled at:
 * node_modules/looplia/plugins/
 */
function getBundledPluginsPath(): string {
  // Get the directory of this file
  const currentFile =
    typeof __dirname !== "undefined"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));

  // Navigate from dist/bootstrap/ to package root, then to plugins/:
  // dist/bootstrap/ -> dist/ (..) -> package-root/ (..) -> plugins/
  return join(currentFile, "..", "..", "plugins");
}

/**
 * Parse marketplace.json to get plugin list
 */
async function parseMarketplace(marketplacePath: string): Promise<Marketplace> {
  const content = await readFile(marketplacePath, "utf-8");
  return JSON.parse(content) as Marketplace;
}

/**
 * Get plugin names from marketplace.json or scan directory
 */
async function getPluginNamesFromSource(
  bundledPath: string
): Promise<string[]> {
  // Try to find marketplace.json in parent's .claude-plugin folder
  const marketplacePath = join(
    bundledPath,
    "..",
    ".claude-plugin",
    "marketplace.json"
  );

  if (await pathExists(marketplacePath)) {
    const marketplace = await parseMarketplace(marketplacePath);
    return marketplace.plugins
      .map((p) => {
        // Extract folder name from source path like "./plugins/looplia-core"
        const parts = p.source.split("/");
        return parts.at(-1);
      })
      .filter((name): name is string => name !== undefined);
  }

  // Fallback: scan plugins directory
  const entries = await readdir(bundledPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);
}

/**
 * Create default user profile
 */
function createDefaultProfile(): object {
  return {
    userId: "default",
    topics: [],
    style: {
      tone: "intermediate",
      targetWordCount: 1000,
      voice: "first-person",
    },
  };
}

/**
 * Extract workflows from plugins to root workflows directory
 *
 * Workflows are looplia-specific templates, not Claude plugin components.
 * This extracts them from each plugin to ~/.looplia/workflows/ for
 * simple CLI lookup and user custom workflows.
 */
async function extractWorkflows(
  targetDir: string,
  pluginNames: string[]
): Promise<void> {
  const workflowsDir = join(targetDir, "workflows");
  await mkdir(workflowsDir, { recursive: true });

  for (const pluginName of pluginNames) {
    const pluginWorkflowsPath = join(targetDir, pluginName, "workflows");
    if (!(await pathExists(pluginWorkflowsPath))) {
      continue;
    }

    // Copy workflow .md files to root workflows/
    const entries = await readdir(pluginWorkflowsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        await cp(
          join(pluginWorkflowsPath, entry.name),
          join(workflowsDir, entry.name)
        );
      }
    }

    // Remove workflows from plugin to avoid confusion
    await rm(pluginWorkflowsPath, { recursive: true, force: true });
  }
}

/**
 * Copy plugins to target directory (no merge, keeps separate)
 *
 * This is used when users run `looplia init` after installing via npm.
 * Reads plugin list from marketplace.json for dynamic discovery.
 *
 * @param targetDir - Target directory (e.g., ~/.looplia)
 * @param sourcePath - Optional source path for bundled plugins. If not provided,
 *                     uses getBundledPluginsPath() which works for npm installs.
 */
export async function copyPlugins(
  targetDir: string,
  sourcePath?: string
): Promise<void> {
  const bundledPath = sourcePath ?? getBundledPluginsPath();

  // Get plugin list from marketplace.json (dynamic, not hardcoded)
  const pluginNames = await getPluginNamesFromSource(bundledPath);

  if (pluginNames.length === 0) {
    throw new Error(`No plugins found at ${bundledPath}`);
  }

  // Clean and create target directory
  if (await pathExists(targetDir)) {
    await rm(targetDir, { recursive: true, force: true });
  }
  await mkdir(targetDir, { recursive: true });

  // Copy all plugins from marketplace (no merge, keep separate)
  for (const pluginName of pluginNames) {
    const pluginPath = join(bundledPath, pluginName);
    if (await pathExists(pluginPath)) {
      await cp(pluginPath, join(targetDir, pluginName), { recursive: true });
    }
  }

  // Extract workflows from plugins to root
  await extractWorkflows(targetDir, pluginNames);

  // Create sandbox directory
  await mkdir(join(targetDir, "sandbox"), { recursive: true });

  // Create default user profile
  await writeFile(
    join(targetDir, "user-profile.json"),
    JSON.stringify(createDefaultProfile(), null, 2),
    "utf-8"
  );
}

/**
 * Download plugins from GitHub release
 *
 * This is used when users run `looplia init --remote` to download
 * the latest (or specific version) plugin release from GitHub.
 */
export async function downloadRemotePlugins(
  version: string,
  targetDir: string
): Promise<void> {
  const releaseUrl =
    version === "latest"
      ? "https://github.com/memorysaver/looplia-core/releases/latest/download/plugins.tar.gz"
      : `https://github.com/memorysaver/looplia-core/releases/download/${version}/plugins.tar.gz`;

  console.log(`Downloading looplia plugins from ${releaseUrl}...`);

  // Download to temp directory first
  const tempDir = join(tmpdir(), `looplia-download-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    // Download the tarball
    const response = await fetch(releaseUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download plugins: ${response.status} ${response.statusText}`
      );
    }

    // Save tarball
    const tarPath = join(tempDir, "plugins.tar.gz");
    await writeFile(tarPath, Buffer.from(await response.arrayBuffer()));

    // Security: Verify checksum if available
    const checksumUrl = `${releaseUrl}.sha256`;
    const checksumResponse = await fetch(checksumUrl);
    if (checksumResponse.ok) {
      const checksumText = await checksumResponse.text();
      const checksumParts = checksumText.split(" ");
      const expectedChecksum = checksumParts[0]?.trim();

      if (!expectedChecksum) {
        throw new Error("Invalid checksum file format");
      }

      const actualChecksum = await computeSha256(tarPath);

      if (actualChecksum !== expectedChecksum) {
        throw new Error(
          `Checksum verification failed. Expected: ${expectedChecksum}, Got: ${actualChecksum}`
        );
      }
      console.log("✓ Checksum verified");
    } else {
      console.log(
        "⚠ Checksum file not available (older release), skipping verification"
      );
    }

    // Extract using tar (available on macOS/Linux)
    // Using async exec to avoid blocking the event loop
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    try {
      await execAsync("tar -xzf plugins.tar.gz", { cwd: tempDir });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to extract plugins tarball. Ensure 'tar' is available. Error: ${errorMessage}`
      );
    }

    await rm(tarPath);

    // Security: Validate extracted paths (prevent path traversal attacks)
    await validateExtractedPaths(tempDir);

    // Copy plugins (no merge)
    await copyPlugins(targetDir, tempDir);

    console.log(`Plugins downloaded and extracted to ${targetDir}`);
  } finally {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    });
  }
}

/**
 * Check if looplia is initialized (any plugin exists at ~/.looplia)
 */
export async function isLoopliaInitialized(): Promise<boolean> {
  const pluginPath = getLoopliaPluginPath();

  try {
    const entries = await readdir(pluginPath, { withFileTypes: true });
    return entries.some(
      (e) =>
        e.isDirectory() &&
        !e.name.startsWith(".") &&
        e.name !== "sandbox" &&
        e.name !== "workflows"
    );
  } catch {
    return false;
  }
}

/**
 * Get plugin paths for development mode
 *
 * In development mode (LOOPLIA_DEV=true), we load plugins directly
 * from the project's plugins/ folder without copying.
 */
export function getDevPluginPaths(
  projectRoot: string
): Array<{ type: "local"; path: string }> {
  return [
    { type: "local", path: join(projectRoot, "plugins", "looplia-core") },
    { type: "local", path: join(projectRoot, "plugins", "looplia-writer") },
  ];
}

/**
 * Get plugin paths for production mode
 *
 * In production mode, we scan ~/.looplia for installed plugins.
 */
export async function getProdPluginPaths(): Promise<
  Array<{ type: "local"; path: string }>
> {
  const loopliaPath = getLoopliaPluginPath();

  try {
    const entries = await readdir(loopliaPath, { withFileTypes: true });
    const pluginDirs = entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith(".") &&
          e.name !== "sandbox" &&
          e.name !== "workflows"
      )
      .map((e) => e.name);

    return pluginDirs.map((name) => ({
      type: "local" as const,
      path: join(loopliaPath, name),
    }));
  } catch {
    return [];
  }
}

/**
 * Get plugin paths based on current mode
 *
 * - LOOPLIA_DEV=true: Use source plugins directly (development)
 *   - LOOPLIA_DEV_ROOT specifies repo root (defaults to cwd)
 * - Otherwise: Scan ~/.looplia for installed plugins (production)
 */
export async function getPluginPaths(): Promise<
  Array<{ type: "local"; path: string }>
> {
  if (process.env.LOOPLIA_DEV === "true") {
    const devRoot = process.env.LOOPLIA_DEV_ROOT ?? process.cwd();
    return getDevPluginPaths(devRoot);
  }
  return await getProdPluginPaths();
}

/**
 * Check if running in development mode
 */
export function isDevMode(): boolean {
  return process.env.LOOPLIA_DEV === "true";
}
