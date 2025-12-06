import type { ContentSummary } from "./summary";
import type { WritingIdeas } from "./ideas";

/**
 * Simplified source reference for display
 */
export interface WritingKitSource {
  id: string;
  label: string;
  url: string;
}

/**
 * An outline section
 */
export interface OutlineSection {
  /** Section heading */
  heading: string;

  /** Writing notes for this section */
  notes: string;

  /** Estimated word count for this section */
  estimatedWords?: number;
}

/**
 * Writing kit metadata
 */
export interface WritingKitMeta {
  /** Overall relevance to user (0-1) */
  relevanceToUser: number;

  /** Estimated reading time in minutes */
  estimatedReadingTimeMinutes: number;
}

/**
 * Complete writing scaffold combining summary, ideas, and outline
 */
export interface WritingKit {
  /** Reference to source content */
  contentId: string;

  /** Simplified source reference */
  source: WritingKitSource;

  /** Content summary */
  summary: ContentSummary;

  /** Writing ideas */
  ideas: WritingIdeas;

  /** Suggested article outline */
  suggestedOutline: OutlineSection[];

  /** Kit metadata */
  meta: WritingKitMeta;
}
