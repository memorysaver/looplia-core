import type { ContentSummary, UserProfile } from "@looplia-core/core";

/**
 * System prompt for idea generation
 *
 * @deprecated v0.3.1 uses agentic approach with CLAUDE.md + skills.
 * This system prompt is only used for backward compatibility.
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
 *
 * @deprecated v0.3.1 uses single-call agentic approach for writing kit.
 * Use createClaudeWritingKitProvider for the new architecture.
 *
 * The v0.3.1 architecture uses:
 * - Single prompt: "Build writing kit for: contentItem/{id}/content.md"
 * - Agent reads CLAUDE.md for full instructions
 * - Ideas generated as part of the complete WritingKit
 * - Results stored in contentItem/{id}/results/
 */
export function buildIdeasPrompt(
  summary: ContentSummary,
  user: UserProfile
): string {
  // Invoke idea-generator subagent for personalized writing ideas
  // Uses content summary and user profile to generate hooks, angles, questions
  return `Invoke \`idea-generator\` subagent to generate personalized writing ideas.

Content ID: ${summary.contentId}
Summary Location: contentItem/${summary.contentId}/results/summary.json
User Profile: ~/.looplia/user-profile.json

The idea-generator agent will:
1. Read the ContentSummary from the results folder
2. Read the user profile for personalization
3. Generate 5 types of hooks: emotional, curiosity, controversy, statistic, story
4. Suggest narrative angles with relevance scores (0-1 scale)
5. Formulate exploratory questions: analytical, practical, philosophical, comparative
6. Score all ideas based on user topics and interests
7. Write results to contentItem/${summary.contentId}/results/ideas.json

User Context:
- Topics of Interest: ${user.topics.map((t) => `${t.topic} (level ${t.interestLevel})`).join(", ")}
- Preferred Tone: ${user.style.tone}
- Target Word Count: ${user.style.targetWordCount}
- Voice Style: ${user.style.voice}

Ensure output matches WritingIdeas JSON schema with relevance-scored angles.`;
}
