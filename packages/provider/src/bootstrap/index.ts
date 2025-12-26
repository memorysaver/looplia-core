/**
 * Bootstrap Module
 *
 * Handles plugin installation for different modes:
 * - NPM Bundle: Copy from npm package to ~/.looplia
 * - Remote: Download from GitHub release to ~/.looplia
 * - Development: Uses ./plugins directly (no copy needed)
 */

import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
 * Copy bundled plugins to target directory (merging core + writer)
 *
 * This is used when users run `looplia init` after installing via npm.
 * It merges looplia-core and looplia-writer into a single plugin at ~/.looplia.
 *
 * @param targetDir - Target directory (e.g., ~/.looplia)
 * @param sourcePath - Optional source path for bundled plugins. If not provided,
 *                     uses getBundledPluginsPath() which works for npm installs.
 */
export async function copyBundledPlugins(
  targetDir: string,
  sourcePath?: string
): Promise<void> {
  const bundledPath = sourcePath ?? getBundledPluginsPath();
  const corePath = join(bundledPath, "looplia-core");
  const writerPath = join(bundledPath, "looplia-writer");

  // Verify bundled plugins exist
  if (!(await pathExists(corePath))) {
    throw new Error(
      `Bundled plugins not found at ${corePath}. Ensure you installed looplia correctly.`
    );
  }

  // Clean target directory
  if (await pathExists(targetDir)) {
    await rm(targetDir, { recursive: true, force: true });
  }
  await mkdir(targetDir, { recursive: true });

  // Create merged plugin.json
  await mkdir(join(targetDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(targetDir, ".claude-plugin", "plugin.json"),
    JSON.stringify(
      {
        name: "looplia",
        description:
          "Looplia workflow engine - Execute workflow-as-markdown definitions with validation-driven completion",
        version: "0.6.5",
        author: { name: "Looplia" },
        keywords: ["workflow", "agentic", "automation", "validation"],
        homepage: "https://github.com/memorysaver/looplia-core",
      },
      null,
      2
    ),
    "utf-8"
  );

  // Copy from looplia-core (commands, skills, hooks, scripts)
  const coreCommands = join(corePath, "commands");
  if (await pathExists(coreCommands)) {
    await cp(coreCommands, join(targetDir, "commands"), { recursive: true });
  }

  const coreSkills = join(corePath, "skills");
  if (await pathExists(coreSkills)) {
    await cp(coreSkills, join(targetDir, "skills"), { recursive: true });
  }

  const coreHooks = join(corePath, "hooks");
  if (await pathExists(coreHooks)) {
    await cp(coreHooks, join(targetDir, "hooks"), { recursive: true });
  }

  const coreScripts = join(corePath, "scripts");
  if (await pathExists(coreScripts)) {
    await cp(coreScripts, join(targetDir, "scripts"), { recursive: true });
  }

  const coreAgents = join(corePath, "agents");
  if (await pathExists(coreAgents)) {
    await mkdir(join(targetDir, "agents"), { recursive: true });
    await cp(coreAgents, join(targetDir, "agents"), { recursive: true });
  }

  // Merge from looplia-writer (skills, workflows)
  if (await pathExists(writerPath)) {
    const writerSkills = join(writerPath, "skills");
    if (await pathExists(writerSkills)) {
      await cp(writerSkills, join(targetDir, "skills"), { recursive: true });
    }

    const writerWorkflows = join(writerPath, "workflows");
    if (await pathExists(writerWorkflows)) {
      await cp(writerWorkflows, join(targetDir, "workflows"), {
        recursive: true,
      });
    }

    const writerAgents = join(writerPath, "agents");
    if (await pathExists(writerAgents)) {
      await cp(writerAgents, join(targetDir, "agents"), { recursive: true });
    }
  }

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

  // Clean target directory
  if (await pathExists(targetDir)) {
    await rm(targetDir, { recursive: true, force: true });
  }
  await mkdir(targetDir, { recursive: true });

  // Download the tarball
  const response = await fetch(releaseUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download plugins: ${response.status} ${response.statusText}`
    );
  }

  // Save tarball temporarily
  const tarball = await response.arrayBuffer();
  const tarPath = join(targetDir, "plugins.tar.gz");
  await writeFile(tarPath, Buffer.from(tarball));

  // Extract using tar (available on macOS/Linux)
  const { execSync } = await import("node:child_process");
  try {
    execSync("tar -xzf plugins.tar.gz -C . --strip-components=1", {
      cwd: targetDir,
      stdio: "pipe",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to extract plugins tarball. Ensure 'tar' is available. Error: ${errorMessage}`
    );
  } finally {
    // Clean up tarball regardless of success or failure
    try {
      await rm(tarPath);
    } catch {
      // Ignore cleanup errors to avoid masking the original error
    }
  }

  // Create sandbox directory if not in tarball
  const sandboxDir = join(targetDir, "sandbox");
  if (!(await pathExists(sandboxDir))) {
    await mkdir(sandboxDir, { recursive: true });
  }

  // Create default user profile if not in tarball
  const profilePath = join(targetDir, "user-profile.json");
  if (!(await pathExists(profilePath))) {
    await writeFile(
      profilePath,
      JSON.stringify(createDefaultProfile(), null, 2),
      "utf-8"
    );
  }

  console.log(`Plugins downloaded and extracted to ${targetDir}`);
}

/**
 * Check if looplia is initialized (plugin exists at ~/.looplia)
 */
export async function isLoopliaInitialized(): Promise<boolean> {
  const pluginPath = getLoopliaPluginPath();
  const manifestPath = join(pluginPath, ".claude-plugin", "plugin.json");
  return await pathExists(manifestPath);
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
 * In production mode, we use the merged plugin at ~/.looplia
 */
export function getProdPluginPaths(): Array<{ type: "local"; path: string }> {
  return [{ type: "local", path: getLoopliaPluginPath() }];
}

/**
 * Get plugin paths based on current mode
 *
 * - LOOPLIA_DEV=true: Use source plugins directly (development)
 *   - LOOPLIA_DEV_ROOT specifies repo root (defaults to cwd)
 * - Otherwise: Use ~/.looplia (production)
 */
export function getPluginPaths(): Array<{ type: "local"; path: string }> {
  if (process.env.LOOPLIA_DEV === "true") {
    const devRoot = process.env.LOOPLIA_DEV_ROOT ?? process.cwd();
    return getDevPluginPaths(devRoot);
  }
  return getProdPluginPaths();
}

/**
 * Check if running in development mode
 */
export function isDevMode(): boolean {
  return process.env.LOOPLIA_DEV === "true";
}
