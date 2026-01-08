/**
 * Skill Analyzer Service
 *
 * Calls skill-capability-matcher via the executor to analyze
 * workflow descriptions and generate dynamic clarification questions.
 *
 * v0.7.1: Added streaming variant using interactive executor
 */

import type {
  QuestionCallback,
  StreamingEvent,
} from "@looplia-core/provider/claude-agent-sdk";
import { createClaudeAgentExecutor } from "@looplia-core/provider/claude-agent-sdk";
import type {
  ClarificationResult,
  PreviewWorkflow,
  Question,
  Recommendation,
  Section,
} from "./types.js";

// Re-export QuestionCallback for convenience
export type { QuestionCallback } from "@looplia-core/provider/claude-agent-sdk";

/** Regex for splitting words in getShortLabel - defined at module level for performance */
const WORD_SPLIT_REGEX = /\s+/;

/** Regex for removing common question words */
const QUESTION_PREFIX_REGEX =
  /^(what|how|which|where|when|should|do|does|is|are|will)\s+/i;

/** Regex for removing trailing question mark */
const QUESTION_MARK_REGEX = /\?$/;

/** Maximum length for tab labels in wizard UI */
const MAX_TAB_LABEL_LENGTH = 12;

/**
 * Analyze a workflow description and generate clarification questions.
 * Calls plugin-registry-scanner and skill-capability-matcher skills.
 */
export async function analyzeDescription(
  description: string,
  workspace: string
): Promise<ClarificationResult> {
  const executor = createClaudeAgentExecutor({ workspace });

  // Build prompt that invokes the skills and returns structured JSON
  const prompt = buildAnalysisPrompt(description);

  const result = await executor.executePrompt(prompt, {
    workspace,
    contentId: crypto.randomUUID(),
  });

  if (!result.success) {
    throw new Error(result.error?.message ?? "Failed to analyze description");
  }

  // Parse and validate the result
  return parseClarificationResult(result.data);
}

/**
 * Build the prompt for skill analysis
 */
function buildAnalysisPrompt(description: string): string {
  return `You are a workflow builder assistant. Analyze the user's workflow description and generate:
1. Clarification questions
2. Skill recommendations
3. A preview workflow using workflow-schema-composer

## User's Description
"${description}"

## Instructions

1. First, use Skill("plugin-registry-scanner") to discover available skills in the workspace.

2. Use Skill("skill-capability-matcher") to match skills to requirements from the description.

3. Generate DYNAMIC sections for clarification questions:
   - Create 1-4 sections based on what's truly ambiguous or needs clarification
   - Use SHORT 1-2 word titles (max 10 chars): "Source", "Content", "Format", "Output"
   - Keep it minimal - only ask what's truly necessary
   - ALWAYS include "Review" as the LAST section with empty questions array

4. For each question:
   - ALWAYS use "single-select" or "multi-select" type with 2-4 options
   - NEVER use "text" type - always provide selectable options
   - Mark options as "inferred: true" if you detected them from the description
   - Include a "reason" field explaining why you inferred something
   - Each question MUST have an "options" array with at least 2 choices

5. Use Skill("workflow-schema-composer") to generate a preview workflow:
   - Generate proper missions for each step (detailed task descriptions)
   - Include input/output paths using \${{ sandbox }} variable
   - Follow the workflow schema conventions

6. Return ONLY valid JSON (no markdown code blocks):

## Example for "analyze videos and create blog posts":
{
  "requirements": { "inputType": "video", "goals": ["analyze", "generate"], "outputFormat": "markdown" },
  "recommendations": [
    { "goalId": "analyze", "skill": "media-reviewer", "stepId": "analyze-video", "matchScore": 0.9 },
    { "goalId": "generate", "skill": "content-writer", "stepId": "write-blog", "matchScore": 0.85 }
  ],
  "clarificationNeeded": true,
  "clarifications": {
    "sections": [
      {
        "id": "content",
        "title": "Content",
        "completed": false,
        "questions": [{
          "id": "video-source",
          "text": "How will you provide the videos?",
          "type": "single-select",
          "options": [
            { "id": "transcript", "label": "Video transcripts (text files)", "inferred": true },
            { "id": "url", "label": "YouTube URLs" },
            { "id": "local", "label": "Local video files" }
          ],
          "reason": "Inferred transcripts since 'analyze videos' typically works with text"
        }]
      },
      { "id": "review", "title": "Review", "completed": false, "questions": [] }
    ]
  },
  "previewWorkflow": {
    "name": "video-to-blog",
    "steps": [
      {
        "id": "analyze-video",
        "skill": "media-reviewer",
        "mission": "Deep analysis of video transcript. Extract key themes, important quotes with timestamps, and narrative structure.",
        "needs": [],
        "input": "\${{ sandbox }}/inputs/content.md",
        "output": "\${{ sandbox }}/outputs/analysis.json"
      },
      {
        "id": "write-blog",
        "skill": "content-writer",
        "mission": "Create a compelling blog post from the video analysis. Structure with introduction, key points, and conclusion.",
        "needs": ["analyze-video"],
        "input": "\${{ steps.analyze-video.output }}",
        "output": "\${{ sandbox }}/outputs/blog.json"
      }
    ]
  }
}

Important:
- Generate sections DYNAMICALLY based on the description - don't use fixed templates
- Each recommendation's goalId should match a detected goal
- Set inferred: true on options that match keywords in the description
- The review section should always be last with empty questions array
- previewWorkflow must include detailed mission descriptions for each step
- Return ONLY valid JSON, no markdown code blocks or explanation`;
}

