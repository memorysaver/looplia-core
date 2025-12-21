/**
 * Workflow Parser (v0.6.1)
 *
 * Parses workflow.md files with YAML frontmatter + markdown body.
 * v0.6.1: Skills-first format with `skill:` + `mission:` fields.
 * v0.6.0: Steps-based format with `run: agents/{name}` (deprecated).
 *
 * @see docs/DESIGN-0.6.1.md
 */

import { isValidRunFormat } from "./agent-utils";
import type {
  ParsedWorkflow,
  StepValidationState,
  ValidationManifest,
  WorkflowDefinition,
  WorkflowStep,
} from "./workflow";

// Top-level regex constants for performance
const ARRAY_PATTERN = /^\[(.*)\]$/;
const INTEGER_PATTERN = /^\d+$/;
const NON_SPACE_PATTERN = /\S/;
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/** Check if line is empty or a comment */
function isSkippableLine(line: string): boolean {
  const trimmed = line.trim();
  return !trimmed || trimmed.startsWith("#");
}

/** Parse key-value from YAML line */
function parseKeyValue(trimmed: string): { key: string; value: string } | null {
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) {
    return null;
  }
  return {
    key: trimmed.slice(0, colonIndex),
    value: trimmed.slice(colonIndex + 1).trim(),
  };
}

/** Parse array syntax [item1, item2] */
function parseArray(value: string): string[] | null {
  const match = value.match(ARRAY_PATTERN);
  if (match?.[1] !== undefined) {
    return match[1].split(",").map((s) => s.trim());
  }
  return null;
}

