import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  ContentItem,
  ContentSummary,
  UserProfile,
  WritingIdeas,
} from "@looplia-core/core";

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
 * Test content summary fixture
 */
export const testSummary: ContentSummary = {
  contentId: "test-content-1",
  headline: "AI is Transforming How We Write Code",
  tldr:
    "AI tools like GitHub Copilot and Claude are revolutionizing software development " +
    "by automating code generation, testing, and review processes. Developers can now " +
    "focus more on architecture and design while AI handles routine tasks.",
  bullets: [
    "AI-powered code completion is now mainstream",
    "Automated testing and bug detection are improving",
    "Natural language programming is emerging",
    "Developers can focus on higher-level design",
  ],
  tags: ["AI", "software development", "code generation", "automation", "future of work"],
  sentiment: "positive",
  category: "article",
  score: {
    relevanceToUser: 0.85,
  },
};

/**
 * Test writing ideas fixture
 */
export const testIdeas: WritingIdeas = {
  contentId: "test-content-1",
  hooks: [
    {
      text: "What if your next coding partner wasn't human at all?",
      type: "curiosity",
    },
    {
      text: "I wrote 1000 lines of code last week. AI wrote half of them.",
      type: "story",
    },
  ],
  angles: [
    {
      title: "The Human-AI Collaboration",
      description: "Exploring how developers and AI tools work together to create better software",
      relevanceScore: 0.9,
    },
    {
      title: "The Skills That Matter Now",
      description: "What developers need to learn in an AI-augmented world",
      relevanceScore: 0.75,
    },
  ],
  questions: [
    {
      question: "How will AI change the job market for software developers?",
      type: "analytical",
    },
    {
      question: "What coding tasks should you still do manually?",
      type: "practical",
    },
  ],
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
      } catch {
        // Ignore cleanup errors
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
  subtype: "error_max_turns" | "error_max_budget_usd" | "error_during_execution",
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
