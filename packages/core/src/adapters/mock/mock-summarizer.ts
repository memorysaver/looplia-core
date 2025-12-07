import type { ContentItem } from "../../domain/content";
import type { ProviderResult } from "../../domain/errors";
import type { ContentSummary } from "../../domain/summary";
import type { UserProfile } from "../../domain/user-profile";
import type { SummarizerProvider } from "../../ports/summarizer";

/**
 * Create a mock summarizer for testing
 *
 * This provider generates summaries without calling any LLM.
 * Useful for testing, demos, and development.
 */
const SENTENCE_SPLIT_REGEX = /[.!?]+/;
const WORD_SPLIT_REGEX = /\s+/;
const NON_ALPHA_NUMERIC_REGEX = /[^a-z0-9]/g;
const MIN_WORD_LENGTH = 4;
const MIN_WORD_FREQUENCY = 2;
const MAX_TAGS = 5;

// Common English stopwords to filter out from tag extraction
const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "being",
  "could",
  "every",
  "first",
  "found",
  "great",
  "having",
  "however",
  "might",
  "never",
  "other",
  "really",
  "since",
  "still",
  "their",
  "there",
  "these",
  "think",
  "those",
  "through",
  "under",
  "until",
  "using",
  "where",
  "which",
  "while",
  "would",
]);

function extractSentences(text: string): string[] {
  return text.split(SENTENCE_SPLIT_REGEX).filter((s) => s.trim());
}

function extractTags(text: string): string[] {
  const words = text.toLowerCase().split(WORD_SPLIT_REGEX);
  const wordCounts = new Map<string, number>();

  for (const word of words) {
    const cleanWord = word.replace(NON_ALPHA_NUMERIC_REGEX, "");
    if (cleanWord.length > MIN_WORD_LENGTH && !STOPWORDS.has(cleanWord)) {
      wordCounts.set(cleanWord, (wordCounts.get(cleanWord) ?? 0) + 1);
    }
  }

  return [...wordCounts.entries()]
    .filter(([, count]) => count > MIN_WORD_FREQUENCY)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TAGS)
    .map(([word]) => word);
}

function calculateRelevance(tags: string[], user?: UserProfile): number {
  if (!user?.topics) {
    return 0.5;
  }
  const topicSet = new Set(user.topics.map((t) => t.topic.toLowerCase()));
  const matchCount = tags.filter((t) => topicSet.has(t)).length;
  return Math.min(1, 0.5 + matchCount * 0.1);
}

type EnhancedFieldsInput = {
  sentences: string[];
  bullets: string[];
  tags: string[];
  content: ContentItem;
  tldr: string;
};

function buildEnhancedFields(
  input: EnhancedFieldsInput
): Pick<
  ContentSummary,
  | "overview"
  | "keyThemes"
  | "detailedAnalysis"
  | "narrativeFlow"
  | "coreIdeas"
  | "importantQuotes"
  | "context"
  | "relatedConcepts"
> {
  const { sentences, bullets, tags, content, tldr } = input;
  return {
    overview: `This content discusses ${tags.slice(0, 3).join(", ") || "various topics"}. ${tldr}`,
    keyThemes:
      tags.length > 0
        ? tags.slice(0, 5)
        : ["general topic", "main idea", "key concept"],
    detailedAnalysis: `The content begins by introducing the main topic. ${sentences.slice(0, 2).join(". ")}. The author then elaborates on the key points.`,
    narrativeFlow:
      "The content follows a logical progression from introduction to key points to conclusion.",
    coreIdeas: [
      {
        concept: tags[0] || "Main Concept",
        explanation: `The primary focus of this content is ${tags[0] || "the main topic"}.`,
        examples: bullets.slice(0, 2),
      },
    ],
    importantQuotes: sentences.slice(0, 2).map((s, i) => ({
      text: s.trim(),
      context: `Quote from section ${i + 1}`,
    })),
    context: `This content is a ${content.source.type} that covers ${tags.join(", ") || "general topics"}.`,
    relatedConcepts: tags.slice(0, 5),
  };
}

export function createMockSummarizer(): SummarizerProvider {
  return {
    summarize(
      content: ContentItem,
      user?: UserProfile
    ): Promise<ProviderResult<ContentSummary>> {
      const text = content.rawText.trim();
      const sentences = extractSentences(text);
      const headline = sentences[0]?.trim().slice(0, 200) ?? content.title;
      const tldr = sentences.slice(0, 3).join(". ").slice(0, 500) || headline;
      const bullets = sentences.slice(0, 5).map((s) => s.trim());
      const tags = extractTags(text);
      const relevance = calculateRelevance(tags, user);

      const summary: ContentSummary = {
        contentId: content.id,
        headline,
        tldr,
        bullets: bullets.length > 0 ? bullets : [headline],
        tags: tags.length > 0 ? tags : ["general"],
        sentiment: "neutral",
        category: "article",
        score: { relevanceToUser: relevance },
        ...buildEnhancedFields({ sentences, bullets, tags, content, tldr }),
      };

      return Promise.resolve({ success: true, data: summary });
    },
  };
}
