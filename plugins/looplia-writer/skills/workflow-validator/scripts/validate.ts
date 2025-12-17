#!/usr/bin/env bun
/**
 * Workflow Validator Script (v0.5.1)
 *
 * Deterministic validation of workflow artifacts against criteria.
 * Runs outside LLM context - no tokens consumed.
 *
 * Usage:
 *   bun validate.ts <artifact-path> '<criteria-json>'
 *
 * Example:
 *   bun validate.ts contentItem/session-123/summary.json '{"required_fields":["contentId"],"min_quotes":3}'
 *
 * @see docs/DESIGN-0.5.1.md
 */

import { readFile } from "node:fs/promises";

type ValidationCheck = {
  name: string;
  passed: boolean;
  message: string;
};

type ValidationResult = {
  passed: boolean;
  checks: ValidationCheck[];
};

type ValidationCriteria = {
  required_fields?: string[];
  min_quotes?: number;
  min_key_points?: number;
  min_outline_sections?: number;
  has_hooks?: boolean;
  [key: string]: unknown;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: bun validate.ts <artifact-path> '<criteria-json>'");
    process.exit(1);
  }

  const artifactPath = args[0];
  const criteriaJson = args[1];

  if (!(artifactPath && criteriaJson)) {
    console.error("Error: Both artifact path and criteria JSON are required");
    process.exit(1);
  }

  let data: Record<string, unknown>;
  let criteria: ValidationCriteria;

  // Read artifact file
  try {
    const content = await readFile(artifactPath, "utf-8");
    data = JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    const result: ValidationResult = {
      passed: false,
      checks: [
        {
          name: "file_readable",
          passed: false,
          message: `Failed to read artifact: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // Parse criteria JSON
  try {
    criteria = JSON.parse(criteriaJson) as ValidationCriteria;
  } catch (error) {
    const result: ValidationResult = {
      passed: false,
      checks: [
        {
          name: "criteria_valid",
          passed: false,
          message: `Invalid criteria JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // Run validation
  const result = validate(data, criteria);
  console.log(JSON.stringify(result, null, 2));
}

function validate(
  data: Record<string, unknown>,
  criteria: ValidationCriteria
): ValidationResult {
  const checks: ValidationCheck[] = [];

  // Check required_fields
  if (criteria.required_fields) {
    for (const field of criteria.required_fields) {
      const exists = hasField(data, field);
      checks.push({
        name: `has_${field}`,
        passed: exists,
        message: exists ? "OK" : `Missing required field: ${field}`,
      });
    }
  }

  // Check min_quotes
  if (criteria.min_quotes !== undefined) {
    const quotes = getArrayLength(data, "importantQuotes");
    const passed = quotes >= criteria.min_quotes;
    checks.push({
      name: "min_quotes",
      passed,
      message: passed
        ? `Found ${quotes} quotes (min: ${criteria.min_quotes})`
        : `Found ${quotes} quotes, need at least ${criteria.min_quotes}`,
    });
  }

  // Check min_key_points (checks bullets or keyPoints array)
  if (criteria.min_key_points !== undefined) {
    const bullets = getArrayLength(data, "bullets");
    const keyPoints = getArrayLength(data, "keyPoints");
    const count = Math.max(bullets, keyPoints);
    const passed = count >= criteria.min_key_points;
    checks.push({
      name: "min_key_points",
      passed,
      message: passed
        ? `Found ${count} key points (min: ${criteria.min_key_points})`
        : `Found ${count} key points, need at least ${criteria.min_key_points}`,
    });
  }

  // Check min_outline_sections
  if (criteria.min_outline_sections !== undefined) {
    const sections = getArrayLength(data, "suggestedOutline");
    const passed = sections >= criteria.min_outline_sections;
    checks.push({
      name: "min_outline_sections",
      passed,
      message: passed
        ? `Found ${sections} outline sections (min: ${criteria.min_outline_sections})`
        : `Found ${sections} sections, need at least ${criteria.min_outline_sections}`,
    });
  }

  // Check has_hooks
  if (criteria.has_hooks === true) {
    // Check nested in ideas.hooks or top-level hooks
    let hooksCount = 0;
    const ideas = data.ideas as Record<string, unknown> | undefined;
    if (ideas && Array.isArray(ideas.hooks)) {
      hooksCount = ideas.hooks.length;
    } else if (Array.isArray(data.hooks)) {
      hooksCount = data.hooks.length;
    }
    const passed = hooksCount > 0;
    checks.push({
      name: "has_hooks",
      passed,
      message: passed
        ? `Found ${hooksCount} hooks`
        : "No hooks found in artifact",
    });
  }

  // Calculate overall pass/fail
  const passed = checks.every((check) => check.passed);

  return { passed, checks };
}

function hasField(data: Record<string, unknown>, field: string): boolean {
  // Support nested fields with dot notation (e.g., "summary.headline")
  const parts = field.split(".");
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || typeof current !== "object") {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current !== undefined && current !== null;
}

function getArrayLength(data: Record<string, unknown>, field: string): number {
  const value = data[field];
  if (Array.isArray(value)) {
    return value.length;
  }
  return 0;
}

main();
