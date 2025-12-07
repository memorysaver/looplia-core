import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve } from "node:path";

/**
 * Options for workspace initialization
 */
export type WorkspaceOptions = {
  /** Base directory for workspace (default: ~/.looplia) */
  baseDir?: string;

  /** Force destructive refresh from plugin (removes existing workspace) */
  force?: boolean;

  /** Check for required files (agents, skills, CLAUDE.md) */
  requireFiles?: boolean;

  /** Skip plugin bootstrap - creates empty structure (for testing) */
  skipPluginBootstrap?: boolean;
};

/**
 * Expand ~ to home directory and validate path safety
 *
 * @throws Error if homedir() returns empty string
 */
export function expandPath(path: string): string {
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
 * Get the plugin directory path
 */
export function getPluginPath(): string {
  // Assuming CLI runs from project root
  return join(process.cwd(), "plugins", "looplia-writer");
}

/**
 * Check if all required workspace files exist
 */
async function checkRequiredFiles(workspaceDir: string): Promise<boolean> {
  const requiredPaths = [
    join(workspaceDir, "CLAUDE.md"),
    join(workspaceDir, ".claude", "agents"),
    join(workspaceDir, ".claude", "skills"),
  ];

  for (const path of requiredPaths) {
    if (!(await pathExists(path))) {
      return false;
    }
  }

  return true;
}

/**
 * Create default user profile JSON
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
 * Create empty workspace structure for testing (without plugin bootstrap)
 */
async function createTestWorkspace(
  workspaceDir: string,
  force: boolean
): Promise<void> {
  const workspaceExists = await pathExists(workspaceDir);
  if (workspaceExists && !force) {
    return;
  }

  if (workspaceExists) {
    await rm(workspaceDir, { recursive: true, force: true });
  }

  await mkdir(workspaceDir, { recursive: true });
  await mkdir(join(workspaceDir, ".claude", "agents"), { recursive: true });
  await mkdir(join(workspaceDir, ".claude", "skills"), { recursive: true });
  await mkdir(join(workspaceDir, "contentItem"), { recursive: true });

  await writeFile(
    join(workspaceDir, "CLAUDE.md"),
    "# Test Workspace\n",
    "utf-8"
  );

  await writeFile(
    join(workspaceDir, "user-profile.json"),
    JSON.stringify(createDefaultProfile(), null, 2),
    "utf-8"
  );
}

/**
 * Bootstrap workspace from plugin directory
 */
async function bootstrapFromPlugin(
  workspaceDir: string,
  pluginDir: string
): Promise<void> {
  const workspaceExists = await pathExists(workspaceDir);
  if (workspaceExists) {
    await rm(workspaceDir, { recursive: true, force: true });
  }

  await mkdir(workspaceDir, { recursive: true });
  await mkdir(join(workspaceDir, ".claude"), { recursive: true });
  await mkdir(join(workspaceDir, "contentItem"), { recursive: true });

  await cp(join(pluginDir, "agents"), join(workspaceDir, ".claude", "agents"), {
    recursive: true,
  });

  await cp(join(pluginDir, "skills"), join(workspaceDir, ".claude", "skills"), {
    recursive: true,
  });

  await cp(join(pluginDir, "README.md"), join(workspaceDir, "CLAUDE.md"));

  await writeFile(
    join(workspaceDir, "user-profile.json"),
    JSON.stringify(createDefaultProfile(), null, 2),
    "utf-8"
  );
}

/**
 * Ensure the Looplia workspace exists and is properly initialized
 *
 * Creates ~/.looplia/ with .claude/ structure and copies from looplia-writer plugin.
 * On first run or when force=true, performs destructive refresh from plugin.
 *
 * @param options - Configuration options
 * @returns The absolute path to the workspace directory
 *
 * @throws Error if plugin directory not found or required files missing without force
 *
 * @example
 * ```typescript
 * // Normal init (bootstraps if needed)
 * const workspace = await ensureWorkspace();
 *
 * // Force destructive refresh
 * const workspace = await ensureWorkspace({ force: true });
 *
 * // Check for required files
 * const workspace = await ensureWorkspace({ requireFiles: true });
 * ```
 */
export async function ensureWorkspace(
  options?: WorkspaceOptions
): Promise<string> {
  const baseDir = options?.baseDir ?? "~/.looplia";
  const force = options?.force ?? false;
  const requireFiles = options?.requireFiles ?? false;
  const skipPluginBootstrap = options?.skipPluginBootstrap ?? false;

  const workspaceDir = expandPath(baseDir);

  // For testing: create empty structure without plugin bootstrap
  if (skipPluginBootstrap) {
    await createTestWorkspace(workspaceDir, force);
    return workspaceDir;
  }

  const pluginDir = getPluginPath();

  // Check if plugin directory exists
  if (!(await pathExists(pluginDir))) {
    throw new Error(
      `Plugin directory not found: ${pluginDir}. Ensure you're running from project root.`
    );
  }

  const workspaceExists = await pathExists(workspaceDir);
  const requiredFilesPresent = workspaceExists
    ? await checkRequiredFiles(workspaceDir)
    : false;

  // Determine if bootstrap is needed
  const needsBootstrap =
    force || !workspaceExists || (requireFiles && !requiredFilesPresent);

  if (needsBootstrap) {
    await bootstrapFromPlugin(workspaceDir, pluginDir);
  }

  return workspaceDir;
}

/**
 * Get the resolved workspace path without initializing
 */
export function getWorkspacePath(baseDir?: string): string {
  return expandPath(baseDir ?? "~/.looplia");
}

/**
 * Read user profile from workspace
 */
export async function readUserProfile(workspaceDir: string): Promise<unknown> {
  const profilePath = join(workspaceDir, "user-profile.json");
  const content = await readFile(profilePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Write user profile to workspace
 */
export async function writeUserProfile(
  workspaceDir: string,
  profile: unknown
): Promise<void> {
  const profilePath = join(workspaceDir, "user-profile.json");
  await writeFile(profilePath, JSON.stringify(profile, null, 2), "utf-8");
}
