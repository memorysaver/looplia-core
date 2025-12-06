// Domain Types
export type {
  Source,
  SourceType,
  ContentItem,
  ContentMetadata,
} from "./domain/content";
export type { ContentSummary, SummaryScore } from "./domain/summary";
export type {
  WritingIdeas,
  WritingHook,
  WritingAngle,
  WritingQuestion,
} from "./domain/ideas";
export type {
  WritingKit,
  WritingKitSource,
  OutlineSection,
  WritingKitMeta,
} from "./domain/writing-kit";
export type { UserProfile, UserTopic, WritingStyle } from "./domain/user-profile";
export type { ProviderResult, ProviderError } from "./domain/errors";
export { ok, err } from "./domain/errors";

// Provider Interfaces
export type { SummarizerProvider } from "./ports/summarizer";
export type { IdeaProvider } from "./ports/idea-generator";
export type { OutlineProvider } from "./ports/outline-generator";
export type { ScoringPolicy } from "./ports/scoring";
export { defaultScoringPolicy } from "./ports/scoring";

// Services
export { summarizeContent } from "./services/summarization-engine";
export { generateIdeas } from "./services/idea-engine";
export { buildWritingKit, type WritingKitProviders } from "./services/writing-kit-engine";
export { rankKits } from "./services/ranking-engine";

// Mock Adapters
export {
  createMockSummarizer,
  createMockIdeaGenerator,
  createMockOutlineGenerator,
} from "./adapters/mock";

// Validation
export {
  ContentItemSchema,
  ContentSummarySchema,
  WritingIdeasSchema,
  UserProfileSchema,
  validateContentItem,
  validateContentSummary,
  validateWritingIdeas,
  validateUserProfile,
} from "./validation/schemas";
