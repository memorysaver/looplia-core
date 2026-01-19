import { describe, expect, it } from "bun:test";
import {
  extractAgentName,
  isValidRunFormat,
} from "../../src/domain/agent-utils";
import {
  generateValidationManifest,
  getExecutionOrder,
  getFinalStep,
  parseFrontmatter,
  parseWorkflow,
} from "../../src/domain/workflow-parser";

// Sample valid workflow content
const validWorkflowContent = `---
name: test-workflow
version: 1.0.0
description: A test workflow

steps:
  - id: analyze
    run: agents/content-analyzer
    input: \${{ sandbox }}/input.md
    output: \${{ sandbox }}/summary.json

  - id: generate
    run: agents/idea-generator
    input: \${{ steps.analyze.output }}
    output: \${{ sandbox }}/ideas.json
    needs: [analyze]
    validate:
      required_fields: [contentId, hooks]

  - id: build
    run: agents/writing-kit-builder
    input: [\${{ steps.analyze.output }}, \${{ steps.generate.output }}]
    output: \${{ sandbox }}/kit.json
    needs: [analyze, generate]
    final: true
---

# Instructions

Execute this workflow to build a writing kit.
`;

describe("parseFrontmatter", () => {
  it("should extract YAML frontmatter and body", () => {
    const result = parseFrontmatter(validWorkflowContent);

    expect(result.frontmatter.name).toBe("test-workflow");
    expect(result.frontmatter.description).toBe("A test workflow");
    expect(result.body).toContain("Execute this workflow");
  });

  it("should throw error for missing frontmatter", () => {
    const invalid = "No frontmatter here";

    expect(() => parseFrontmatter(invalid)).toThrow(
      "Invalid workflow file: missing YAML frontmatter"
    );
  });
});

