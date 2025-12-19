import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ContentItem } from "@looplia-core/core";

/**
 * Write ContentItem to workspace as markdown file with frontmatter
 *
 * Creates sandbox folder structure (v0.6.0):
 * ```
 * sandbox/{id}/
 * ├── inputs/
 * │   └── content.md      (original content with metadata)
 * ├── outputs/
 * │   ├── summary.json    (content-analyzer output)
 * │   ├── ideas.json      (idea-generator output)
 * │   ├── outline.json    (outline generation output)
 * │   └── writing-kit.json (final assembled WritingKit)
 * ├── logs/               (session logs)
 * └── validation.json     (validation state)
 * ```
 *
 * @param content - ContentItem to write
 * @param workspace - Workspace directory path
 * @returns The content ID (sandbox ID)
 *
 * @example
 * ```typescript
 * const workspace = await ensureWorkspace();
 * const sandboxId = await writeContentItem(content, workspace);
 * console.log(`Content written to sandbox: ${sandboxId}`);
 * ```
 */
export async function writeContentItem(
  content: ContentItem,
  workspace: string
): Promise<string> {
  const sandboxDir = join(workspace, "sandbox", content.id);

  // Create sandbox folder structure: sandbox/{id}/inputs/, outputs/, logs/
  await mkdir(join(sandboxDir, "inputs"), { recursive: true });
  await mkdir(join(sandboxDir, "outputs"), { recursive: true });
  await mkdir(join(sandboxDir, "logs"), { recursive: true });

  const filePath = join(sandboxDir, "inputs", "content.md");

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
