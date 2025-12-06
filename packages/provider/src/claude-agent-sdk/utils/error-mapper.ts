import type { ProviderError } from "@looplia-core/core";

// Re-export SDK types for convenience
export type {
  SDKMessage,
  SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";

// Import for local use (separate from re-exports to satisfy linter)
type SDKMessage = import("@anthropic-ai/claude-agent-sdk").SDKMessage;
type SDKResultMessage =
  import("@anthropic-ai/claude-agent-sdk").SDKResultMessage;

/** Default retry delay for rate limit errors (ms) */
const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;

/**
 * Type guard to check if an SDK message is a result message
 */
export function isResultMessage(
  message: SDKMessage
): message is SDKResultMessage {
  return message.type === "result";
}

/**
 * Type guard to check if a result message is a success
 */
export function isSuccessResult(
  message: SDKResultMessage
): message is SDKResultMessage & { subtype: "success" } {
  return message.subtype === "success";
}

/**
 * Type guard to check if a result message is an error
 */
export function isErrorResult(
  message: SDKResultMessage
): message is SDKResultMessage & {
  subtype: Exclude<SDKResultMessage["subtype"], "success">;
} {
  return message.subtype !== "success";
}

/**
 * Extract error messages from an SDK error result
 */
function getErrorMessages(message: SDKResultMessage): string {
  if (message.subtype === "success") {
    return "Unknown error";
  }
  return message.errors?.join(", ") ?? "Execution error";
}

/**
 * Map SDK result errors to Looplia ProviderError types
 *
 * Uses type guards to safely extract error information without unsafe type assertions.
 */
export function mapSdkError(message: SDKResultMessage): {
  success: false;
  error: ProviderError;
} {
  switch (message.subtype) {
    case "error_max_turns":
      return {
        success: false,
        error: {
          type: "unknown",
          message: "Max conversation turns exceeded",
        },
      };

    case "error_max_budget_usd":
      return {
        success: false,
        error: {
          type: "rate_limit",
          retryAfterMs: 0,
          message: "Usage budget exceeded",
        },
      };

    case "error_during_execution":
      return {
        success: false,
        error: {
          type: "unknown",
          message: getErrorMessages(message),
        },
      };

    case "error_max_structured_output_retries":
      return {
        success: false,
        error: {
          type: "unknown",
          message: "Max structured output retries exceeded",
        },
      };

    default:
      return {
        success: false,
        error: {
          type: "unknown",
          message: "Unknown SDK error",
        },
      };
  }
}

/**
 * Map JavaScript exceptions to Looplia ProviderError types
 */
export function mapException(error: unknown): {
  success: false;
  error: ProviderError;
} {
  if (error instanceof Error) {
    // API key errors
    if (
      error.message.includes("API key") ||
      error.message.includes("api_key")
    ) {
      return {
        success: false,
        error: {
          type: "validation_error",
          field: "apiKey",
          message: "Invalid or missing API key",
        },
      };
    }

    // Network errors
    if (
      error.message.includes("network") ||
      error.message.includes("fetch") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ECONNREFUSED")
    ) {
      return {
        success: false,
        error: {
          type: "network_error",
          message: error.message,
          cause: error,
        },
      };
    }

    // Rate limit errors
    if (error.message.includes("rate limit") || error.message.includes("429")) {
      return {
        success: false,
        error: {
          type: "rate_limit",
          retryAfterMs: DEFAULT_RATE_LIMIT_RETRY_MS,
          message: error.message,
        },
      };
    }

    // Content moderation
    if (error.message.includes("content") && error.message.includes("policy")) {
      return {
        success: false,
        error: {
          type: "content_moderation",
          reason: "Content policy violation",
          message: error.message,
        },
      };
    }

    return {
      success: false,
      error: {
        type: "unknown",
        message: error.message,
        cause: error,
      },
    };
  }

  return {
    success: false,
    error: {
      type: "unknown",
      message: String(error),
    },
  };
}
