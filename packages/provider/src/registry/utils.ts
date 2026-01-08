/**
 * Registry Utilities (v0.7.1)
 *
 * Shared functions for YAML parsing and skill metadata inference.
 * Used by both compiler.ts (runtime) and build-registry.ts (build-time).
 *
 * @see docs/DESIGN-0.7.1.md section 7.4
 */

import type { SkillCategory } from "@looplia-core/core";

/** Capability inference patterns */
export const CAPABILITY_PATTERNS = [
  { pattern: /media|video|audio|image/, capability: "media-processing" },
  { pattern: /content|text|document/, capability: "content-analysis" },
  { pattern: /json|schema|structured/, capability: "structured-output" },
  { pattern: /workflow|orchestrat/, capability: "workflow-management" },
  { pattern: /search|find|discover/, capability: "search" },
  { pattern: /generat|creat|produc/, capability: "generation" },
  { pattern: /valid|check|verify/, capability: "validation" },
] as const;

/** Regex patterns used across registry operations */
export const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
export const PROTOCOL_REGEX = /^https?:\/\//;
export const TRAILING_SLASH_REGEX = /\/$/;
export const LEADING_DOT_SLASH_REGEX = /^\.\//;
export const SLASH_TO_DASH_REGEX = /\//g;

/**
 * Extract multiline value from indented lines
 */
export function parseMultilineValue(
  lines: string[],
  startIndex: number
): string {
  const multilineLines: string[] = [];
  for (let j = startIndex; j < lines.length; j++) {
    const nextLine = lines[j];
    if (nextLine === undefined) {
      break;
    }
    if (nextLine.startsWith("  ")) {
      multilineLines.push(nextLine.trim());
    } else if (nextLine.trim() !== "") {
      break;
    }
  }
  return multilineLines.join(" ");
}

/**
 * Parse YAML frontmatter into key-value map
 * Handles multiline values with YAML literal block scalar (|)
 */
export function parseYamlFrontmatter(
  frontmatter: string
): Record<string, string> {
  const lines = frontmatter.split("\n");
  const metadata: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) {
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Handle multi-line values with YAML literal block scalar (|)
    if (value === "|") {
      value = parseMultilineValue(lines, i + 1);
    }

    metadata[key] = value;
  }

  return metadata;
}

/**
 * Infer skill category from name and description
 */
export function inferCategory(
  name: string,
  description: string
): SkillCategory {
  const text = `${name} ${description}`.toLowerCase();

  if (
    text.includes("review") ||
    text.includes("analyze") ||
    text.includes("scan")
  ) {
    return "analysis";
  }
  if (
    text.includes("generate") ||
    text.includes("synthesis") ||
    text.includes("create")
  ) {
    return "generation";
  }
  if (
    text.includes("assemble") ||
    text.includes("document") ||
    text.includes("compile")
  ) {
    return "assembly";
  }
  if (text.includes("validate") || text.includes("check")) {
    return "validation";
  }
  if (text.includes("search") || text.includes("find")) {
    return "search";
  }
  if (
    text.includes("workflow") ||
    text.includes("execute") ||
    text.includes("orchestrat")
  ) {
    return "orchestration";
  }

  return "utility";
}

/**
 * Infer capabilities from description
 */
export function inferCapabilities(description: string): string[] {
  const capabilities: string[] = [];
  const text = description.toLowerCase();

  for (const { pattern, capability } of CAPABILITY_PATTERNS) {
    if (pattern.test(text)) {
      capabilities.push(capability);
    }
  }

  return capabilities;
}

/**
 * Format skill name as title (e.g., "my-skill" → "My Skill")
 */
export function formatTitle(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
