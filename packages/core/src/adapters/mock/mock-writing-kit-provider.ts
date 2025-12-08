import type { ContentItem } from "../../domain/content";
import type { ProviderResult } from "../../domain/errors";
import type { WritingIdeas } from "../../domain/ideas";
import type { ContentSummary } from "../../domain/summary";
import type { UserProfile } from "../../domain/user-profile";
import type { OutlineSection, WritingKit } from "../../domain/writing-kit";

/**
 * WritingKit provider interface (matches provider package)
 */
export type WritingKitProvider = {
  buildKit(
    content: ContentItem,
    user: UserProfile
  ): Promise<ProviderResult<WritingKit>>;
};

// Top-level regex constants
const SENTENCE_SPLIT_REGEX = /[.!?]+/;
const WORD_SPLIT_REGEX = /\s+/;
const NON_ALPHA_REGEX = /[^a-z0-9]/g;

function extractSentences(text: string): string[] {
  return text.split(SENTENCE_SPLIT_REGEX).filter((s) => s.trim());
}

function extractTags(text: string): string[] {
  const words = text.toLowerCase().split(WORD_SPLIT_REGEX);
  const wordCounts = new Map<string, number>();

  for (const word of words) {
    const clean = word.replace(NON_ALPHA_REGEX, "");
    if (clean.length > 4) {
      wordCounts.set(clean, (wordCounts.get(clean) ?? 0) + 1);
    }
  }

  return [...wordCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function buildMockSummary(
  content: ContentItem,
  sentences: string[],
  tags: string[]
): ContentSummary {
  const headline = sentences[0]?.trim().slice(0, 200) ?? content.title;
  const tldr = sentences.slice(0, 3).join(". ").slice(0, 500) || headline;
  const bullets = sentences.slice(0, 5).map((s) => s.trim());

  return {
    contentId: content.id,
    headline,
    tldr,
    bullets: bullets.length > 0 ? bullets : [headline],
    tags: tags.length > 0 ? tags : ["general"],
    sentiment: "neutral",
    category: "article",
    score: { relevanceToUser: 0.7 },
    overview: `This content discusses ${tags.slice(0, 3).join(", ") || "various topics"}.`,
    keyThemes: tags.length > 0 ? tags : ["main topic"],
    detailedAnalysis: `The content explores ${headline}.`,
    narrativeFlow:
      "The content progresses logically from introduction to conclusion.",
    coreIdeas: [
      {
        concept: tags[0] || "Main Concept",
        explanation: `The primary focus is ${tags[0] || "the main topic"}.`,
        examples: bullets.slice(0, 2),
      },
    ],
    importantQuotes: sentences.slice(0, 2).map((s, i) => ({
      text: s.trim(),
      context: `Quote ${i + 1}`,
    })),
    context: `A ${content.source.type} covering ${tags.join(", ") || "general topics"}.`,
    relatedConcepts: tags.slice(0, 5),
  };
}

function buildMockIdeas(contentId: string, tags: string[]): WritingIdeas {
  return {
    contentId,
    hooks: [
      {
        text: `What if ${tags[0] || "this"} changed everything?`,
        type: "curiosity",
      },
      {
        text: `The surprising truth about ${tags[0] || "this topic"}`,
        type: "controversy",
      },
      {
        text: `A personal journey into ${tags[0] || "understanding"}`,
        type: "story",
      },
    ],
    angles: [
      {
        title: `The Complete Guide to ${tags[0] || "This Topic"}`,
        description: "A comprehensive exploration of the key concepts.",
        relevanceScore: 0.85,
      },
      {
        title: `Why ${tags[0] || "This"} Matters More Than Ever`,
        description: "An analysis of current relevance and impact.",
        relevanceScore: 0.75,
      },
    ],
    questions: [
      {
        question: `How does ${tags[0] || "this"} affect daily life?`,
        type: "practical",
      },
      {
        question: "What are the implications for the future?",
        type: "analytical",
      },
      {
        question: "Is this approach truly the best one?",
        type: "philosophical",
      },
    ],
  };
}

function buildMockOutline(
  tags: string[],
  targetWordCount: number
): OutlineSection[] {
  return [
    {
      heading: "Introduction",
      notes: `Hook the reader with the key insight about ${tags[0] || "the topic"}.`,
      estimatedWords: Math.round(targetWordCount * 0.15),
    },
    {
      heading: "Background & Context",
      notes: "Provide necessary context and define key terms.",
      estimatedWords: Math.round(targetWordCount * 0.2),
    },
    {
      heading: "Main Analysis",
      notes: "Deep dive into the core concepts and findings.",
      estimatedWords: Math.round(targetWordCount * 0.35),
    },
    {
      heading: "Implications & Applications",
      notes: "Discuss practical takeaways and real-world applications.",
      estimatedWords: Math.round(targetWordCount * 0.2),
    },
    {
      heading: "Conclusion",
      notes: "Summarize key points and provide forward-looking perspective.",
      estimatedWords: Math.round(targetWordCount * 0.1),
    },
  ];
}

/**
 * Create a mock writing kit provider for testing
 *
 * This provider generates a complete WritingKit without calling any LLM.
 * Useful for testing, demos, and development.
 */
export function createMockWritingKitProvider(): WritingKitProvider {
  return {
    buildKit(
      content: ContentItem,
      user: UserProfile
    ): Promise<ProviderResult<WritingKit>> {
      const text = content.rawText.trim();
      const sentences = extractSentences(text);
      const tags = extractTags(text);
      const targetWordCount = user.style?.targetWordCount ?? 1000;

      const writingKit: WritingKit = {
        contentId: content.id,
        source: {
          id: content.source.id,
          label: content.title,
          url: content.url ?? "",
        },
        summary: buildMockSummary(content, sentences, tags),
        ideas: buildMockIdeas(content.id, tags),
        suggestedOutline: buildMockOutline(tags, targetWordCount),
        meta: {
          relevanceToUser: 0.7,
          estimatedReadingTimeMinutes: Math.ceil(targetWordCount / 200),
        },
      };

      return Promise.resolve({ success: true, data: writingKit });
    },
  };
}
