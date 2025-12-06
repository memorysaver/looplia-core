import type { ProviderError } from "@looplia-core/core";

/**
 * SDK result message subtypes for error handling
 */
export type SdkResultSubtype =
  | "success"
  | "error_max_turns"
  | "error_max_budget_usd"
  | "error_during_execution";

/**
 * SDK result message structure
 */
export type SdkResultMessage = {
  type: "result";
  subtype: SdkResultSubtype;
  errors?: string[];
};

/**
 * Map SDK result errors to Looplia ProviderError types
 */
export function mapSdkError(message: SdkResultMessage): {
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
          message: message.errors?.join(", ") ?? "Execution error",
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
    if (error.message.includes("API key") || error.message.includes("api_key")) {
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
    if (
      error.message.includes("rate limit") ||
      error.message.includes("429")
    ) {
      return {
        success: false,
        error: {
          type: "rate_limit",
          retryAfterMs: 60000, // Default 1 minute
          message: error.message,
        },
      };
    }

    // Content moderation
    if (
      error.message.includes("content") &&
      error.message.includes("policy")
    ) {
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
