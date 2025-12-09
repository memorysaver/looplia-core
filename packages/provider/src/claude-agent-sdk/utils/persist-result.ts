import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Pattern to detect temporary CLI-generated IDs */
export const TEMP_ID_PATTERN = /^cli-\d+$/;

type PersistOptions = {
  workspace: string;
  contentId: string;
  sessionId?: string;
  filename: string;
};

type PersistResult = {
  finalContentId: string;
  targetDir: string;
};

/** Node.js error with code property */
type NodeError = Error & { code?: string };

/**
 * Attempt atomic rename, handling race conditions gracefully
 * Returns true if rename succeeded, false if should fallback
 */
async function tryAtomicRename(
  source: string,
  target: string
): Promise<boolean> {
  try {
    await rename(source, target);
    return true;
  } catch (err) {
    const nodeErr = err as NodeError;
    // ENOENT: source doesn't exist (already moved or never created)
    // EEXIST/ENOTEMPTY: target already exists (concurrent process created it)
    if (
      nodeErr.code === "ENOENT" ||
      nodeErr.code === "EEXIST" ||
      nodeErr.code === "ENOTEMPTY"
    ) {
      return false;
    }
    // Re-throw unexpected errors with context
    const contextErr = new Error(
      `Rename failed (${nodeErr.code || "unknown"}): ${source} -> ${target}`
    );
    contextErr.cause = err;
    throw contextErr;
  }
}

/**
 * Write data to path, creating directory if needed
 */
async function writeWithMkdir(path: string, content: string): Promise<void> {
  try {
    await writeFile(path, content, "utf-8");
  } catch (err) {
    const nodeErr = err as NodeError;
    if (nodeErr.code === "ENOENT") {
      // Directory doesn't exist, create it and retry
      const dir = path.substring(0, path.lastIndexOf("/"));
      await mkdir(dir, { recursive: true });
      await writeFile(path, content, "utf-8");
      return;
    }
    throw err;
  }
}

/**
 * Persist result data to workspace with optional folder relocation
 *
 * Uses atomic operations to avoid TOCTOU race conditions:
 * - Attempts rename first, handles failures gracefully
 * - Falls back to appropriate location based on what exists
 */
export async function persistResultToWorkspace<T extends { contentId: string }>(
  data: T,
  options: PersistOptions
): Promise<PersistResult> {
  const { workspace, contentId, sessionId, filename } = options;
  const tempDir = join(workspace, "contentItem", contentId);

  // No session ID - write to original location
  if (!sessionId) {
    data.contentId = contentId;
    const outputPath = join(tempDir, filename);
    await writeWithMkdir(outputPath, JSON.stringify(data, null, 2));
    return { finalContentId: contentId, targetDir: tempDir };
  }

  const newDir = join(workspace, "contentItem", sessionId);

  // Try atomic rename (avoids TOCTOU race)
  const renamed = await tryAtomicRename(tempDir, newDir);

  if (renamed) {
    data.contentId = sessionId;
    const outputPath = join(newDir, filename);
    await writeWithMkdir(outputPath, JSON.stringify(data, null, 2));
    return { finalContentId: sessionId, targetDir: newDir };
  }

  // Rename failed - determine best target location
  // Check if newDir exists (target may have been created by concurrent process)
  try {
    const { stat } = await import("node:fs/promises");
    await stat(newDir);
    // newDir exists - use it
    data.contentId = sessionId;
    const outputPath = join(newDir, filename);
    await writeWithMkdir(outputPath, JSON.stringify(data, null, 2));
    return { finalContentId: sessionId, targetDir: newDir };
  } catch {
    // newDir doesn't exist - use tempDir
    data.contentId = contentId;
    const outputPath = join(tempDir, filename);
    await writeWithMkdir(outputPath, JSON.stringify(data, null, 2));
    return { finalContentId: contentId, targetDir: tempDir };
  }
}
