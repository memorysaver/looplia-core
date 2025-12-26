/**
 * Tests for skill-analyzer.ts helper functions
 *
 * Note: The main `analyzeDescription` function requires the Claude Agent SDK
 * and is better suited for integration tests. These tests focus on the
 * pure helper functions used for parsing and normalization.
 */

import { describe, expect, it } from "bun:test";

/** Regex for splitting words in getShortLabel */
const WORD_SPLIT_REGEX = /\s+/;

/** Regex for removing common question words */
const QUESTION_PREFIX_REGEX =
  /^(what|how|which|where|when|should|do|does|is|are|will)\s+/i;

/** Regex for removing trailing question mark */
const QUESTION_MARK_REGEX = /\?$/;

/** Maximum length for tab labels */
const MAX_TAB_LABEL_LENGTH = 12;

/**
 * Replicated helper: capitalize string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Replicated helper: Extract a short label from question text
 */
function getShortLabel(text: string): string {
  const cleaned = text
    .replace(QUESTION_PREFIX_REGEX, "")
    .replace(QUESTION_MARK_REGEX, "")
    .trim();

  const words = cleaned.split(WORD_SPLIT_REGEX);
  if (words.length <= 2) {
    return capitalize(words.join(" "));
  }

  let label = words[0] ?? "";
  if (label.length < 8 && words[1] && words[1].length < 6) {
    label = `${label} ${words[1]}`;
  }

  return capitalize(label.slice(0, MAX_TAB_LABEL_LENGTH));
}

/**
 * Question type definition
 */
type Question = {
  id: string;
  text: string;
  type: "single-select" | "multi-select";
  options: { id: string; label: string; inferred: boolean }[];
  reason?: string;
};

/**
 * Replicated helper: Normalize a question
 */
