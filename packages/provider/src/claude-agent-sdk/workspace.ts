import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Options for workspace initialization
 */
export type WorkspaceOptions = {
  /** Base directory for workspace (default: ~/.looplia) */
  baseDir?: string;

  /** Whether to install default agents/skills/prompts (default: true) */
  installDefaults?: boolean;

  /** Force overwrite existing files (for template upgrades) */
  forceUpdate?: boolean;
};

/**
 * Expand ~ to home directory and validate path safety
 *
 * @throws Error if homedir() returns empty string
 */
function expandPath(path: string): string {
  // Handle tilde expansion
  if (path.startsWith("~/") || path === "~") {
    const home = homedir();
    if (!home) {
      throw new Error("Unable to determine home directory");
    }
    const expanded = path === "~" ? home : join(home, path.slice(2));
    return normalize(expanded);
  }

  // For absolute paths, normalize to resolve any .. or . segments
  if (isAbsolute(path)) {
    return normalize(path);
  }

  // For relative paths, resolve against cwd and normalize
  return normalize(resolve(path));
}

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
 * Get the bundled assets directory
 *
 * Returns the directory containing bundled agents and skills.
 * In development this is src/claude-agent-sdk/, after build it's dist/claude-agent-sdk/
 */
function getBundledAssetsDir(): string {
  return __dirname;
}

/**
 * Copy a single entry (file or directory)
 *
 * @param srcPath - Source path
 * @param destPath - Destination path
 * @param isDirectory - Whether the entry is a directory
 * @param forceUpdate - If true, overwrite existing files
 */
async function copyEntry(
  srcPath: string,
  destPath: string,
  isDirectory: boolean,
  forceUpdate: boolean
): Promise<void> {
  // Skip if destination exists and not forcing update
  if (!forceUpdate && (await pathExists(destPath))) {
    return;
  }
  await cp(srcPath, destPath, { recursive: isDirectory, force: forceUpdate });
}

/**
 * Copy all entries from source to destination directory
 */
async function copyDirectoryEntries(
  srcDir: string,
  destDir: string,
  forceUpdate: boolean
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    await copyEntry(srcPath, destPath, entry.isDirectory(), forceUpdate);
  }
}

/**
 * Copy a single asset directory from bundled to workspace
 */
async function copyAssetDirectory(
  bundledDir: string,
  workspaceDir: string,
  dir: string,
  forceUpdate: boolean
): Promise<void> {
  const srcDir = join(bundledDir, dir);
  const destDir = join(workspaceDir, dir);

  if (!(await pathExists(srcDir))) {
    return;
  }

  await mkdir(destDir, { recursive: true });

  try {
    await copyDirectoryEntries(srcDir, destDir, forceUpdate);
  } catch (error) {
    // Silently ignore ENOENT errors
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Copy bundled assets to workspace
 */
async function copyBundledAssets(
  workspaceDir: string,
  forceUpdate: boolean
): Promise<void> {
  const bundledDir = getBundledAssetsDir();
  const assetDirs = ["agents", "skills"];

  for (const dir of assetDirs) {
    await copyAssetDirectory(bundledDir, workspaceDir, dir, forceUpdate);
  }
}

/**
 * Ensure the Looplia workspace exists and is properly initialized
 *
 * Creates ~/.looplia/ (or configured workspace) and copies bundled
 * agents/skills/prompts if missing. Subsequent edits are preserved
 * unless forceUpdate is set to true.
 *
 * @param options - Configuration options
 * @returns The absolute path to the workspace directory
 *
 * @example
 * ```typescript
 * // Normal init (preserves user edits)
 * const workspace = await ensureWorkspace();
 *
 * // Force update bundled templates
 * const workspace = await ensureWorkspace({ forceUpdate: true });
 * ```
 */
export async function ensureWorkspace(
  options?: WorkspaceOptions
): Promise<string> {
  const baseDir = options?.baseDir ?? "~/.looplia";
  const installDefaults = options?.installDefaults ?? true;
  const forceUpdate = options?.forceUpdate ?? false;

  const workspaceDir = expandPath(baseDir);

  // Create workspace directory structure
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(join(workspaceDir, "agents"), { recursive: true });
  await mkdir(join(workspaceDir, "skills"), { recursive: true });
  await mkdir(join(workspaceDir, "plugins"), { recursive: true });

  // Copy bundled assets if requested
  if (installDefaults) {
    await copyBundledAssets(workspaceDir, forceUpdate);
  }

  return workspaceDir;
}

/**
 * Get the resolved workspace path without initializing
 */
export function getWorkspacePath(baseDir?: string): string {
  return expandPath(baseDir ?? "~/.looplia");
}
