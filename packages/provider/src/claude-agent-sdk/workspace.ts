import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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
};

/**
 * Expand ~ to home directory
 */
function expandPath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  if (path === "~") {
    return homedir();
  }
  return path;
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
 * Copy a single entry (file or directory) if destination doesn't exist
 */
async function copyEntryIfMissing(
  srcPath: string,
  destPath: string,
  isDirectory: boolean
): Promise<void> {
  if (await pathExists(destPath)) {
    return;
  }
  await cp(srcPath, destPath, { recursive: isDirectory });
}

/**
 * Copy all entries from source to destination directory
 */
async function copyDirectoryEntries(
  srcDir: string,
  destDir: string
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    await copyEntryIfMissing(srcPath, destPath, entry.isDirectory());
  }
}

/**
 * Copy a single asset directory from bundled to workspace
 */
async function copyAssetDirectory(
  bundledDir: string,
  workspaceDir: string,
  dir: string
): Promise<void> {
  const srcDir = join(bundledDir, dir);
  const destDir = join(workspaceDir, dir);

  if (!(await pathExists(srcDir))) {
    return;
  }

  await mkdir(destDir, { recursive: true });

  try {
    await copyDirectoryEntries(srcDir, destDir);
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
async function copyBundledAssets(workspaceDir: string): Promise<void> {
  const bundledDir = getBundledAssetsDir();
  const assetDirs = ["agents", "skills"];

  for (const dir of assetDirs) {
    await copyAssetDirectory(bundledDir, workspaceDir, dir);
  }
}

/**
 * Ensure the Looplia workspace exists and is properly initialized
 *
 * Creates ~/.looplia/ (or configured workspace) and copies bundled
 * agents/skills/prompts if missing. Subsequent edits are preserved.
 *
 * @param options - Configuration options
 * @returns The absolute path to the workspace directory
 */
export async function ensureWorkspace(
  options?: WorkspaceOptions
): Promise<string> {
  const baseDir = options?.baseDir ?? "~/.looplia";
  const installDefaults = options?.installDefaults ?? true;

  const workspaceDir = expandPath(baseDir);

  // Create workspace directory structure
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(join(workspaceDir, "agents"), { recursive: true });
  await mkdir(join(workspaceDir, "skills"), { recursive: true });
  await mkdir(join(workspaceDir, "plugins"), { recursive: true });

  // Copy bundled assets if requested and they don't exist
  if (installDefaults) {
    await copyBundledAssets(workspaceDir);
  }

  return workspaceDir;
}

/**
 * Get the resolved workspace path without initializing
 */
export function getWorkspacePath(baseDir?: string): string {
  return expandPath(baseDir ?? "~/.looplia");
}