/**
 * Raw parsed response type
 */
type ParsedResponse = {
  requirements?: {
    inputType?: string;
    goals?: string[];
    outputFormat?: string;
  };
  recommendations?: Record<string, unknown>[];
  clarificationNeeded?: boolean;
  clarifications?: {
    sections?: Record<string, unknown>[];
  };
  previewWorkflow?: {
    name?: string;
    steps?: Record<string, unknown>[];
  };
};

/**
 * Normalize a question to ensure it has valid options.
 * Converts text questions to single-select with default options.
 */
function normalizeQuestion(question: Record<string, unknown>): Question {
  const id = String(question.id || "question");
  const text = String(question.text || "Please select an option");
  const reason = question.reason ? String(question.reason) : undefined;

  // Check if question has valid options
  const hasValidOptions =
    Array.isArray(question.options) && question.options.length >= 2;

  // If text type or missing options, convert to single-select with defaults
  if (question.type === "text" || !hasValidOptions) {
    return {
      id,
      text,
      type: "single-select",
      options: [
        { id: "default", label: "Use recommended defaults", inferred: true },
        { id: "custom", label: "Let me specify details" },
      ],
      reason: reason || "Select an option to continue",
    };
  }

  // Normalize existing options
  const options = (question.options as Record<string, unknown>[]).map(
    (opt) => ({
      id: String(opt.id || "option"),
      label: String(opt.label || "Option"),
      inferred: Boolean(opt.inferred),
    })
  );

  return {
    id,
    text,
    type: question.type === "multi-select" ? "multi-select" : "single-select",
    options,
    reason,
  };
}

/**
 * Flatten sections: each question becomes its own section (1 question = 1 tab)
 */
function flattenSections(rawSections: Record<string, unknown>[]): Section[] {
  const flatSections: Section[] = [];

  for (const rawSection of rawSections) {
    const sectionId = String(rawSection.id || "unknown");

    if (sectionId === "review") {
      flatSections.push({
        id: "review",
        title: "Review",
        completed: false,
        questions: [],
      });
      continue;
    }

    const questions = Array.isArray(rawSection.questions)
      ? rawSection.questions
      : [];

    for (const rawQuestion of questions) {
      const question = normalizeQuestion(rawQuestion);
      const shortLabel = getShortLabel(question.text);

      flatSections.push({
        id: question.id,
        title: shortLabel,
        completed: false,
        questions: [question],
      });
    }
  }

  // Ensure review section exists at the end
  if (!flatSections.find((s) => s.id === "review")) {
    flatSections.push({
      id: "review",
      title: "Review",
      completed: false,
      questions: [],
    });
  }

  return flatSections;
}

/**
 * Parse recommendations from raw data
 */
function parseRecommendations(
  rawRecommendations: Record<string, unknown>[] | undefined
): Recommendation[] {
  if (!Array.isArray(rawRecommendations)) {
    return [];
  }

  return rawRecommendations.map((r) => ({
    goalId: String(r.goalId || ""),
    skill: String(r.skill || ""),
    stepId: String(r.stepId || r.suggestedStepId || ""),
    matchScore: Number(r.matchScore) || 0.5,
    rationale: r.rationale ? String(r.rationale) : undefined,
  }));
}

/**
 * Parse preview workflow from raw data
 */
function parsePreviewWorkflow(
  rawWorkflow: ParsedResponse["previewWorkflow"]
): PreviewWorkflow | undefined {
  if (!rawWorkflow) {
    return;
  }

  return {
    name: String(rawWorkflow.name || "workflow"),
    steps: (rawWorkflow.steps || []).map((step: Record<string, unknown>) => ({
      id: String(step.id || ""),
      skill: String(step.skill || ""),
      mission: step.mission ? String(step.mission) : undefined,
      needs: Array.isArray(step.needs) ? step.needs.map(String) : [],
      input: step.input ? String(step.input) : undefined,
      output: String(step.output || `sandbox/outputs/${step.id}.json`),
    })),
  };
}

/**
 * Parse and validate the result from the executor
 */
