/**
 * Content source type
 */
export type SourceType = "rss" | "youtube" | "podcast" | "twitter" | "custom";

/**
 * Represents a content source (feed, channel, etc.)
 */
export type Source = {
  /** Unique identifier for the source */
  id: string;

  /** Type of source */
  type: SourceType;

  /** Human-readable label */
  label?: string;

  /** Source URL */
  url: string;

  /** Additional source-specific metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Well-known metadata fields for content
 */
export type ContentMetadata = {
  /** ISO 639-1 language code (e.g., 'en', 'zh') */
  language?: string;

  /** Duration in seconds (for audio/video) */
  durationSeconds?: number;

  /** Author name */
  author?: string;

  /** Word count of rawText */
  wordCount?: number;

  /** Additional provider-specific fields */
  [key: string]: unknown;
};

/**
 * Raw content item to be processed
 */
export type ContentItem = {
  /** Unique identifier */
  id: string;

  /** Source this content came from */
  source: Source;

  /** Content title */
  title: string;

  /** Original URL */
  url: string;

  /** Publication date (ISO 8601) */
  publishedAt?: string;

  /** Raw text content (transcript, article body, etc.) */
  rawText: string;

  /** Content metadata */
  metadata: ContentMetadata;
};
