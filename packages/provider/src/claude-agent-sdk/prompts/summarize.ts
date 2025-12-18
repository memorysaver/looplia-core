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
 * @deprecated v0.5.2 uses minimal prompts with agentic approach.
 * Use the summarizer with workspace setup instead.
 *
 * The v0.5.2 architecture uses:
 * - Minimal prompt: "Summarize content: sandbox/{id}/inputs/content.md"
 * - Agent reads CLAUDE.md for full instructions
 * - Agent uses skills (media-reviewer, content-documenter) autonomously
 * - Results stored in sandbox/{id}/outputs/
 */
export function buildSummarizePrompt(
  content: ContentItem,
  _user?: UserProfile
): string {
  // Invoke content-analyzer subagent for deep content analysis
  // Content is in folder structure: sandbox/{id}/inputs/content.md
  // Results stored in: sandbox/{id}/outputs/summary.json
  return `Invoke \`content-analyzer\` subagent to analyze and document content.

Content location: sandbox/${content.id}/inputs/content.md
Sandbox ID: ${content.id}

The content-analyzer agent will:
1. Read the content file and metadata
2. Use media-reviewer skill for deep analysis
3. Use content-documenter skill for structured documentation
4. Write results to sandbox/${content.id}/outputs/summary.json`;
}
