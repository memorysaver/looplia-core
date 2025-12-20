import { mkdtemp, rm } from "node:fs/promises";
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
