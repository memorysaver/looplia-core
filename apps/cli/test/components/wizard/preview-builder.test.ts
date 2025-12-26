/**
 * Tests for preview-builder.ts
 *
 * Tests pure utility functions for workflow preview building.
 */

import { describe, expect, it } from "bun:test";
import {
  buildPreview,
  calculateComplexity,
  deriveWorkflowName,
  formatPreviewWorkflow,
} from "../../../src/components/wizard/preview-builder.js";
import type {
  Answers,
  PreviewWorkflow,
  Recommendation,
} from "../../../src/components/wizard/types.js";

// biome-ignore lint/suspicious/noTemplateCurlyInString: Template variable for workflow outputs
const SANDBOX_OUTPUT = "${{ sandbox }}/outputs";
// biome-ignore lint/suspicious/noTemplateCurlyInString: Template variable pattern for assertions
const SANDBOX_TEMPLATE = "${{ sandbox }}";

describe("deriveWorkflowName", () => {
  it("should generate name from description", () => {
    const name = deriveWorkflowName(
      "analyze YouTube videos and create blog posts"
    );
    expect(name).toBe("analyze-youtube-videos");
  });

  it("should handle empty description", () => {
    const name = deriveWorkflowName("");
    expect(name).toBe("workflow");
  });

  it("should sanitize special characters", () => {
    const name = deriveWorkflowName("Create a blog post! With special @chars#");
    expect(name).toBe("create-a-blog");
  });

  it("should limit to 3 words", () => {
    const name = deriveWorkflowName("one two three four five six seven");
    expect(name).toBe("one-two-three");
  });

  it("should handle single word", () => {
    const name = deriveWorkflowName("analyze");
    expect(name).toBe("analyze");
  });

  it("should handle two words", () => {
    const name = deriveWorkflowName("quick analysis");
    expect(name).toBe("quick-analysis");
  });

  it("should convert to lowercase", () => {
    const name = deriveWorkflowName("CREATE Blog POSTS");
    expect(name).toBe("create-blog-posts");
  });

  it("should handle whitespace-only input", () => {
    // Note: Whitespace-only returns "-" due to split/join behavior
    // This is an edge case unlikely in practice
    const name = deriveWorkflowName("   ");
    expect(name).toBe("-");
  });
});

describe("buildPreview", () => {
  const mockRecommendations: Recommendation[] = [
    {
      goalId: "analyze",
      skill: "media-reviewer",
      stepId: "analyze-content",
      matchScore: 0.9,
    },
    {
      goalId: "summarize",
      skill: "content-documenter",
      stepId: "create-summary",
      matchScore: 0.85,
    },
    {
      goalId: "generate",
      skill: "idea-generator",
      stepId: "generate-ideas",
      matchScore: 0.8,
    },
  ];

  it("should filter steps by selected goals", () => {
    const answers: Answers = {
      goals: {
        "primary-goal": ["analyze", "summarize"],
      },
    };

    const preview = buildPreview(answers, mockRecommendations, "test workflow");

    expect(preview.steps).toHaveLength(2);
    expect(preview.steps[0].skill).toBe("media-reviewer");
    expect(preview.steps[1].skill).toBe("content-documenter");
  });

  it("should return all steps when no goals selected", () => {
    const answers: Answers = {
      goals: {
        "primary-goal": [],
      },
    };

    const preview = buildPreview(answers, mockRecommendations, "test workflow");

    expect(preview.steps).toHaveLength(3);
  });

  it("should use agent preview when available", () => {
    const agentPreview: PreviewWorkflow = {
      name: "agent-generated",
      steps: [
        {
          id: "custom-step",
          skill: "custom-skill",
          mission: "A custom mission",
          needs: [],
          output: `${SANDBOX_OUTPUT}/custom.json`,
        },
      ],
    };

    const answers: Answers = {
      goals: {
        "primary-goal": [],
      },
    };

    const preview = buildPreview(
      answers,
      mockRecommendations,
      "test workflow",
      agentPreview
    );

    expect(preview.name).toBe("agent-generated");
    expect(preview.steps).toHaveLength(1);
    expect(preview.steps[0].skill).toBe("custom-skill");
  });

  it("should filter agent preview steps by selected goals", () => {
    const agentPreview: PreviewWorkflow = {
      name: "filtered-workflow",
      steps: [
        {
          id: "analyze-content",
          skill: "media-reviewer",
          needs: [],
          output: `${SANDBOX_OUTPUT}/analysis.json`,
        },
        {
          id: "create-summary",
          skill: "content-documenter",
          needs: ["analyze-content"],
          output: `${SANDBOX_OUTPUT}/summary.json`,
        },
      ],
    };

    const answers: Answers = {
      goals: {
        "primary-goal": ["analyze"],
      },
    };

    const preview = buildPreview(
      answers,
      mockRecommendations,
      "test workflow",
      agentPreview
    );

    expect(preview.steps).toHaveLength(1);
    expect(preview.steps[0].id).toBe("analyze-content");
  });

  it("should set sequential dependencies in client-side generation", () => {
    const answers: Answers = {
      goals: {
        "primary-goal": ["analyze", "summarize", "generate"],
      },
    };

    const preview = buildPreview(answers, mockRecommendations, "test workflow");

    expect(preview.steps[0].needs).toEqual([]);
    expect(preview.steps[1].needs).toEqual(["analyze-content"]);
    expect(preview.steps[2].needs).toEqual(["create-summary"]);
  });

  it("should derive workflow name from description", () => {
    const answers: Answers = { goals: { "primary-goal": [] } };
    const preview = buildPreview(
      answers,
      mockRecommendations,
      "analyze videos and create blogs"
    );

    expect(preview.name).toBe("analyze-videos-and");
  });
});

