/**
 * Type declarations for @anthropic-ai/claude-agent-sdk
 *
 * These types are provided for development purposes.
 * The actual SDK should be installed separately.
 */

declare module "@anthropic-ai/claude-agent-sdk" {
  export type OutputFormat = {
    type: "json_schema";
    schema: object;
  };

  export type QueryOptions = {
    /** Model ID to use */
    model?: string;
    /** Working directory for the agent */
    cwd?: string;
    /** System prompt */
    systemPrompt?: string;
    /** Permission mode */
    permissionMode?: "bypassPermissions" | "default";
    /** Allowed tools */
    allowedTools?: string[];
    /** Output format configuration */
    outputFormat?: OutputFormat;
    /** Request timeout in ms */
    timeout?: number;
    /** Programmatic agent definitions */
    agents?: Record<string, AgentDefinition>;
  };

  export type AgentDefinition = {
    name: string;
    description: string;
    tools?: string[];
    model?: string;
    prompt: string;
  };

  export type QueryInput = {
    prompt: string;
    options?: QueryOptions;
  };

  export type SdkMessage = {
    type: "result" | "message" | "tool_use";
    subtype?:
      | "success"
      | "error_max_turns"
      | "error_max_budget_usd"
      | "error_during_execution";
    structured_output?: unknown;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    total_cost_usd?: number;
    errors?: string[];
  };

  /**
   * Query the Claude Agent SDK
   */
  export function query(input: QueryInput): AsyncIterable<SdkMessage>;
}