describe("parseWorkflow", () => {
  it("should parse valid workflow content", () => {
    const result = parseWorkflow(validWorkflowContent);

    expect(result.definition.name).toBe("test-workflow");
    expect(result.definition.version).toBe("1.0.0");
    expect(result.definition.steps).toHaveLength(3);
    expect(result.instructions).toContain("Execute this workflow");
  });

  it("should parse step properties correctly", () => {
    const result = parseWorkflow(validWorkflowContent);
    const steps = result.definition.steps;

    // First step
    expect(steps[0].id).toBe("analyze");
    expect(steps[0].run).toBe("agents/content-analyzer");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: workflow syntax uses ${{ }} placeholders
    expect(steps[0].input).toBe("${{ sandbox }}/input.md");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: workflow syntax uses ${{ }} placeholders
    expect(steps[0].output).toBe("${{ sandbox }}/summary.json");
    expect(steps[0].needs).toBeUndefined();
    expect(steps[0].final).toBeUndefined();

    // Second step with needs and validate
    expect(steps[1].id).toBe("generate");
    expect(steps[1].needs).toEqual(["analyze"]);
    expect(steps[1].validate).toEqual({
      required_fields: ["contentId", "hooks"],
    });

    // Third step with array input and final flag
    expect(steps[2].id).toBe("build");
    expect(steps[2].input).toEqual([
      // biome-ignore lint/suspicious/noTemplateCurlyInString: workflow syntax
      "${{ steps.analyze.output }}",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: workflow syntax
      "${{ steps.generate.output }}",
    ]);
    expect(steps[2].needs).toEqual(["analyze", "generate"]);
    expect(steps[2].final).toBe(true);
  });

  it("should throw error for missing name", () => {
    const invalid = `---
description: No name
steps:
  - id: test
    run: agents/test
    input: input.md
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow("'name' field");
  });

  it("should throw error for missing description", () => {
    const invalid = `---
name: test
steps:
  - id: test
    run: agents/test
    input: input.md
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow("'description' field");
  });

  it("should throw error for missing steps", () => {
    const invalid = `---
name: test
description: No steps
---`;

    expect(() => parseWorkflow(invalid)).toThrow("at least one step");
  });

  it("should throw error for missing step id", () => {
    // Note: Our simple YAML parser only creates steps when "- id:" is found
    // A step starting with "- run:" won't be parsed, resulting in "no steps" error
    const invalid = `---
name: test
description: Test
steps:
  - run: agents/test
    input: input.md
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow("at least one step");
  });

  it("should throw error for missing skill or run field", () => {
    const invalid = `---
name: test
description: Test
steps:
  - id: test
    input: input.md
    output: output.json
---`;

    // v0.6.1: requires either skill+mission OR run
    expect(() => parseWorkflow(invalid)).toThrow(
      "must have either 'skill' + 'mission'"
    );
  });

  it("should throw error for invalid run format", () => {
    const invalid = `---
name: test
description: Test
steps:
  - id: test
    run: invalid-format
    input: input.md
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow("invalid run format");
  });

  it("should throw error for uppercase agent name", () => {
    const invalid = `---
name: test
description: Test
steps:
  - id: test
    run: agents/MyAgent
    input: input.md
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow("invalid run format");
  });

  it("should parse v0.6.1 skill+mission syntax", () => {
    // Use escaped template syntax to prevent JS interpretation
    const valid = `---
name: test-workflow
description: Test v0.6.1 skills-first syntax
steps:
  - id: analyze
    skill: media-reviewer
    mission: Analyze and summarize the content
    input: \${{ sandbox }}/inputs/content.md
    output: \${{ sandbox }}/outputs/summary.json
---
Custom instructions here`;

    const result = parseWorkflow(valid);
    expect(result.definition.name).toBe("test-workflow");
    expect(result.definition.steps[0].skill).toBe("media-reviewer");
    expect(result.definition.steps[0].mission).toBe(
      "Analyze and summarize the content"
    );
    expect(result.definition.steps[0].run).toBeUndefined();
  });

  it("should throw error for step with both skill and run", () => {
    const invalid = `---
name: test
description: Test
steps:
  - id: test
    skill: media-reviewer
    mission: Analyze content
    run: agents/test
    input: input.md
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow(
      "cannot have both 'skill' and 'run'"
    );
  });

  it("should throw error for skill without mission", () => {
    const invalid = `---
name: test
description: Test
steps:
  - id: test
    skill: media-reviewer
    input: input.md
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow(
      "must have either 'skill' + 'mission'"
    );
  });

  it("should throw error for missing input field (non-input-less skill)", () => {
    const invalid = `---
name: test
description: Test
steps:
  - id: test
    run: agents/test
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow("'input' field");
  });

  it("should allow missing input field for web-search skill (v0.6.3 input-less)", () => {
    const valid = `---
name: hn-reporter
description: Input-less workflow using web-search skill
steps:
  - id: find-news
    skill: web-search
    mission: Search Hacker News for top AI stories
    output: \${{ sandbox }}/outputs/news.json
---`;

    const result = parseWorkflow(valid);
    expect(result.definition.steps[0].skill).toBe("web-search");
    expect(result.definition.steps[0].input).toBeUndefined();
  });

  it("should parse workflow inputs declaration (v0.6.3)", () => {
    const valid = `---
name: video-comparison
description: Compare two videos
inputs:
  - name: video1
    required: true
    description: First video transcript
  - name: video2
    required: false
    type: file
steps:
  - id: analyze
    skill: media-reviewer
    mission: Analyze the video
    input: \${{ inputs.video1 }}
    output: \${{ sandbox }}/outputs/analysis.json
---`;

    const result = parseWorkflow(valid);
    expect(result.definition.inputs).toHaveLength(2);
    expect(result.definition.inputs?.[0]).toEqual({
      name: "video1",
      required: true,
      description: "First video transcript",
      type: undefined,
    });
    expect(result.definition.inputs?.[1]).toEqual({
      name: "video2",
      required: false,
      description: undefined,
      type: "file",
    });
  });

  it("should throw error for unknown input reference (v0.6.3)", () => {
    const invalid = `---
name: test
description: Test
inputs:
  - name: video1
    required: true
steps:
  - id: analyze
    skill: media-reviewer
    mission: Analyze
    input: \${{ inputs.nonexistent }}
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow("Unknown input reference");
  });

  it("should validate input references in array input (v0.6.3)", () => {
    const invalid = `---
name: test
description: Test
inputs:
  - name: video1
    required: true
steps:
  - id: analyze
    skill: media-reviewer
    mission: Analyze
    input: [\${{ inputs.video1 }}, \${{ inputs.video2 }}]
    output: output.json
---`;

    expect(() => parseWorkflow(invalid)).toThrow(
      "Unknown input reference: inputs.video2"
    );
  });

  it("should allow valid input references (v0.6.3)", () => {
    const valid = `---
name: multi-input-workflow
description: Uses multiple inputs
inputs:
  - name: transcript
    required: true
  - name: notes
    required: false
steps:
  - id: analyze
    skill: media-reviewer
    mission: Analyze content
    input: [\${{ inputs.transcript }}, \${{ inputs.notes }}]
    output: \${{ sandbox }}/outputs/analysis.json
---`;

    const result = parseWorkflow(valid);
    expect(result.definition.inputs).toHaveLength(2);
    expect(result.definition.steps[0].input).toEqual([
      // biome-ignore lint/suspicious/noTemplateCurlyInString: workflow syntax
      "${{ inputs.transcript }}",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: workflow syntax
      "${{ inputs.notes }}",
    ]);
  });

  it("should throw error for missing output field", () => {
    const invalid = `---
name: test
description: Test
steps:
  - id: test
    run: agents/test
    input: input.md
---`;

    expect(() => parseWorkflow(invalid)).toThrow("'output' field");
  });
});

describe("generateValidationManifest", () => {
  it("should generate manifest from workflow definition", () => {
    const { definition } = parseWorkflow(validWorkflowContent);
    const manifest = generateValidationManifest(definition);

    expect(manifest.workflow).toBe("test-workflow");
    expect(manifest.version).toBe("1.0.0");
    expect(Object.keys(manifest.steps)).toHaveLength(3);
  });

  it("should include validation criteria for steps that have it", () => {
    const { definition } = parseWorkflow(validWorkflowContent);
    const manifest = generateValidationManifest(definition);

    expect(manifest.steps.analyze.validate).toBeUndefined();
    expect(manifest.steps.generate.validate).toEqual({
      required_fields: ["contentId", "hooks"],
    });
  });

  it("should initialize all steps as not validated", () => {
    const { definition } = parseWorkflow(validWorkflowContent);
    const manifest = generateValidationManifest(definition);

    expect(manifest.steps.analyze.validated).toBe(false);
    expect(manifest.steps.generate.validated).toBe(false);
    expect(manifest.steps.build.validated).toBe(false);
  });
});

describe("getExecutionOrder", () => {
  it("should return steps in dependency order", () => {
    const { definition } = parseWorkflow(validWorkflowContent);
    const order = getExecutionOrder(definition);

    expect(order).toEqual(["analyze", "generate", "build"]);
  });

  it("should handle steps without dependencies first", () => {
    const content = `---
name: test
description: Test
steps:
  - id: second
    run: agents/test
    input: first.json
    output: second.json
    needs: [first]
  - id: first
    run: agents/test
    input: input.md
    output: first.json
---`;

    const { definition } = parseWorkflow(content);
    const order = getExecutionOrder(definition);

    expect(order[0]).toBe("first");
    expect(order[1]).toBe("second");
  });

  it("should detect circular dependencies", () => {
    const content = `---
name: test
description: Test
steps:
  - id: a
    run: agents/test
    input: b.json
    output: a.json
    needs: [b]
  - id: b
    run: agents/test
    input: a.json
    output: b.json
    needs: [a]
---`;

    const { definition } = parseWorkflow(content);

    expect(() => getExecutionOrder(definition)).toThrow(
      "Circular dependency detected"
    );
  });

  it("should throw error for unknown dependency", () => {
    const content = `---
name: test
description: Test
steps:
  - id: test
    run: agents/test
    input: input.md
    output: output.json
    needs: [nonexistent]
---`;

    const { definition } = parseWorkflow(content);

    expect(() => getExecutionOrder(definition)).toThrow("Unknown dependency");
  });
});

describe("getFinalStep", () => {
  it("should return step marked as final", () => {
    const { definition } = parseWorkflow(validWorkflowContent);
    const finalStep = getFinalStep(definition);

    expect(finalStep).toBe("build");
  });

  it("should return last step if none marked final", () => {
    const content = `---
name: test
description: Test
steps:
  - id: first
    run: agents/test
    input: input.md
    output: first.json
  - id: second
    run: agents/test
    input: first.json
    output: second.json
    needs: [first]
---`;

    const { definition } = parseWorkflow(content);
    const finalStep = getFinalStep(definition);

    expect(finalStep).toBe("second");
  });
});

describe("extractAgentName", () => {
  it("should extract agent name from valid run field", () => {
    expect(extractAgentName("agents/content-analyzer")).toBe(
      "content-analyzer"
    );
    expect(extractAgentName("agents/idea-generator")).toBe("idea-generator");
    expect(extractAgentName("agents/test")).toBe("test");
    expect(extractAgentName("agents/a1")).toBe("a1");
  });

  it("should return null for invalid formats", () => {
    expect(extractAgentName("invalid")).toBeNull();
    expect(extractAgentName("agents/")).toBeNull();
    expect(extractAgentName("agents/MyAgent")).toBeNull(); // uppercase
    expect(extractAgentName("agent/test")).toBeNull(); // wrong prefix
    expect(extractAgentName("")).toBeNull();
  });

  it("should reject agent names starting with hyphen or number", () => {
    expect(extractAgentName("agents/-test")).toBeNull();
    expect(extractAgentName("agents/1test")).toBeNull();
  });
});

describe("isValidRunFormat", () => {
  it("should return true for valid formats", () => {
    expect(isValidRunFormat("agents/content-analyzer")).toBe(true);
    expect(isValidRunFormat("agents/test")).toBe(true);
    expect(isValidRunFormat("agents/my-agent-v2")).toBe(true);
  });

  it("should return false for invalid formats", () => {
    expect(isValidRunFormat("invalid")).toBe(false);
    expect(isValidRunFormat("agents/")).toBe(false);
    expect(isValidRunFormat("agents/MyAgent")).toBe(false);
    expect(isValidRunFormat("")).toBe(false);
  });
});
