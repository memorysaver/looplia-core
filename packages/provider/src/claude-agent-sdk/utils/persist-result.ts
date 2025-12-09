import { existsSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
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

/**
 * Persist result data to workspace with optional folder relocation
 *
 * Handles relocating content from temp ID folder to session ID folder
 * when SDK provides a session ID. Updates contentId in the result data.
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
    await writeFile(outputPath, JSON.stringify(data, null, 2), "utf-8");
    return { finalContentId: contentId, targetDir: tempDir };
  }

  const newDir = join(workspace, "contentItem", sessionId);

  // Try to relocate if source exists and target doesn't
  if (existsSync(tempDir) && !existsSync(newDir)) {
    try {
      await rename(tempDir, newDir);
      data.contentId = sessionId;
      const outputPath = join(newDir, filename);
      await writeFile(outputPath, JSON.stringify(data, null, 2), "utf-8");
      return { finalContentId: sessionId, targetDir: newDir };
    } catch (error) {
      // Relocation failed - write to original location
      console.warn(
        `Failed to relocate content from ${contentId} to ${sessionId}:`,
        error
      );
      data.contentId = contentId;
      const outputPath = join(tempDir, filename);
      await writeFile(outputPath, JSON.stringify(data, null, 2), "utf-8");
      return { finalContentId: contentId, targetDir: tempDir };
    }
  }

  // Target exists or source missing - use appropriate location
  const targetDir = existsSync(newDir) ? newDir : tempDir;
  const finalContentId = existsSync(newDir) ? sessionId : contentId;
  data.contentId = finalContentId;
  const outputPath = join(targetDir, filename);
  await writeFile(outputPath, JSON.stringify(data, null, 2), "utf-8");
  return { finalContentId, targetDir };
}
