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

export function createMockSummarizer(): SummarizerProvider {
  return {
    summarize(
      content: ContentItem,
      user?: UserProfile
    ): Promise<ProviderResult<ContentSummary>> {
      const text = content.rawText.trim();
      const sentences = text
        .split(SENTENCE_SPLIT_REGEX)
        .filter((s) => s.trim());

      // Extract first sentence as headline
      const headline = sentences[0]?.trim().slice(0, 200) ?? content.title;

      // Use first few sentences as TLDR
      const tldr = sentences.slice(0, 3).join(". ").slice(0, 500) || headline;

      // Extract some "bullets" from the text
      const bullets = sentences.slice(0, 5).map((s) => s.trim());

      // Tag extraction with stopword filtering and punctuation cleanup
      const words = text.toLowerCase().split(WORD_SPLIT_REGEX);
      const wordCounts = new Map<string, number>();
      for (const word of words) {
        const cleanWord = word.replace(NON_ALPHA_NUMERIC_REGEX, "");
        if (cleanWord.length > MIN_WORD_LENGTH && !STOPWORDS.has(cleanWord)) {
          wordCounts.set(cleanWord, (wordCounts.get(cleanWord) ?? 0) + 1);
        }
      }
      const tags = [...wordCounts.entries()]
        .filter(([, count]) => count > MIN_WORD_FREQUENCY)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_TAGS)
        .map(([word]) => word);

      // Calculate mock relevance
      let relevance = 0.5;
      if (user?.topics) {
        const topicSet = new Set(user.topics.map((t) => t.topic.toLowerCase()));
        const matchCount = tags.filter((t) => topicSet.has(t)).length;
        relevance = Math.min(1, 0.5 + matchCount * 0.1);
      }

      const summary: ContentSummary = {
        contentId: content.id,
        headline,
        tldr,
        bullets: bullets.length > 0 ? bullets : [headline],
        tags: tags.length > 0 ? tags : ["general"],
        sentiment: "neutral",
        category: "article",
        score: {
          relevanceToUser: relevance,
        },
      };

      return Promise.resolve({ success: true, data: summary });
    },
  };
}
