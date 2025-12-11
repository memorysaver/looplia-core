/**
 * Workspace Cache Utilities
 *
 * Caches initialized workspace paths to avoid repeated filesystem checks.
 */

import { ensureWorkspace } from "../../workspace";

/** Cached workspace paths to avoid repeated filesystem checks */
const workspaceCache = new Map<string, string>();

/**
 * Get or initialize workspace with caching
 *
 * @param baseDir - Base directory for workspace
 * @param useFilesystemExtensions - Whether to enable filesystem extensions
 * @returns Resolved workspace path
 */
export async function getOrInitWorkspace(
  baseDir: string,
  useFilesystemExtensions: boolean
): Promise<string> {
  const cacheKey = `${baseDir}:${useFilesystemExtensions}`;

  const cached = workspaceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const workspace = await ensureWorkspace({
    baseDir,
    skipPluginBootstrap: !useFilesystemExtensions,
  });
  workspaceCache.set(cacheKey, workspace);
  return workspace;
}

/**
 * Clear workspace cache (useful for testing)
 */
export function clearWorkspaceCache(): void {
  workspaceCache.clear();
}
