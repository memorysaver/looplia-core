import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { ContentItem } from "@looplia-core/core";

/** Regex to extract YAML frontmatter from content */
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n/;

/** Regex to parse YAML key-value pairs */
const YAML_KEYVALUE_REGEX = /^(\w+):\s*"?([^"]*)"?$/;

/** Maximum frontmatter size to prevent ReDoS attacks */
const MAX_FRONTMATTER_SIZE = 10_000;

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
 * Extract YAML frontmatter from content
 */
function extractFrontmatter(content: string): Record<string, string> {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return {};
  }

  const yaml = match[1] ?? "";

  // Prevent ReDoS attacks by limiting frontmatter size
  if (yaml.length > MAX_FRONTMATTER_SIZE) {
    return {};
  }
  const frontmatter: Record<string, string> = {};

  // Parse simple YAML fields (key: "value" or key: value)
  const lines = yaml.split("\n");
  for (const line of lines) {
    const keyValueMatch = line.match(YAML_KEYVALUE_REGEX);
    if (keyValueMatch?.[1] && keyValueMatch[2]) {
      frontmatter[keyValueMatch[1]] = keyValueMatch[2];
    }
  }

  return frontmatter;
}

/**
 * Create a ContentItem from a file path and its contents
 * Extracts ID and title from YAML frontmatter if available,
 * otherwise generates them from file path and timestamp
 */
export function createContentItemFromFile(
  filePath: string,
  rawText: string
): ContentItem {
  const frontmatter = extractFrontmatter(rawText);

  return {
    id: frontmatter.id || `cli-${Date.now()}`,
    title: frontmatter.title || basename(filePath) || "Untitled",
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
