/**
 * Workflow Parser (v0.7.0)
 *
 * Parses workflow.md files with YAML frontmatter + markdown body.
 * v0.7.0: Skills declaration support with `skills:` field for selective loading
 * v0.6.3: Named inputs support with `inputs:` declaration
 * v0.6.1: Skills-first format with `skill:` + `mission:` fields.
 * v0.6.0: Steps-based format with `run: agents/{name}` (deprecated).
 *
 * @see docs/DESIGN-0.7.0.md
 */

import { isValidRunFormat } from "./agent-utils";
import type {
  ParsedWorkflow,
  StepValidationState,
  ValidationManifest,
  WorkflowDefinition,
  WorkflowStep,
} from "./workflow";

/**
 * Skills that can operate without input files (input-less capable).
 * These skills generate data autonomously (e.g., web search, local search).
 */
const INPUTLESS_CAPABLE_SKILLS = ["browser-research"];

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

/** Partial WorkflowInput during parsing */
type PartialWorkflowInput = {
  name?: string;
  required?: boolean;
  description?: string;
  type?: "file" | "json";
};

/** State for YAML parser (v0.7.0 with skills support) */
type YamlParserState = {
  result: Record<string, unknown>;
  steps: WorkflowStep[];
  inputs: PartialWorkflowInput[];
  skills: string[];
  currentKey: string;
  currentStep: Partial<WorkflowStep> | null;
  currentInput: PartialWorkflowInput | null;
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
  } else if (indent === 2 && state.currentKey === "skills") {
    processSkillItem(state, trimmed);
  } else if (indent === 2 && state.currentKey === "inputs") {
    processInputItem(state, trimmed);
  } else if (indent === 2 && state.currentKey === "steps") {
    processStepItem(state, trimmed);
  } else if (indent === 4 && state.currentInput) {
    processInputProperty(state, trimmed);
  } else if (indent === 4 && state.currentStep) {
    processStepProperty(state, trimmed);
  } else if (indent === 6 && state.currentValidate) {
    processValidateProperty(state, trimmed);
  }
}

/** Process skill item (indent 2, starts with - skillname) */
function processSkillItem(state: YamlParserState, trimmed: string): void {
  if (trimmed.startsWith("- ")) {
    const skillName = trimmed.slice(2).trim();
    if (skillName) {
      state.skills.push(skillName);
    }
  }
}

/** Process top-level key (indent 0) */
function processTopLevel(state: YamlParserState, trimmed: string): void {
  // Save current step before moving to new section
  if (state.currentStep?.id) {
    state.steps.push(state.currentStep as WorkflowStep);
    state.currentStep = null;
  }

  // Save current input before moving to new section
  if (state.currentInput?.name) {
    state.inputs.push(state.currentInput);
    state.currentInput = null;
  }

  const kv = parseKeyValue(trimmed);
  if (!kv) {
    return;
  }
  state.currentKey = kv.key;
  if (
    kv.key !== "steps" &&
    kv.key !== "inputs" &&
    kv.key !== "skills" &&
    kv.value
  ) {
    state.result[kv.key] = kv.value;
  }
  state.currentValidate = null;
}

/** Process input item start (indent 2, starts with - name:) */
function processInputItem(state: YamlParserState, trimmed: string): void {
  if (trimmed.startsWith("- ")) {
    // Save previous input before starting new one
    if (state.currentInput?.name) {
      state.inputs.push(state.currentInput);
    }
    state.currentInput = {};

    // Parse the first property on the same line (e.g., "- name: video-transcript")
    const firstProp = trimmed.slice(2).trim();
    const kv = parseKeyValue(firstProp);
    if (kv) {
      handleInputProperty(state.currentInput, kv.key, kv.value);
    }
  }
}