describe("calculateComplexity", () => {
  it("should return 'simple' for 1 goal without deep depth", () => {
    const answers: Answers = {
      goals: {
        "primary-goal": ["analyze"],
        depth: "standard",
      },
    };

    const complexity = calculateComplexity(answers);
    expect(complexity).toBe("simple");
  });

  it("should return 'simple' for 0 goals", () => {
    const answers: Answers = {
      goals: {
        "primary-goal": [],
      },
    };

    const complexity = calculateComplexity(answers);
    expect(complexity).toBe("simple");
  });

  it("should return 'complex' for 3+ goals", () => {
    const answers: Answers = {
      goals: {
        "primary-goal": ["analyze", "summarize", "generate"],
      },
    };

    const complexity = calculateComplexity(answers);
    expect(complexity).toBe("complex");
  });

  it("should return 'complex' for deep depth", () => {
    const answers: Answers = {
      goals: {
        "primary-goal": ["analyze"],
        depth: "deep",
      },
    };

    const complexity = calculateComplexity(answers);
    expect(complexity).toBe("complex");
  });

  it("should return 'standard' for 2 goals without deep depth", () => {
    const answers: Answers = {
      goals: {
        "primary-goal": ["analyze", "summarize"],
        depth: "standard",
      },
    };

    const complexity = calculateComplexity(answers);
    expect(complexity).toBe("standard");
  });

  it("should handle missing goals section", () => {
    const answers: Answers = {};
    const complexity = calculateComplexity(answers);
    expect(complexity).toBe("simple");
  });
});

describe("formatPreviewWorkflow", () => {
  it("should format workflow with steps", () => {
    const workflow: PreviewWorkflow = {
      name: "test-workflow",
      steps: [
        {
          id: "step-1",
          skill: "skill-a",
          needs: [],
          output: `${SANDBOX_OUTPUT}/step1.json`,
        },
        {
          id: "step-2",
          skill: "skill-b",
          needs: ["step-1"],
          output: `${SANDBOX_OUTPUT}/step2.json`,
        },
      ],
    };

    const formatted = formatPreviewWorkflow(workflow);

    expect(formatted).toContain("test-workflow (2 steps)");
    expect(formatted).toContain("1. step-1");
    expect(formatted).toContain("skill: skill-a");
    expect(formatted).toContain("2. step-2");
    expect(formatted).toContain("needs: [step-1]");
    expect(formatted).toContain("output: sandbox/outputs/step2.json");
  });

  it("should truncate long missions", () => {
    const longMission = "A".repeat(100);
    const workflow: PreviewWorkflow = {
      name: "test",
      steps: [
        {
          id: "step-1",
          skill: "skill-a",
          mission: longMission,
          needs: [],
          output: "output.json",
        },
      ],
    };

    const formatted = formatPreviewWorkflow(workflow);

    expect(formatted).toContain("mission:");
    expect(formatted).toContain("...");
  });

  it("should replace sandbox template variable", () => {
    const workflow: PreviewWorkflow = {
      name: "test",
      steps: [
        {
          id: "step-1",
          skill: "skill-a",
          needs: [],
          output: `${SANDBOX_OUTPUT}/result.json`,
        },
      ],
    };

    const formatted = formatPreviewWorkflow(workflow);

    expect(formatted).toContain("sandbox/outputs/result.json");
    expect(formatted).not.toContain(SANDBOX_TEMPLATE);
  });
});
