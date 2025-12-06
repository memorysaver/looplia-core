import type { ContentSummary, UserProfile } from "@looplia-core/core";

/**
 * System prompt for idea generation
 */
export const IDEAS_SYSTEM_PROMPT = `You are a creative writing consultant specializing in content ideation and storytelling.

Your expertise includes:
- Crafting attention-grabbing hooks that resonate with readers
- Developing unique narrative angles and perspectives
- Formulating exploratory questions that drive engagement
- Understanding audience psychology and content trends

When generating ideas:
1. Analyze the content summary for key themes
2. Consider the user's interests and expertise level
3. Create diverse hook types (emotional, curiosity, controversy, statistic, story)
4. Develop angles that offer fresh perspectives
5. Formulate questions that encourage deeper exploration

Always output valid JSON matching the provided schema.
Ensure ideas are creative, relevant, and actionable.`;

/**
 * Build user prompt for idea generation
 */
export function buildIdeasPrompt(
  summary: ContentSummary,
  user: UserProfile
): string {
  return `Generate writing ideas based on this content summary:

Summary:
- Headline: ${summary.headline}
- TL;DR: ${summary.tldr}
- Key Points: ${summary.bullets.join("; ")}
- Tags: ${summary.tags.join(", ")}
- Sentiment: ${summary.sentiment}
- Category: ${summary.category}

User Profile:
- Topics of Interest: ${user.topics.map((t) => `${t.topic} (level ${t.interestLevel})`).join(", ")}
- Writing Tone: ${user.style.tone}
- Target Word Count: ${user.style.targetWordCount}
- Voice: ${user.style.voice}

Generate:
1. Hooks (1-5 items) - Attention-grabbing opening statements
   - Types: emotional, curiosity, controversy, statistic, story

2. Angles (1-5 items) - Unique narrative perspectives
   - Include: title, description, relevanceScore (0-1)

3. Questions (1-5 items) - Exploratory questions for deeper content
   - Types: analytical, practical, philosophical, comparative

The contentId should be: ${summary.contentId}

Ensure output matches the WritingIdeas JSON schema exactly.`;
}
