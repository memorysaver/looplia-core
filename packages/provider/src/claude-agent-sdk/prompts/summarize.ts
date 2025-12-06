import type { ContentItem, UserProfile } from "@looplia-core/core";

/** Maximum content length before truncation (characters) */
const MAX_CONTENT_LENGTH = 5000;

/**
 * System prompt for content summarization
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
 */
export function buildSummarizePrompt(
  content: ContentItem,
  user?: UserProfile
): string {
  const userContext = user
    ? `

User Context:
- Topics: ${user.topics.map((t) => t.topic).join(", ")}
- Tone: ${user.style.tone}
- Word Count Target: ${user.style.targetWordCount}`
    : "";

  const languageInfo = content.metadata?.language
    ? `Language: ${content.metadata.language}`
    : "";

  const truncatedText =
    content.rawText.length > MAX_CONTENT_LENGTH
      ? `${content.rawText.substring(0, MAX_CONTENT_LENGTH)}...[truncated]`
      : content.rawText;

  return `Analyze and summarize the following content:

Title: ${content.title}
URL: ${content.url}
Source: ${content.source.label ?? content.source.type}
${languageInfo}

Content:
${truncatedText}
${userContext}

Provide a comprehensive summary with:
1. A compelling headline (10-200 chars)
2. A concise TL;DR (3-5 sentences, 20-500 chars)
3. Key bullet points (1-10 items)
4. Relevant topic tags (1-20 tags)
5. Sentiment assessment (positive/neutral/negative)
6. Content category (e.g., article, video, podcast)
7. Relevance score to user interests (0-1)

The contentId should be: ${content.id}

Ensure output matches the ContentSummary JSON schema exactly.`;
}
