/**
 * Summary scoring metrics
 */
export interface SummaryScore {
  /** How relevant to user's interests (0-1) */
  relevanceToUser: number;
}

/**
 * Summarized content with key insights
 */
export interface ContentSummary {
  /** Reference to source content */
  contentId: string;

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
}
