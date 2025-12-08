import type { ContentItem, UserProfile } from "@looplia-core/core";

/**
 * System prompt for content summarization
 *
 * @deprecated v0.3.1 uses agentic approach with CLAUDE.md + skills.
 * This system prompt is only used for backward compatibility.
 */
export const SUMMARIZE_SYSTEM_PROMPT = `You are an expert content analyst specializing in summarization and content intelligence.

Your expertise includes:
- Extracting key insights and themes from various content formats
- Creating compelling headlines and summaries
- Identifying relevant topics and tags
- Analyzing sentiment and tone
- Scoring content relevance to user interests

When analyzing content:
1. Read carefully and identify the core message
2. Extract key points and supporting details
3. Consider the audience and context
4. Evaluate emotional and factual elements
5. Assess topic relevance

Always output valid JSON matching the provided schema.
Ensure all fields are populated with accurate, concise information.`;

/**
 * Build user prompt for summarization
 *
 * @deprecated v0.3.1 uses minimal prompts with agentic approach.
 * Use the summarizer with workspace setup instead.
 *
 * The v0.3.1 architecture uses:
 * - Minimal prompt: "Summarize content: contentItem/{id}/content.md"
 * - Agent reads CLAUDE.md for full instructions
 * - Agent uses skills (media-reviewer, content-documenter) autonomously
 * - Results stored in contentItem/{id}/results/
 */
export function buildSummarizePrompt(
  content: ContentItem,
  _user?: UserProfile
): string {
  // Return minimal prompt for agentic approach
  // Content is now in folder structure: contentItem/{id}/content.md
  // Agent can store results in: contentItem/{id}/results/
  return `Summarize content: contentItem/${content.id}/content.md`;
}