/** Handle input property assignment */
function handleInputProperty(
  input: PartialWorkflowInput,
  key: string,
  value: string
): void {
  switch (key) {
    case "name":
      input.name = value;
      break;
    case "required":
      input.required = value === "true";
      break;
    case "description":
      input.description = value;
      break;
    case "type":
      if (value === "file" || value === "json") {
        input.type = value;
      }
      break;
    default:
      break;
  }
}

/** Process input property (indent 4) */
function processInputProperty(state: YamlParserState, trimmed: string): void {
  if (!state.currentInput) {
    return;
  }
  const kv = parseKeyValue(trimmed);
  if (!kv) {
    return;
  }
  handleInputProperty(state.currentInput, kv.key, kv.value);
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
 * Simple YAML parser for workflow frontmatter (v0.6.3)
 *
 * Handles the v0.6.3 structure:
 * - name: string
 * - version: string
 * - description: string
 * - inputs: array of input objects with name, required, description, type
 * - steps: array of step objects with id, skill, mission, input, output, needs, final, validate
 *
 * Note: This is a simplified parser. For complex YAML, consider using a library.
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const state: YamlParserState = {
    result: {},
    steps: [],
    inputs: [],
    skills: [],
    currentKey: "",
    currentStep: null,
    currentInput: null,
    currentValidate: null,
  };

  for (const line of yaml.split("\n")) {
    processYamlLine(state, line);
  }

  // Save final input if exists
  if (state.currentInput?.name) {
    state.inputs.push(state.currentInput);
  }

  // Save final step if exists
  if (state.currentStep?.id) {
    state.steps.push(state.currentStep as WorkflowStep);
  }

  // v0.7.0: Include skills if declared
  if (state.skills.length > 0) {
    state.result.skills = state.skills;
  }

  if (state.inputs.length > 0) {
    state.result.inputs = state.inputs;
  }

  if (state.steps.length > 0) {
    state.result.steps = state.steps;
  }

  return state.result;
}

/** Regex to match ${{ inputs.name }} variable references */
const INPUT_REFERENCE_PATTERN = /\$\{\{\s*inputs\.(\w[\w-]*)\s*\}\}/g;

/**
 * Validate that all ${{ inputs.name }} references in a step's input
 * refer to declared workflow inputs.
 *
 * @param input - Step input (string or array of strings)
 * @param workflowInputs - Declared workflow inputs
 * @throws Error if unknown input reference found
 */
function validateInputReferences(
  input: string | string[],
  workflowInputs: PartialWorkflowInput[]
): void {
  const inputs = Array.isArray(input) ? input : [input];
  const declaredNames = new Set(
    workflowInputs.filter((i) => i.name).map((i) => i.name)
  );

  for (const inp of inputs) {
    // Use matchAll to avoid assignment in loop condition
    const matches = inp.matchAll(INPUT_REFERENCE_PATTERN);
    for (const match of matches) {
      const referencedName = match[1];
      if (referencedName && !declaredNames.has(referencedName)) {
        throw new Error(
          `Unknown input reference: inputs.${referencedName}. ` +
            `Declared inputs: ${[...declaredNames].join(", ") || "(none)"}`
        );
      }
    }
  }
}

/** Validate step has skill+mission or run (but not both) */
function validateStepExecutionMode(step: WorkflowStep): void {
  const hasSkill = Boolean(step.skill && step.mission);
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

  if (hasRun && step.run && !isValidRunFormat(step.run)) {
    throw new Error(
      `Step '${step.id}' has invalid run format '${step.run}'. Expected 'agents/{name}' where name is lowercase alphanumeric with hyphens.`
    );
  }
}

/**
 * Validate a single workflow step has all required fields and correct format.
 *
 * v0.6.3: Input optional for input-less capable skills
 * v0.6.1: Requires `skill` + `mission` (skills-first)
 * v0.6.0: Requires `run` in "agents/{name}" format (deprecated)
 *
 * @param step - Workflow step to validate
 * @param workflowInputs - Declared workflow inputs for reference validation
 * @throws Error if step is invalid
 */
