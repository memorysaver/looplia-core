/**
 * An attention-grabbing opening hook
 */
export interface WritingHook {
  /** The hook text */
  text: string;

  /** Why this hook works */
  type: "emotional" | "curiosity" | "controversy" | "statistic" | "story";
}

/**
 * A narrative angle or perspective
 */
export interface WritingAngle {
  /** Short title for the angle */
  title: string;

  /** Description of this perspective */
  description: string;

  /** How relevant to user's interests (0-1) */
  relevanceScore: number;
}

/**
 * A question to explore in writing
 */
export interface WritingQuestion {
  /** The question */
  question: string;

  /** Question category */
  type: "analytical" | "practical" | "philosophical" | "comparative";
}

/**
 * Creative expansion of summarized content into writing materials
 */
export interface WritingIdeas {
  /** Reference to source content */
  contentId: string;

  /**
   * Opening hooks to capture reader attention
   * Usage: Pick 1-2 hooks to open your article
   */
  hooks: WritingHook[];

  /**
   * Narrative angles for structuring the article
   * Usage: Pick one angle as your main perspective
   */
  angles: WritingAngle[];

  /**
   * Exploratory questions to address in the article
   * Usage: Answer 2-3 questions in your writing
   */
  questions: WritingQuestion[];
}
