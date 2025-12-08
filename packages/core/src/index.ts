// Domain Types

// Mock Adapters
export {
  createMockIdeaGenerator,
  createMockOutlineGenerator,
  createMockSummarizer,
  createMockWritingKitProvider,
} from "./adapters/mock";
export type {
  ContentItem,
  ContentMetadata,
  Source,
  SourceType,
} from "./domain/content";
export type { ProviderError, ProviderResult } from "./domain/errors";
export { err, ok } from "./domain/errors";
export type {
  WritingAngle,
  WritingHook,
  WritingIdeas,
  WritingQuestion,
} from "./domain/ideas";
export type { ContentSummary, SummaryScore } from "./domain/summary";
export type {
  UserProfile,
  UserTopic,
  WritingStyle,
} from "./domain/user-profile";
export type {
  OutlineSection,
  WritingKit,
  WritingKitMeta,
  WritingKitSource,
} from "./domain/writing-kit";
export type { IdeaProvider } from "./ports/idea-generator";
export type { OutlineProvider } from "./ports/outline-generator";
export type { ScoringPolicy } from "./ports/scoring";
export { defaultScoringPolicy } from "./ports/scoring";
// Provider Interfaces
export type { SummarizerProvider } from "./ports/summarizer";
export { generateIdeas } from "./services/idea-engine";
export { rankKits } from "./services/ranking-engine";
// Services
export { summarizeContent } from "./services/summarization-engine";
export {
  buildWritingKit,
  type WritingKitProviders,
} from "./services/writing-kit-engine";

// Validation
export {
  ContentItemSchema,
  ContentSummarySchema,
  UserProfileSchema,
  validateContentItem,
  validateContentSummary,
  validateUserProfile,
  validateWritingIdeas,
  WritingIdeasSchema,
} from "./validation/schemas";
