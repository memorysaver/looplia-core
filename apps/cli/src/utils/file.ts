import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { ContentItem } from "@looplia-core/core";

/**
 * Read content from a file path with proper error handling
 */
export function readContentFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: Could not read file: ${filePath}`);
    console.error(`Reason: ${message}`);
    process.exit(1);
  }
}

/**
 * Create a ContentItem from a file path and its contents
 * Uses platform-agnostic path handling with path.basename()
 */
export function createContentItemFromFile(
  filePath: string,
  rawText: string
): ContentItem {
  return {
    id: `cli-${Date.now()}`,
    title: basename(filePath) || "Untitled",
    url: `file://${filePath}`,
    rawText,
    source: {
      id: "cli",
      type: "custom",
      url: `file://${filePath}`,
      label: "CLI Input",
    },
    metadata: {},
  };
}
