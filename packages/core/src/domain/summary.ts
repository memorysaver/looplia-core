import type { CoreIdea } from "./core-idea";
import type { Quote } from "./quote";

/**
 * Summary scoring metrics
 */
export type SummaryScore = {
  /** How relevant to user's interests (0-1) */
  relevanceToUser: number;
};

/**
 * Summarized content with key insights
 * Enhanced in v0.3 with documentary-style analysis
 */
export type ContentSummary = {
  /** Reference to source content */
  contentId: string;

  // ─── Core Fields (from v0.1) ───
  /** One-sentence distilled insight (10-200 chars) */
  headline: string;

  /** 3-5 sentence summary (20-500 chars) */
  tldr: string;

  /** Key points as bullet list (1-10 items) */
  bullets: string[];

  /** Topic tags (1-20 tags) */
  tags: string[];

  /** Overall sentiment */
  sentiment: "positive" | "neutral" | "negative";

  /** Content category */
  category: string;

  /** Relevance scores */
  score: SummaryScore;

  // ─── Enhanced Fields (v0.3 - from legacy skills) ───

  /** Rich 2-3 paragraph overview */
  overview: string;

  /** 3-7 main themes identified in content */
  keyThemes: string[];

  /** Documentary-style detailed breakdown of content */
  detailedAnalysis: string;

  /** Description of how content progresses and builds */
  narrativeFlow: string;

  /** Core concepts with explanations and examples */
  coreIdeas: CoreIdea[];

  /** Important verbatim quotes with timestamps */
  importantQuotes: Quote[];

  /** Background context needed to understand content */
  context: string;

  /** Related topics and concepts mentioned */
  relatedConcepts: string[];

  // ─── Detection Fields (source detection) ───

  /** Auto-detected source type for intelligent ID generation */
  detectedSource?:
    | "podcast"
    | "transcript"
    | "article"
    | "youtube"
    | "twitter"
    | "text"
    | "other";
};