function normalizeQuestion(question: Record<string, unknown>): Question {
  const id = String(question.id || "question");
  const text = String(question.text || "Please select an option");
  const reason = question.reason ? String(question.reason) : undefined;

  const hasValidOptions =
    Array.isArray(question.options) && question.options.length >= 2;

  if (question.type === "text" || !hasValidOptions) {
    return {
      id,
      text,
      type: "single-select",
      options: [
        { id: "default", label: "Use recommended defaults", inferred: true },
        { id: "custom", label: "Let me specify details", inferred: false },
      ],
      reason: reason || "Select an option to continue",
    };
  }

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
 * Replicated helper: Extract JSON from response
 */
function extractJsonFromResponse(data: unknown): Record<string, unknown> {
  if (
    data &&
    typeof data === "object" &&
    "clarifications" in (data as Record<string, unknown>)
  ) {
    return data as Record<string, unknown>;
  }

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

  if (typeof data === "string") {
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

describe("getShortLabel", () => {
  it("should extract first 2 words", () => {
    const label = getShortLabel("Content Type Selection");
    expect(label).toBe("Content type");
  });

  it("should limit to 12 chars", () => {
    const label = getShortLabel("Extraordinarily Long Question Text Here");
    expect(label.length).toBeLessThanOrEqual(MAX_TAB_LABEL_LENGTH);
  });

  it("should remove question prefix 'What'", () => {
    const label = getShortLabel("What type of content?");
    expect(label).toBe("Type of");
  });

  it("should remove question prefix 'How'", () => {
    const label = getShortLabel("How should we process?");
    expect(label).toBe("Should we");
  });

  it("should remove question prefix 'Which'", () => {
    const label = getShortLabel("Which format?");
    expect(label).toBe("Format");
  });

  it("should remove trailing question mark", () => {
    // "Output format?" becomes "Output format" (2 words, both returned)
    const label = getShortLabel("Output format?");
    expect(label).toBe("Output format");
  });

  it("should handle single word", () => {
    const label = getShortLabel("Format?");
    expect(label).toBe("Format");
  });

  it("should capitalize first letter", () => {
    const label = getShortLabel("lowercase words");
    expect(label.charAt(0)).toBe("L");
  });
});

describe("normalizeQuestion", () => {
  it("should convert text type to single-select", () => {
    const question = normalizeQuestion({
      id: "custom-input",
      text: "Enter your preference",
      type: "text",
    });

    expect(question.type).toBe("single-select");
    expect(question.options).toHaveLength(2);
    expect(question.options[0].label).toBe("Use recommended defaults");
  });

  it("should preserve valid single-select questions", () => {
    const question = normalizeQuestion({
      id: "format",
      text: "Select format",
      type: "single-select",
      options: [
        { id: "json", label: "JSON" },
        { id: "markdown", label: "Markdown" },
      ],
    });

    expect(question.type).toBe("single-select");
    expect(question.options).toHaveLength(2);
    expect(question.options[0].label).toBe("JSON");
  });

  it("should preserve multi-select type", () => {
    const question = normalizeQuestion({
      id: "goals",
      text: "Select goals",
      type: "multi-select",
      options: [
        { id: "analyze", label: "Analyze" },
        { id: "summarize", label: "Summarize" },
      ],
    });

    expect(question.type).toBe("multi-select");
  });

  it("should add default options when options missing", () => {
    const question = normalizeQuestion({
      id: "missing-options",
      text: "Question without options",
      type: "single-select",
    });

    expect(question.options).toHaveLength(2);
    expect(question.options[0].id).toBe("default");
    expect(question.options[1].id).toBe("custom");
  });

  it("should add default options when only 1 option provided", () => {
    const question = normalizeQuestion({
      id: "one-option",
      text: "Question with one option",
      type: "single-select",
      options: [{ id: "only", label: "Only option" }],
    });

    expect(question.options).toHaveLength(2);
    expect(question.options[0].id).toBe("default");
  });

  it("should preserve reason field", () => {
    const question = normalizeQuestion({
      id: "with-reason",
      text: "Question",
      type: "single-select",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      reason: "Inferred from description",
    });

    expect(question.reason).toBe("Inferred from description");
  });

  it("should handle missing id and text", () => {
    const question = normalizeQuestion({});

    expect(question.id).toBe("question");
    expect(question.text).toBe("Please select an option");
  });

  it("should preserve inferred flag on options", () => {
    const question = normalizeQuestion({
      id: "test",
      text: "Test",
      type: "single-select",
      options: [
        { id: "a", label: "A", inferred: true },
        { id: "b", label: "B", inferred: false },
      ],
    });

    expect(question.options[0].inferred).toBe(true);
    expect(question.options[1].inferred).toBe(false);
  });
});

describe("extractJsonFromResponse", () => {
  it("should extract JSON from markdown code blocks", () => {
    const data = '```json\n{"clarifications": {"sections": []}}\n```';
    const result = extractJsonFromResponse(data);

    expect(result).toHaveProperty("clarifications");
  });

  it("should handle plain JSON string", () => {
    const data = '{"clarifications": {"sections": []}}';
    const result = extractJsonFromResponse(data);

    expect(result).toHaveProperty("clarifications");
  });

  it("should pass through object with clarifications", () => {
    const data = { clarifications: { sections: [] } };
    const result = extractJsonFromResponse(data);

    expect(result).toEqual(data);
  });

  it("should extract artifact from WorkflowResult", () => {
    const data = {
      artifact: { clarifications: { sections: [] } },
    };
    const result = extractJsonFromResponse(data);

    expect(result).toHaveProperty("clarifications");
  });

  it("should throw for invalid JSON string", () => {
    const data = "not valid json";

    expect(() => extractJsonFromResponse(data)).toThrow(
      "Failed to parse response as JSON"
    );
  });

  it("should throw for unexpected format", () => {
    const data = { unexpected: "format" };

    expect(() => extractJsonFromResponse(data)).toThrow(
      "Unexpected response format"
    );
  });

  it("should handle JSON with trailing code block marker", () => {
    const data = '{"clarifications": {"sections": []}}\n```';
    const result = extractJsonFromResponse(data);

    expect(result).toHaveProperty("clarifications");
  });
});

describe("question normalization edge cases", () => {
  it("should handle empty options array", () => {
    const question = normalizeQuestion({
      id: "empty-options",
      text: "Question",
      type: "single-select",
      options: [],
    });

    expect(question.options).toHaveLength(2);
    expect(question.options[0].id).toBe("default");
  });

  it("should coerce non-string id to string", () => {
    const question = normalizeQuestion({
      id: 123,
      text: "Question",
      type: "single-select",
      options: [
        { id: 1, label: "A" },
        { id: 2, label: "B" },
      ],
    });

    expect(question.id).toBe("123");
    expect(question.options[0].id).toBe("1");
  });

  it("should default inferred to false when not provided", () => {
    const question = normalizeQuestion({
      id: "test",
      text: "Test",
      type: "single-select",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    });

    expect(question.options[0].inferred).toBe(false);
    expect(question.options[1].inferred).toBe(false);
  });
});