function parseClarificationResult(data: unknown): ClarificationResult {
  const parsed = extractJsonFromResponse(data) as ParsedResponse;

  if (!parsed.clarifications?.sections) {
    throw new Error("Invalid response: missing clarifications.sections");
  }

  return {
    requirements: {
      inputType: parsed.requirements?.inputType,
      goals: parsed.requirements?.goals,
      outputFormat: parsed.requirements?.outputFormat,
    },
    recommendations: parseRecommendations(parsed.recommendations),
    clarificationNeeded: parsed.clarificationNeeded !== false,
    clarifications: {
      sections: flattenSections(parsed.clarifications.sections),
    },
    previewWorkflow: parsePreviewWorkflow(parsed.previewWorkflow),
  };
}

/**
 * Extract a short label (1-2 words) from question text for tab display.
 */
function getShortLabel(text: string): string {
  // Remove common question words and punctuation
  const cleaned = text
    .replace(QUESTION_PREFIX_REGEX, "")
    .replace(QUESTION_MARK_REGEX, "")
    .trim();

  // Get first 1-2 meaningful words
  const words = cleaned.split(WORD_SPLIT_REGEX);
  if (words.length <= 2) {
    return capitalize(words.join(" "));
  }

  // Take first 2 words, max MAX_TAB_LABEL_LENGTH chars total
  let label = words[0] ?? "";
  if (label.length < 8 && words[1] && words[1].length < 6) {
    label = `${label} ${words[1]}`;
  }

  return capitalize(label.slice(0, MAX_TAB_LABEL_LENGTH));
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Extract JSON from various response formats
 */
function extractJsonFromResponse(data: unknown): Record<string, unknown> {
  // If already an object with the expected structure
  if (
    data &&
    typeof data === "object" &&
    "clarifications" in (data as Record<string, unknown>)
  ) {
    return data as Record<string, unknown>;
  }

  // If it's a WorkflowResult with artifact
  if (
    data &&
    typeof data === "object" &&
    "artifact" in (data as Record<string, unknown>)
  ) {
    const artifact = (data as Record<string, unknown>).artifact;
    if (artifact && typeof artifact === "object") {
      return artifact as Record<string, unknown>;
    }
  }

  // If it's a string, try to parse as JSON
  if (typeof data === "string") {
    // Remove markdown code blocks if present
    const jsonStr = data
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse response as JSON");
    }
  }

  throw new Error("Unexpected response format from skill-capability-matcher");
}

/**
 * JSON schema for analysis result
 */
const ANALYSIS_RESULT_SCHEMA = {
  type: "object",
  properties: {
    requirements: {
      type: "object",
      properties: {
        inputType: { type: "string" },
        goals: { type: "array", items: { type: "string" } },
        outputFormat: { type: "string" },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          goalId: { type: "string" },
          skill: { type: "string" },
          stepId: { type: "string" },
          matchScore: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["goalId", "skill", "stepId"],
      },
    },
    clarificationNeeded: { type: "boolean" },
    clarifications: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              completed: { type: "boolean" },
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    text: { type: "string" },
                    type: { type: "string" },
                    options: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          label: { type: "string" },
                          inferred: { type: "boolean" },
                        },
                      },
                    },
                    reason: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    previewWorkflow: {
      type: "object",
      properties: {
        name: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              skill: { type: "string" },
              mission: { type: "string" },
              needs: { type: "array", items: { type: "string" } },
              input: { type: "string" },
              output: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Streaming result type matching StreamingQueryUI expectations
 */
type StreamingResult = {
  success: boolean;
  data?: ClarificationResult;
  error?: { message: string };
};

/**
 * Streaming version of analyzeDescription (v0.7.1)
 *
 * Uses the interactive executor with AskUserQuestion support.
 * Yields StreamingEvent objects for real-time progress display.
 *
 * @param description - User's workflow description
 * @param workspace - Workspace path
 * @param questionCallback - Optional callback to handle AskUserQuestion tool calls
 */
export async function* analyzeDescriptionStreaming(
  description: string,
  workspace: string,
  questionCallback?: QuestionCallback
): AsyncGenerator<StreamingEvent, StreamingResult> {
  // Dynamically import to avoid circular dependencies
  const { executeInteractiveQueryStreaming } = await import(
    "@looplia-core/provider/claude-agent-sdk"
  );

  const prompt = buildAnalysisPrompt(description);

  const generator = executeInteractiveQueryStreaming<ParsedResponse>(
    prompt,
    ANALYSIS_RESULT_SCHEMA as Record<string, unknown>,
    { workspace },
    questionCallback
  );

  let finalData: ParsedResponse | undefined;

  for await (const event of generator) {
    yield event;

    // Capture result from complete event
    if (event.type === "complete" && event.subtype === "success") {
      finalData = event.result as ParsedResponse;
    }
  }

  // Parse and return final result
  if (finalData) {
    try {
      const clarificationResult = parseClarificationResult(finalData);
      return {
        success: true,
        data: clarificationResult,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "Failed to parse result",
        },
      };
    }
  }

  return {
    success: false,
    error: { message: "No result received from analysis" },
  };
}