function validateStep(
  step: WorkflowStep,
  workflowInputs: PartialWorkflowInput[] = []
): void {
  if (!step.id) {
    throw new Error("Each step must have an 'id' field");
  }

  validateStepExecutionMode(step);

  // v0.6.3: Input is optional for input-less capable skills
  const isInputlessCapable =
    step.skill && INPUTLESS_CAPABLE_SKILLS.includes(step.skill);

  if (!(step.input || isInputlessCapable)) {
    throw new Error(
      `Step '${step.id}' must have an 'input' field ` +
        `(or use an input-less capable skill like: ${INPUTLESS_CAPABLE_SKILLS.join(", ")})`
    );
  }

  if (Array.isArray(step.input) && step.input.length === 0) {
    throw new Error(`Step '${step.id}' input array cannot be empty`);
  }

  // Validate input references if input is provided and workflow has declared inputs
  if (step.input && workflowInputs.length > 0) {
    validateInputReferences(step.input, workflowInputs);
  }

  if (!step.output) {
    throw new Error(`Step '${step.id}' must have an 'output' field`);
  }
}

/**
 * Parse a workflow.md file into structured data (v0.7.0)
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

  // Parse workflow inputs (v0.6.3)
  const workflowInputs = Array.isArray(frontmatter.inputs)
    ? (frontmatter.inputs as PartialWorkflowInput[])
    : [];

  // Parse workflow skills (v0.7.0)
  const workflowSkills = Array.isArray(frontmatter.skills)
    ? (frontmatter.skills as string[])
    : [];

  // Validate each step with workflow inputs context
  for (const step of frontmatter.steps as WorkflowStep[]) {
    validateStep(step, workflowInputs);
  }

  // Build inputs array with defaults for required field
  const inputs = workflowInputs
    .filter((inp) => inp.name)
    .map((inp) => ({
      name: inp.name as string,
      required: inp.required ?? true,
      description: inp.description,
      type: inp.type,
    }));

  return {
    definition: {
      name: frontmatter.name,
      version: frontmatter.version as string | undefined,
      description: frontmatter.description,
      skills: workflowSkills.length > 0 ? workflowSkills : undefined,
      inputs: inputs.length > 0 ? inputs : undefined,
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

/**
 * Check if a workflow supports input-less execution (v0.6.3)
 *
 * A workflow is input-less capable when:
 * 1. It has no required inputs declaration
 * 2. The first step (no dependencies) uses an input-less capable skill
 *
 * @param definition - Parsed workflow definition
 * @returns true if workflow can run without user-provided inputs
 */
export function isInputlessWorkflow(definition: WorkflowDefinition): boolean {
  // Check if any declared inputs are required
  if (definition.inputs?.some((input) => input.required)) {
    return false;
  }

  // Find the first step(s) - steps with no dependencies
  const firstSteps = definition.steps.filter(
    (step) => !step.needs || step.needs.length === 0
  );

  if (firstSteps.length === 0) {
    return false;
  }

  // All first steps must use input-less capable skills
  return firstSteps.every(
    (step) => step.skill && INPUTLESS_CAPABLE_SKILLS.includes(step.skill)
  );
}

/**
 * Extract skills from workflow definition (v0.7.0)
 *
 * Uses explicit declaration if available, otherwise derives from steps.
 * This is used for selective plugin loading at runtime.
 *
 * @param workflow - Parsed workflow
 * @returns Array of skill names required by the workflow
 */
export function extractWorkflowSkills(workflow: ParsedWorkflow): string[] {
  // Explicit declaration takes priority (v0.7.0)
  if (workflow.definition.skills && workflow.definition.skills.length > 0) {
    return workflow.definition.skills;
  }

  // Fallback: derive from steps (backward compatibility)
  const skills = new Set<string>();
  for (const step of workflow.definition.steps) {
    if (step.skill) {
      skills.add(step.skill);
    }
  }
  return [...skills];
}
