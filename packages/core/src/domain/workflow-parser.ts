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
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error(
      "Invalid workflow file: missing YAML frontmatter (must start with ---)"
    );
  }

  const yamlContent = match[1] ?? "";
  const body = match[2] ?? "";

  // Simple YAML parser for our specific structure
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
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  let currentKey = "";
  const outputs: Record<string, Record<string, unknown>> = {};
  let currentOutput = "";
  let currentValidate: Record<string, unknown> | null = null;

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const indent = line.search(NON_SPACE_PATTERN);
    const trimmed = line.trim();

    // Top-level keys (indent 0)
    if (indent === 0) {
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      currentKey = trimmed.slice(0, colonIndex);
      const value = trimmed.slice(colonIndex + 1).trim();

      if (currentKey === "outputs") {
        // outputs object already initialized
      } else if (value) {
        result[currentKey] = value;
      }
      currentOutput = "";
      currentValidate = null;
    }
    // Output names (indent 2)
    else if (indent === 2 && currentKey === "outputs") {
      if (trimmed.endsWith(":")) {
        currentOutput = trimmed.slice(0, -1);
        outputs[currentOutput] = {};
        currentValidate = null;
      }
    }
    // Output properties (indent 4)
    else if (indent === 4 && currentOutput) {
      const outputObj = outputs[currentOutput];
      if (!outputObj) {
        continue;
      }

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      const propKey = trimmed.slice(0, colonIndex);
      const propValue = trimmed.slice(colonIndex + 1).trim();

      if (propKey === "validate") {
        currentValidate = {};
        outputObj.validate = currentValidate;
      } else if (propKey === "requires") {
        // Parse array: [item1, item2]
        const arrayMatch = propValue.match(ARRAY_PATTERN);
        if (arrayMatch?.[1]) {
          outputObj.requires = arrayMatch[1].split(",").map((s) => s.trim());
        }
      } else if (propKey === "final") {
        outputObj.final = propValue === "true";
      } else if (propValue) {
        outputObj[propKey] = propValue;
      }
    }
    // Validate properties (indent 6)
    else if (indent === 6 && currentValidate) {
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      const propKey = trimmed.slice(0, colonIndex);
      const propValue = trimmed.slice(colonIndex + 1).trim();

      // Parse array: [item1, item2]
      const arrayMatch = propValue.match(ARRAY_PATTERN);
      if (arrayMatch?.[1] !== undefined) {
        currentValidate[propKey] = arrayMatch[1]
          .split(",")
          .map((s) => s.trim());
      } else if (propValue === "true") {
        currentValidate[propKey] = true;
      } else if (propValue === "false") {
        currentValidate[propKey] = false;
      } else if (INTEGER_PATTERN.test(propValue)) {
        currentValidate[propKey] = Number.parseInt(propValue, 10);
      } else {
        currentValidate[propKey] = propValue;
      }
    }
  }

  if (currentKey === "outputs" || Object.keys(outputs).length > 0) {
    result.outputs = outputs;
  }

  return result;
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
