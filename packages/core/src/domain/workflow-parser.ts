/**
 * Workflow Parser (v0.5.1)
 *
 * Parses workflow.md files with YAML frontmatter + markdown body.
 *
 * @see docs/DESIGN-0.5.1.md
 */

import type {
  ParsedWorkflow,
  ValidationManifest,
  WorkflowDefinition,
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

/** Handle output property (indent 4) */
function handleOutputProperty(
  key: string,
  value: string,
  outputObj: Record<string, unknown>
): Record<string, unknown> | null {
  if (key === "validate") {
    const validate: Record<string, unknown> = {};
    outputObj.validate = validate;
    return validate;
  }
  if (key === "requires") {
    const array = parseArray(value);
    if (array) {
      outputObj.requires = array;
    }
    return null;
  }
  if (key === "final") {
    outputObj.final = value === "true";
    return null;
  }
  if (value) {
    outputObj[key] = value;
  }
  return null;
}

/** State for YAML parser */
type YamlParserState = {
  result: Record<string, unknown>;
  outputs: Record<string, Record<string, unknown>>;
  currentKey: string;
  currentOutput: string;
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
  } else if (indent === 2 && state.currentKey === "outputs") {
    processOutputName(state, trimmed);
  } else if (indent === 4 && state.currentOutput) {
    processOutputProperty(state, trimmed);
  } else if (indent === 6 && state.currentValidate) {
    processValidateProperty(state, trimmed);
  }
}

/** Process top-level key (indent 0) */
function processTopLevel(state: YamlParserState, trimmed: string): void {
  const kv = parseKeyValue(trimmed);
  if (!kv) {
    return;
  }
  state.currentKey = kv.key;
  if (kv.key !== "outputs" && kv.value) {
    state.result[kv.key] = kv.value;
  }
  state.currentOutput = "";
  state.currentValidate = null;
}

/** Process output name (indent 2) */
function processOutputName(state: YamlParserState, trimmed: string): void {
  if (trimmed.endsWith(":")) {
    state.currentOutput = trimmed.slice(0, -1);
    state.outputs[state.currentOutput] = {};
    state.currentValidate = null;
  }
}

/** Process output property (indent 4) */
function processOutputProperty(state: YamlParserState, trimmed: string): void {
  const outputObj = state.outputs[state.currentOutput];
  if (!outputObj) {
    return;
  }
  const kv = parseKeyValue(trimmed);
  if (!kv) {
    return;
  }
  const validate = handleOutputProperty(kv.key, kv.value, outputObj);
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
 * Simple YAML parser for workflow frontmatter
 *
 * Handles the specific structure we expect:
 * - name: string
 * - description: string
 * - outputs: nested object with artifact, agent, requires, final, validate
 *
 * Note: This is a simplified parser. For complex YAML, consider using a library.
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const state: YamlParserState = {
    result: {},
    outputs: {},
    currentKey: "",
    currentOutput: "",
    currentValidate: null,
  };

  for (const line of yaml.split("\n")) {
    processYamlLine(state, line);
  }

  if (state.currentKey === "outputs" || Object.keys(state.outputs).length > 0) {
    state.result.outputs = state.outputs;
  }

  return state.result;
}

/**
 * Parse a workflow.md file into structured data
 *
 * @param content - Full content of the workflow.md file
 * @returns ParsedWorkflow with definition and instructions
 * @throws Error if file is invalid
 */
export function parseWorkflow(content: string): ParsedWorkflow {
  const { frontmatter, body } = parseFrontmatter(content);

  // Validate required fields
  if (!frontmatter.name || typeof frontmatter.name !== "string") {
    throw new Error("Workflow must have a 'name' field");
  }
  if (!frontmatter.description || typeof frontmatter.description !== "string") {
    throw new Error("Workflow must have a 'description' field");
  }
  if (
    !frontmatter.outputs ||
    typeof frontmatter.outputs !== "object" ||
    Object.keys(frontmatter.outputs as object).length === 0
  ) {
    throw new Error("Workflow must have at least one output defined");
  }

  const definition: WorkflowDefinition = {
    name: frontmatter.name,
    description: frontmatter.description,
    outputs: frontmatter.outputs as WorkflowDefinition["outputs"],
  };

  return {
    definition,
    instructions: body,
  };
}

/**
 * Generate a validation manifest from a workflow definition
 *
 * This is written to contentItem/{id}/validation.json when a session starts.
 *
 * @param definition - Workflow definition from parsed workflow
 * @returns ValidationManifest for tracking output validation state
 */
export function generateValidationManifest(
  definition: WorkflowDefinition
): ValidationManifest {
  const outputs: ValidationManifest["outputs"] = {};

  for (const [name, output] of Object.entries(definition.outputs)) {
    outputs[name] = {
      artifact: output.artifact,
      criteria: output.validate ?? {},
      validated: false,
    };
  }

  return {
    workflow: definition.name,
    outputs,
  };
}

/**
 * Get the execution order for workflow outputs based on dependencies
 *
 * Uses topological sort to ensure dependencies are processed first.
 *
 * @param definition - Workflow definition
 * @returns Array of output names in execution order
 * @throws Error if circular dependencies detected
 */
export function getExecutionOrder(definition: WorkflowDefinition): string[] {
  const outputs = definition.outputs;
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) {
      return;
    }
    if (visiting.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`);
    }

    visiting.add(name);

    const output = outputs[name];
    if (output?.requires) {
      for (const dep of output.requires) {
        if (!outputs[dep]) {
          throw new Error(`Unknown dependency '${dep}' in output '${name}'`);
        }
        visit(dep);
      }
    }

    visiting.delete(name);
    visited.add(name);
    order.push(name);
  }

  for (const name of Object.keys(outputs)) {
    visit(name);
  }

  return order;
}

/**
 * Find the final output in a workflow definition
 *
 * @param definition - Workflow definition
 * @returns Name of the output marked as final, or last output if none marked
 */
export function getFinalOutput(definition: WorkflowDefinition): string {
  for (const [name, output] of Object.entries(definition.outputs)) {
    if (output.final) {
      return name;
    }
  }

  // If no output is marked final, return the last one in execution order
  const order = getExecutionOrder(definition);
  const lastOutput = order.at(-1);
  if (!lastOutput) {
    throw new Error("Workflow has no outputs");
  }
  return lastOutput;
}