/** Convert YAML string value to typed value */
function parseYamlValue(value: string): unknown {
  const array = parseArray(value);
  if (array) {
    return array;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (INTEGER_PATTERN.test(value)) {
    return Number.parseInt(value, 10);
  }
  return value;
}

/** State for YAML parser (v0.6.0 steps format) */
type YamlParserState = {
  result: Record<string, unknown>;
  steps: WorkflowStep[];
  currentKey: string;
  currentStep: Partial<WorkflowStep> | null;
  currentValidate: Record<string, unknown> | null;
};

/** Process a single YAML line */
function processYamlLine(state: YamlParserState, line: string): void {
  if (isSkippableLine(line)) {
    return;
  }

  const indent = line.search(NON_SPACE_PATTERN);
  const trimmed = line.trim();

  if (indent === 0) {
    processTopLevel(state, trimmed);
  } else if (indent === 2 && state.currentKey === "steps") {
    processStepItem(state, trimmed);
  } else if (indent === 4 && state.currentStep) {
    processStepProperty(state, trimmed);
  } else if (indent === 6 && state.currentValidate) {
    processValidateProperty(state, trimmed);
  }
}

/** Process top-level key (indent 0) */
function processTopLevel(state: YamlParserState, trimmed: string): void {
  // Save current step before moving to new section
  if (state.currentStep?.id) {
    state.steps.push(state.currentStep as WorkflowStep);
    state.currentStep = null;
  }

  const kv = parseKeyValue(trimmed);
  if (!kv) {
    return;
  }
  state.currentKey = kv.key;
  if (kv.key !== "steps" && kv.value) {
    state.result[kv.key] = kv.value;
  }
  state.currentValidate = null;
}

/** Process step item start (indent 2, starts with - id:) */
function processStepItem(state: YamlParserState, trimmed: string): void {
  // Check if this is a new step item (starts with -)
  if (trimmed.startsWith("- ")) {
    // Save previous step before starting new one
    if (state.currentStep?.id) {
      state.steps.push(state.currentStep as WorkflowStep);
    }
    state.currentStep = {};
    state.currentValidate = null;

    // Parse the first property on the same line (e.g., "- id: ideas")
    const firstProp = trimmed.slice(2).trim();
    const kv = parseKeyValue(firstProp);
    if (kv) {
      handleStepProperty(state.currentStep, kv.key, kv.value);
    }
  }
}

/** Handle step property assignment */
function handleStepProperty(
  step: Partial<WorkflowStep>,
  key: string,
  value: string
): Record<string, unknown> | null {
  switch (key) {
    case "id":
      step.id = value;
      break;
    case "skill":
      step.skill = value;
      break;
    case "mission":
      step.mission = value;
      break;
    case "run":
      step.run = value;
      break;
    case "input": {
      const arr = parseArray(value);
      step.input = arr ?? value;
      break;
    }
    case "output":
      step.output = value;
      break;
    case "needs": {
      const arr = parseArray(value);
      if (arr) {
        step.needs = arr;
      }
      break;
    }
    case "final":
      step.final = value === "true";
      break;
    case "validate": {
      const validate: Record<string, unknown> = {};
      step.validate = validate;
      return validate;
    }
    default:
      break;
  }
  return null;
}

/** Process step property (indent 4) */
function processStepProperty(state: YamlParserState, trimmed: string): void {
  if (!state.currentStep) {
    return;
  }
  const kv = parseKeyValue(trimmed);
  if (!kv) {
    return;
  }
  const validate = handleStepProperty(state.currentStep, kv.key, kv.value);
  if (validate) {
    state.currentValidate = validate;
  }
}

/** Process validate property (indent 6) */
function processValidateProperty(
  state: YamlParserState,
  trimmed: string
): void {
  if (!state.currentValidate) {
    return;
  }
  const kv = parseKeyValue(trimmed);
  if (!kv) {
    return;
  }
  state.currentValidate[kv.key] = parseYamlValue(kv.value);
}

/**
 * Parse YAML frontmatter from markdown content
 *
 * Frontmatter must be delimited by --- at the start of the file.
 *
 * @param content - Full markdown file content
 * @returns Parsed frontmatter object and remaining markdown body
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    throw new Error(
      "Invalid workflow file: missing YAML frontmatter (must start with ---)"
    );
  }

  const yamlContent = match[1] ?? "";
  const body = match[2] ?? "";
  const frontmatter = parseSimpleYaml(yamlContent);

  return { frontmatter, body: body.trim() };
}

/**
 * Simple YAML parser for workflow frontmatter (v0.6.0)
 *
 * Handles the v0.6.0 structure:
 * - name: string
 * - version: string
 * - description: string
 * - steps: array of step objects with id, run, input, output, needs, final, validate
 *
 * Note: This is a simplified parser. For complex YAML, consider using a library.
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const state: YamlParserState = {
    result: {},
    steps: [],
    currentKey: "",
    currentStep: null,
    currentValidate: null,
  };

  for (const line of yaml.split("\n")) {
    processYamlLine(state, line);
  }

  // Save final step if exists
  if (state.currentStep?.id) {
    state.steps.push(state.currentStep as WorkflowStep);
  }

  if (state.steps.length > 0) {
    state.result.steps = state.steps;
  }

  return state.result;
}

/**
 * Validate a single workflow step has all required fields and correct format.
 *
 * v0.6.1: Requires `skill` + `mission` (skills-first)
 * v0.6.0: Requires `run` in "agents/{name}" format (deprecated)
 *
 * @throws Error if step is invalid
 */
function validateStep(step: WorkflowStep): void {
  if (!step.id) {
    throw new Error("Each step must have an 'id' field");
  }

  // v0.6.1: skill + mission (preferred)
  // v0.6.0: run (deprecated but still supported)
  const hasSkill = step.skill && step.mission;
  const hasRun = Boolean(step.run);

  if (!(hasSkill || hasRun)) {
    throw new Error(
      `Step '${step.id}' must have either 'skill' + 'mission' (v0.6.1) or 'run' (v0.6.0 deprecated)`
    );
  }

  if (hasSkill && hasRun) {
    throw new Error(
      `Step '${step.id}' cannot have both 'skill' and 'run' - use one or the other`
    );
  }

  // Validate legacy run format if used
  if (hasRun && step.run && !isValidRunFormat(step.run)) {
    throw new Error(
      `Step '${step.id}' has invalid run format '${step.run}'. Expected 'agents/{name}' where name is lowercase alphanumeric with hyphens.`
    );
  }

  if (!step.input) {
    throw new Error(`Step '${step.id}' must have an 'input' field`);
  }
  if (Array.isArray(step.input) && step.input.length === 0) {
    throw new Error(`Step '${step.id}' input array cannot be empty`);
  }
  if (!step.output) {
    throw new Error(`Step '${step.id}' must have an 'output' field`);
  }
}

/**
 * Parse a workflow.md file into structured data (v0.6.0)
 *
 * @param content - Full content of the workflow.md file
 * @returns ParsedWorkflow with definition and instructions
 * @throws Error if file is invalid
 */
export function parseWorkflow(content: string): ParsedWorkflow {
  const { frontmatter, body } = parseFrontmatter(content);

  // Validate required top-level fields
  if (!frontmatter.name || typeof frontmatter.name !== "string") {
    throw new Error("Workflow must have a 'name' field");
  }
  if (!frontmatter.description || typeof frontmatter.description !== "string") {
    throw new Error("Workflow must have a 'description' field");
  }
  if (
    !(frontmatter.steps && Array.isArray(frontmatter.steps)) ||
    frontmatter.steps.length === 0
  ) {
    throw new Error("Workflow must have at least one step defined");
  }

  // Validate each step
  for (const step of frontmatter.steps as WorkflowStep[]) {
    validateStep(step);
  }

  return {
    definition: {
      name: frontmatter.name,
      version: frontmatter.version as string | undefined,
      description: frontmatter.description,
      steps: frontmatter.steps as WorkflowStep[],
    },
    instructions: body,
  };
}

/**
 * Generate a validation manifest from a workflow definition (v0.6.0)
 *
 * This is written to sandbox/{id}/validation.json when a session starts.
 *
 * @param definition - Workflow definition from parsed workflow
 * @returns ValidationManifest for tracking step validation state
 */
export function generateValidationManifest(
  definition: WorkflowDefinition
): ValidationManifest {
  const steps: Record<string, StepValidationState> = {};

  for (const step of definition.steps) {
    steps[step.id] = {
      output: step.output,
      validate: step.validate,
      validated: false,
    };
  }

  return {
    workflow: definition.name,
    version: definition.version,
    steps,
  };
}

/**
 * Get the execution order for workflow steps based on dependencies (v0.6.0)
 *
 * Uses topological sort to ensure dependencies are processed first.
 * Steps without dependencies run in declaration order.
 *
 * @param definition - Workflow definition
 * @returns Array of step IDs in execution order
 * @throws Error if circular dependencies detected
 */
export function getExecutionOrder(definition: WorkflowDefinition): string[] {
  const stepsMap = new Map(definition.steps.map((s) => [s.id, s]));
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(id: string) {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      throw new Error(`Circular dependency detected: ${id}`);
    }

    visiting.add(id);

    const step = stepsMap.get(id);
    if (step?.needs) {
      for (const dep of step.needs) {
        if (!stepsMap.has(dep)) {
          throw new Error(`Unknown dependency '${dep}' in step '${id}'`);
        }
        visit(dep);
      }
    }

    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }

  for (const step of definition.steps) {
    visit(step.id);
  }

  return order;
}

/**
 * Find the final step in a workflow definition (v0.6.0)
 *
 * @param definition - Workflow definition
 * @returns ID of the step marked as final, or last step if none marked
 */
export function getFinalStep(definition: WorkflowDefinition): string {
  for (const step of definition.steps) {
    if (step.final) {
      return step.id;
    }
  }

  // If no step is marked final, return the last one in execution order
  const order = getExecutionOrder(definition);
  const lastStep = order.at(-1);
  if (!lastStep) {
    throw new Error("Workflow has no steps");
  }
  return lastStep;
}
