import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ContentItem } from "@looplia-core/core";

/**
 * Write ContentItem to workspace as markdown file with frontmatter
 *
 * Creates a markdown file in contentItem/ directory with YAML frontmatter
 * containing metadata and the raw content text.
 *
 * @param content - ContentItem to write
 * @param workspace - Workspace directory path
 * @returns The content ID
 *
 * @example
 * ```typescript
 * const workspace = await ensureWorkspace();
 * const contentId = await writeContentItem(content, workspace);
 * console.log(`Content written: ${contentId}`);
 * ```
 */
export async function writeContentItem(
  content: ContentItem,
  workspace: string
): Promise<string> {
  const contentDir = join(workspace, "contentItem");
  await mkdir(contentDir, { recursive: true });

  const filePath = join(contentDir, `${content.id}.md`);

  // Build metadata section
  const metadataLines: string[] = [];
  if (content.metadata.language) {
    metadataLines.push(`  language: "${content.metadata.language}"`);
  }
  if (content.metadata.author) {
    metadataLines.push(`  author: "${content.metadata.author}"`);
  }
  if (content.metadata.durationSeconds) {
    metadataLines.push(
      `  durationSeconds: ${content.metadata.durationSeconds}`
    );
  }
  if (content.metadata.wordCount) {
    metadataLines.push(`  wordCount: ${content.metadata.wordCount}`);
  }

  // Create markdown with frontmatter
  const markdown = `---
id: "${content.id}"
title: "${content.title}"
source_type: "${content.source.type}"
source_url: "${content.url}"
published_at: "${content.publishedAt || new Date().toISOString()}"
${metadataLines.length > 0 ? `metadata:\n${metadataLines.join("\n")}\n` : ""}---

# ${content.title}

${content.rawText}
`;

  await writeFile(filePath, markdown, "utf-8");
  return content.id;
}
