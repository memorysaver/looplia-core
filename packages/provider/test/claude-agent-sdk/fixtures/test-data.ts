import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ContentItem, UserProfile } from "@looplia-core/core";

/**
 * Test content item fixture
 */
export const testContent: ContentItem = {
  id: "test-content-1",
  title: "The Future of AI in Software Development",
  url: "https://example.com/ai-future",
  rawText: `
    Artificial intelligence is revolutionizing software development.
    From code completion to automated testing, AI tools are becoming
    essential for modern developers. Companies like GitHub with Copilot
    and Anthropic with Claude are leading this transformation.

    Key trends include:
    - AI-powered code generation
    - Automated bug detection
    - Intelligent code review
    - Natural language programming

    The future looks promising, with AI expected to handle more
    complex tasks while developers focus on architecture and design.
  `,
  source: {
    id: "tech-blog",
    type: "rss",
    url: "https://example.com/feed",
    label: "Tech Blog",
  },
  metadata: {
    language: "en",
  },
};

/**
 * Test user profile fixture
 */
export const testUser: UserProfile = {
  userId: "test-user-1",
  topics: [
    { topic: "artificial intelligence", interestLevel: 5 },
    { topic: "software development", interestLevel: 4 },
    { topic: "developer tools", interestLevel: 3 },
  ],
  style: {
    tone: "intermediate",
    targetWordCount: 1200,
    voice: "first-person",
  },
};

/**
 * Create a temporary workspace directory for testing
 *
 * @returns Object with path and cleanup function
 */
export async function createTempWorkspace(): Promise<{
  path: string;
  cleanup: () => Promise<void>;
}> {
  const path = await mkdtemp(join(tmpdir(), "looplia-test-"));

  return {
    path,
    cleanup: async () => {
      try {
        await rm(path, { recursive: true, force: true });
      } catch (error) {
        // Log cleanup errors for debugging but don't fail tests
        console.warn(`Failed to cleanup temp workspace ${path}:`, error);
      }
    },
  };
}

/**
 * Looplia workspace structure for integration testing
 */
export type LoopliaTestWorkspace = {
  path: string;
  cleanup: () => Promise<void>;
};

/**
 * Create an isolated looplia workspace that mirrors ~/.looplia structure
 *
 * Use with LOOPLIA_HOME env var:
 * ```
 * process.env.LOOPLIA_HOME = workspace.path;
 * ```
 */
export async function createLoopliaWorkspace(): Promise<LoopliaTestWorkspace> {
  const path = await mkdtemp(join(tmpdir(), "looplia-workspace-"));

  // Create workspace structure (plugins go directly in LOOPLIA_HOME)
  await mkdir(join(path, "sandbox"), { recursive: true });
  await mkdir(join(path, "workflows"), { recursive: true });
  await mkdir(join(path, "registry"), { recursive: true });

  return {
    path,
    cleanup: async () => {
      try {
        await rm(path, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup looplia workspace ${path}:`, error);
      }
    },
  };
}

/**
 * Create a mock plugin in the test workspace
 *
 * @param workspace - The looplia workspace
 * @param name - Plugin name (will be created as a directory)
 * @param skills - Array of skill names to create in the plugin
 */
export async function createMockPluginInWorkspace(
  workspace: LoopliaTestWorkspace,
  name: string,
  skills: string[]
): Promise<string> {
  const pluginPath = join(workspace.path, name);
  await mkdir(join(pluginPath, ".claude-plugin"), { recursive: true });

  // Create plugin.json
  await writeFile(
    join(pluginPath, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name, version: "1.0.0" })
  );

  // Create skills directories
  if (skills.length > 0) {
    await mkdir(join(pluginPath, "skills"), { recursive: true });
    for (const skill of skills) {
      const skillDir = join(pluginPath, "skills", skill);
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---\nname: ${skill}\ndescription: Mock skill for testing\n---\n# ${skill}\n\nMock skill content.`
      );
    }
  }

  return pluginPath;
}

/**
 * Mock SDK result for successful operations
 */
export function createMockSdkResult<T>(data: T) {
  return {
    type: "result",
    subtype: "success",
    structured_output: data,
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
    },
    total_cost_usd: 0.0015,
  };
}

/**
 * Mock SDK result for error operations
 */
export function createMockSdkError(
  subtype:
    | "error_max_turns"
    | "error_max_budget_usd"
    | "error_during_execution",
  errors?: string[]
) {
  return {
    type: "result",
    subtype,
    errors,
    usage: {
      input_tokens: 500,
      output_tokens: 0,
    },
    total_cost_usd: 0.0005,
  };
}
