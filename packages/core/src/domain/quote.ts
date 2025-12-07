/**
 * A verbatim quote with optional metadata
 */
export type Quote = {
  /** The exact quote text */
  text: string;

  /** Timestamp in HH:MM:SS or MM:SS format (for video/audio); reject other formats */
  timestamp?: string;

  /** Contextual information about the quote */
  context?: string;
};
