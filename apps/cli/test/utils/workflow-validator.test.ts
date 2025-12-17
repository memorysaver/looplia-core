import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listWorkflows,
  validateWorkflow,
  workflowExists,
} from "../../src/utils/workflow-validator";

describe("workflow-validator", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `looplia-test-${Date.now()}`);
    mkdirSync(join(tempDir, "workflows"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("validateWorkflow", () => {
    it("should return valid result for valid workflow file", () => {
      const workflowContent = `---
name: test-workflow
description: A test workflow

outputs:
  result:
    artifact: result.json
    agent: test-agent
    final: true
---

# Test Workflow Instructions

Do something useful.
`;
      writeFileSync(
        join(tempDir, "workflows/test-workflow.md"),
        workflowContent
      );

      const result = validateWorkflow("test-workflow", tempDir);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.definition.name).toBe("test-workflow");
        expect(result.definition.description).toBe("A test workflow");
        expect(result.definition.outputs.result).toBeDefined();
        expect(result.instructions).toContain("Test Workflow Instructions");
      }
    });

    it("should return NOT_FOUND error for missing workflow", () => {
      const result = validateWorkflow("nonexistent", tempDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain("not found");
      }
    });

    it("should return PARSE_ERROR for invalid frontmatter", () => {
      const invalidContent = "This is not valid markdown frontmatter";
      writeFileSync(join(tempDir, "workflows/invalid.md"), invalidContent);

      const result = validateWorkflow("invalid", tempDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("PARSE_ERROR");
      }
    });

    it("should return PARSE_ERROR for missing required fields", () => {
      const missingName = `---
description: Missing name field

outputs:
  result:
    artifact: result.json
---

Body
`;
      writeFileSync(join(tempDir, "workflows/missing-name.md"), missingName);

      const result = validateWorkflow("missing-name", tempDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("PARSE_ERROR");
        expect(result.error.details).toContain("name");
      }
    });

    it("should return PARSE_ERROR for empty outputs", () => {
      const noOutputs = `---
name: no-outputs
description: Workflow without outputs

outputs:
---

Body
`;
      writeFileSync(join(tempDir, "workflows/no-outputs.md"), noOutputs);

      const result = validateWorkflow("no-outputs", tempDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("PARSE_ERROR");
      }
    });
  });

  describe("workflowExists", () => {
    it("should return true for existing workflow", () => {
      writeFileSync(join(tempDir, "workflows/exists.md"), "---\nname: x\n---");

      expect(workflowExists("exists", tempDir)).toBe(true);
    });

    it("should return false for nonexistent workflow", () => {
      expect(workflowExists("nonexistent", tempDir)).toBe(false);
    });
  });

  describe("listWorkflows", () => {
    it("should list all workflow IDs", () => {
      writeFileSync(join(tempDir, "workflows/workflow-a.md"), "");
      writeFileSync(join(tempDir, "workflows/workflow-b.md"), "");
      writeFileSync(join(tempDir, "workflows/workflow-c.md"), "");

      const workflows = listWorkflows(tempDir);

      expect(workflows).toHaveLength(3);
      expect(workflows).toContain("workflow-a");
      expect(workflows).toContain("workflow-b");
      expect(workflows).toContain("workflow-c");
    });

    it("should return empty array for missing workflows directory", () => {
      const emptyDir = join(tmpdir(), `empty-${Date.now()}`);
      mkdirSync(emptyDir);

      try {
        const workflows = listWorkflows(emptyDir);
        expect(workflows).toHaveLength(0);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("should only include .md files", () => {
      writeFileSync(join(tempDir, "workflows/valid.md"), "");
      writeFileSync(join(tempDir, "workflows/readme.txt"), "");
      writeFileSync(join(tempDir, "workflows/config.json"), "");

      const workflows = listWorkflows(tempDir);

      expect(workflows).toHaveLength(1);
      expect(workflows).toContain("valid");
    });
  });
});
