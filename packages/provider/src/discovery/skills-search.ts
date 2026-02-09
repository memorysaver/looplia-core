/**
 * Skills Search Service (v0.8.0)
 *
 * Searches skills.sh registry using Vercel's npx skills CLI
 * and fetches skill content from GitHub.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Regex patterns for parsing skills CLI output (top-level for performance)
// Format 1: "skill-name - Description (owner/repo)"
const FORMAT1_PATTERN = /^(\S+)\s+-\s+(.+)\s+\(([^)]+)\)$/;
// Format 2: "owner/repo - description"
const FORMAT2_PATTERN = /^([^/]+)\/([^\s]+)\s+-\s+(.+)$/;
// Format 3: Just "owner/repo"
const FORMAT3_PATTERN = /^([^/\s]+)\/([^\s]+)$/;
// Format 4: "owner/repo@skill" (skills.sh format)
const FORMAT4_PATTERN = /^([^/\s]+)\/([^@\s]+)@([^\s]+)$/;
// Skill name cleanup patterns
const SKILL_SUFFIX_PATTERN = /-skill$/;
const SKILL_PREFIX_PATTERN = /^skill-/;
// ANSI escape code pattern for stripping colors
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional for ANSI escape sequence
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
// Valid GitHub owner/repo/skill name segment (alphanumeric, dots, hyphens, underscores)
const GITHUB_SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Search result from skills.sh registry
 */
export type SkillSearchResult = {
  name: string;
  description: string;
  owner: string;
  repo: string;
  installCommand: string;
};

/**
 * Search skills.sh using Vercel's npx skills find command
 *
 * @param query - Search query (e.g., "pdf", "excel", "web scraping")
 * @returns Array of matching skills, or empty array if search fails
 */
export async function searchSkills(
  query: string
): Promise<SkillSearchResult[]> {
  try {
    // Run Vercel's skills CLI with 30-second timeout (execFile prevents injection)
    const { stdout } = await execFileAsync("npx", ["skills", "find", query], {
      timeout: 30_000,
    });

    return parseSkillsOutput(stdout);
  } catch (error) {
    // Graceful fallback when CLI fails
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Skills search failed: ${message}`);
    console.warn("Continuing with local skills only");
    return [];
  }
}

/**
 * Derive skill name from repo by removing -skill suffix and skill- prefix
 */
export function deriveSkillName(repo: string): string {
  return repo
    .replace(SKILL_SUFFIX_PATTERN, "")
    .replace(SKILL_PREFIX_PATTERN, "");
}

/**
 * Try parsing format 1: "skill-name - Description (owner/repo)"
 */
function tryParseFormat1(line: string): SkillSearchResult | null {
  const match = line.match(FORMAT1_PATTERN);
  if (!match) {
    return null;
  }

  const [, name, description, fullRepo] = match;
  if (!(name && description && fullRepo)) {
    return null;
  }

  const parts = fullRepo.split("/");
  const owner = parts[0];
  const repo = parts[1];
  if (!(owner && repo)) {
    return null;
  }

  return {
    name,
    description,
    owner,
    repo,
    installCommand: `npx skills add ${fullRepo}`,
  };
}

/**
 * Try parsing format 2: "owner/repo - description"
 */
function tryParseFormat2(line: string): SkillSearchResult | null {
  const match = line.match(FORMAT2_PATTERN);
  if (!match) {
    return null;
  }

  const [, owner, repo, description] = match;
  if (!(owner && repo && description)) {
    return null;
  }

  return {
    name: deriveSkillName(repo),
    description,
    owner,
    repo,
    installCommand: `npx skills add ${owner}/${repo}`,
  };
}

/**
 * Try parsing format 3: Just "owner/repo"
 */
function tryParseFormat3(line: string): SkillSearchResult | null {
  const match = line.match(FORMAT3_PATTERN);
  if (!match) {
    return null;
  }

  const [, owner, repo] = match;
  if (!(owner && repo)) {
    return null;
  }

  return {
    name: deriveSkillName(repo),
    description: "",
    owner,
    repo,
    installCommand: `npx skills add ${owner}/${repo}`,
  };
}

/**
 * Try parsing format 4: "owner/repo@skill" (skills.sh format)
 * Example: "anthropics/skills@pdf" → owner=anthropics, repo=skills, name=pdf
 */
function tryParseFormat4(line: string): SkillSearchResult | null {
  const match = line.match(FORMAT4_PATTERN);
  if (!match) {
    return null;
  }

  const [, owner, repo, skillName] = match;
  if (!(owner && repo && skillName)) {
    return null;
  }

  return {
    name: skillName,
    description: "",
    owner,
    repo,
    installCommand: `npx skills add ${owner}/${repo}@${skillName}`,
  };
}

/**
 * Validate a GitHub owner/repo/skill name segment
 */
export function isValidGitHubSegment(s: string): boolean {
  return s.length > 0 && GITHUB_SEGMENT_PATTERN.test(s);
}

/**
 * Strip ANSI escape codes from string
 */
function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, "");
}

/**
 * Parse the output of `npx skills find`
 *
 * Expected format varies, but we try to extract:
 * - skill name
 * - description
 * - owner/repo
 */
export function parseSkillsOutput(output: string): SkillSearchResult[] {
  const results: SkillSearchResult[] = [];
  const lines = output.split("\n").filter((line) => line.trim());

  for (const rawLine of lines) {
    // Strip ANSI escape codes from the line
    const line = stripAnsi(rawLine);

    // Try each format in order of specificity (format 4 first since it has @skill)
    const result =
      tryParseFormat4(line) ??
      tryParseFormat1(line) ??
      tryParseFormat2(line) ??
      tryParseFormat3(line);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Fetch skill content (SKILL.md) from GitHub raw content
 *
 * @param owner - GitHub owner/org
 * @param repo - Repository name
 * @param skillName - Skill directory name (may differ from repo name)
 * @returns Content of SKILL.md file
 */
export async function fetchSkillContent(
  owner: string,
  repo: string,
  skillName: string
): Promise<string> {
  // Validate inputs to prevent URL manipulation
  for (const [label, value] of [
    ["owner", owner],
    ["repo", repo],
    ["skillName", skillName],
  ] as const) {
    if (!isValidGitHubSegment(value)) {
      throw new Error(`Invalid ${label}: ${value}`);
    }
  }

  // Try multiple possible paths for the SKILL.md file
  const paths = [
    `skills/${skillName}/SKILL.md`,
    `${skillName}/SKILL.md`,
    "SKILL.md",
  ];

  for (const path of paths) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
    const response = await fetch(url);

    if (response.ok) {
      return response.text();
    }
  }

  throw new Error(
    `Failed to fetch skill content for ${owner}/${repo}/${skillName}`
  );
}

/**
 * Search and fetch a single skill by name
 *
 * Convenience function that searches and fetches in one call.
 *
 * @param skillName - Name of the skill to find
 * @returns Skill content if found, null otherwise
 */
export async function findAndFetchSkill(
  skillName: string
): Promise<{ content: string; result: SkillSearchResult } | null> {
  const results = await searchSkills(skillName);

  if (results.length === 0) {
    return null;
  }

  // Try to find exact match first
  const exactMatch = results.find(
    (r) => r.name.toLowerCase() === skillName.toLowerCase()
  );
  const bestMatch = exactMatch ?? results[0];

  if (!bestMatch) {
    return null;
  }

  try {
    const content = await fetchSkillContent(
      bestMatch.owner,
      bestMatch.repo,
      bestMatch.name
    );
    return { content, result: bestMatch };
  } catch {
    return null;
  }
}
