/**
 * A topic the user is interested in
 */
export type UserTopic = {
  /** Topic name */
  topic: string;

  /** Interest level: 1 (low) to 5 (high) */
  interestLevel: 1 | 2 | 3 | 4 | 5;
};

/**
 * User's writing style preferences
 */
export type WritingStyle = {
  /** Target audience technical level */
  tone: "beginner" | "intermediate" | "expert" | "mixed";

  /** Target article length in words */
  targetWordCount: number;

  /** Preferred narrative voice */
  voice: "first-person" | "third-person" | "instructional";
};

/**
 * User profile for personalization
 */
export type UserProfile = {
  /** User identifier */
  userId: string;

  /** Topics of interest */
  topics: UserTopic[];

  /** Writing style preferences */
  style: WritingStyle;

  /** Example articles for voice matching (optional) */
  writingSamples?: string[];
};
