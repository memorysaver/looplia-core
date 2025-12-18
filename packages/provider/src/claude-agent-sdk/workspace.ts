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
 * Plugin paths for two-plugin architecture
 */
export type PluginPaths = {
  core: string;
  writer: string;
};

/**
 * Get the plugin directory path (legacy - returns writer plugin only)
 * @deprecated Use getPluginPaths() instead
 */
export function getPluginPath(): string {
  // Assuming CLI runs from project root
  return join(process.cwd(), "plugins", "looplia-writer");
}

/**
 * Get paths to both plugins for two-plugin architecture
 */
export function getPluginPaths(): PluginPaths {
  const base = join(process.cwd(), "plugins");
  return {
    core: join(base, "looplia-core"),
    writer: join(base, "looplia-writer"),
  };
}

/**
 * Check if all required workspace files exist
 */
async function checkRequiredFiles(workspaceDir: string): Promise<boolean> {
  const requiredPaths = [
    // Core structure
    join(workspaceDir, "CLAUDE.md"),
    join(workspaceDir, ".claude", "agents"),
    join(workspaceDir, ".claude", "skills"),
    join(workspaceDir, "workflows"),
    // From looplia-core plugin
    join(workspaceDir, ".claude", "commands"),
    join(workspaceDir, ".claude", "skills", "workflow-executor"),
    join(workspaceDir, ".claude", "skills", "workflow-validator"),
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
 * Create workspace structure for testing (copies workflows and core skills)
 *
 * This ensures workflow validation works in mock mode while skipping
 * the heavy agent/skill bootstrap that requires API access.
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

  const plugins = getPluginPaths();

  // Copy workflows from writer plugin (needed for workflow validation in mock mode)
  const writerWorkflowsDir = join(plugins.writer, "workflows");
  if (await pathExists(writerWorkflowsDir)) {
    await cp(writerWorkflowsDir, join(workspaceDir, "workflows"), {
      recursive: true,
    });
  } else {
    // Fallback: create empty workflows directory
    await mkdir(join(workspaceDir, "workflows"), { recursive: true });
  }

  // Copy workflow-validator skill from core plugin (needed for validation tests)
  const coreValidatorDir = join(plugins.core, "skills", "workflow-validator");
  if (await pathExists(coreValidatorDir)) {
    await cp(
      coreValidatorDir,
      join(workspaceDir, ".claude", "skills", "workflow-validator"),
      { recursive: true }
    );
  }

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
 * Bootstrap workspace from both looplia-core and looplia-writer plugins
 *
 * Copies files in order:
 * 1. From looplia-core: commands/, skills/, hooks/, CLAUDE.md
 * 2. From looplia-writer: agents/, skills/ (merged), workflows/
 */
async function bootstrapFromPlugins(
  workspaceDir: string,
  plugins: PluginPaths
): Promise<void> {
  const workspaceExists = await pathExists(workspaceDir);
  if (workspaceExists) {
    await rm(workspaceDir, { recursive: true, force: true });
  }

  // Create directory structure
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(join(workspaceDir, ".claude"), { recursive: true });
  await mkdir(join(workspaceDir, "contentItem"), { recursive: true });

  // --- From looplia-core plugin ---

  // commands/ → ~/.looplia/.claude/commands/
  const coreCommandsDir = join(plugins.core, "commands");
  if (await pathExists(coreCommandsDir)) {
    await cp(coreCommandsDir, join(workspaceDir, ".claude", "commands"), {
      recursive: true,
    });
  }

  // skills/ → ~/.looplia/.claude/skills/ (first, will be merged)
  const coreSkillsDir = join(plugins.core, "skills");
  if (await pathExists(coreSkillsDir)) {
    await cp(coreSkillsDir, join(workspaceDir, ".claude", "skills"), {
      recursive: true,
    });
  }

  // hooks/ → ~/.looplia/.claude/hooks/
  const coreHooksDir = join(plugins.core, "hooks");
  if (await pathExists(coreHooksDir)) {
    await cp(coreHooksDir, join(workspaceDir, ".claude", "hooks"), {
      recursive: true,
    });
  }

  // CLAUDE.md → ~/.looplia/CLAUDE.md
  const coreClaudeMd = join(plugins.core, "CLAUDE.md");
  if (await pathExists(coreClaudeMd)) {
    await cp(coreClaudeMd, join(workspaceDir, "CLAUDE.md"));
  }

  // --- From looplia-writer plugin ---

  // agents/ → ~/.looplia/.claude/agents/
  const writerAgentsDir = join(plugins.writer, "agents");
  if (await pathExists(writerAgentsDir)) {
    await cp(writerAgentsDir, join(workspaceDir, ".claude", "agents"), {
      recursive: true,
    });
  }

  // skills/ → ~/.looplia/.claude/skills/ (merge with core skills)
  const writerSkillsDir = join(plugins.writer, "skills");
  if (await pathExists(writerSkillsDir)) {
    await cp(writerSkillsDir, join(workspaceDir, ".claude", "skills"), {
      recursive: true,
    });
  }

  // workflows/ → ~/.looplia/workflows/
  const writerWorkflowsDir = join(plugins.writer, "workflows");
  if (await pathExists(writerWorkflowsDir)) {
    await cp(writerWorkflowsDir, join(workspaceDir, "workflows"), {
      recursive: true,
    });
  }

  // Create default user profile
  await writeFile(
    join(workspaceDir, "user-profile.json"),
    JSON.stringify(createDefaultProfile(), null, 2),
    "utf-8"
  );
}

/**
 * Ensure the Looplia workspace exists and is properly initialized
 *
 * Creates ~/.looplia/ with .claude/ structure and copies from both plugins:
 * - looplia-core: commands/, skills/ (core), hooks/, CLAUDE.md
 * - looplia-writer: agents/, skills/ (domain), workflows/
 *
 * On first run or when force=true, performs destructive refresh from plugins.
 *
 * @param options - Configuration options
 * @returns The absolute path to the workspace directory
 *
 * @throws Error if plugin directories not found or required files missing without force
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

  const plugins = getPluginPaths();

  // Check if plugin directories exist
  if (!(await pathExists(plugins.core))) {
    throw new Error(
      `Plugin directory not found: ${plugins.core}. Ensure you're running from project root.`
    );
  }
  if (!(await pathExists(plugins.writer))) {
    throw new Error(
      `Plugin directory not found: ${plugins.writer}. Ensure you're running from project root.`
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
    await bootstrapFromPlugins(workspaceDir, plugins);
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
