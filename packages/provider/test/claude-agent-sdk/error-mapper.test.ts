import { describe, expect, it } from "bun:test";
import {
  mapException,
  mapSdkError,
} from "../../src/claude-agent-sdk/utils/error-mapper";

describe("error-mapper", () => {
  describe("mapSdkError", () => {
    it("should map error_max_turns to unknown error", () => {
      const result = mapSdkError({
        type: "result",
        subtype: "error_max_turns",
      });

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("unknown");
      expect(result.error.message).toBe("Max conversation turns exceeded");
    });

    it("should map error_max_budget_usd to rate_limit error", () => {
      const result = mapSdkError({
        type: "result",
        subtype: "error_max_budget_usd",
      });

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("rate_limit");
      if (result.error.type === "rate_limit") {
        expect(result.error.retryAfterMs).toBe(0);
      }
      expect(result.error.message).toBe("Usage budget exceeded");
    });

    it("should map error_during_execution with errors array", () => {
      const result = mapSdkError({
        type: "result",
        subtype: "error_during_execution",
        errors: ["First error", "Second error"],
      });

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("unknown");
      expect(result.error.message).toBe("First error, Second error");
    });

    it("should handle error_during_execution without errors array", () => {
      const result = mapSdkError({
        type: "result",
        subtype: "error_during_execution",
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toBe("Execution error");
    });

    it("should handle unknown subtypes", () => {
      const result = mapSdkError({
        type: "result",
        // @ts-expect-error Testing unknown subtype
        subtype: "unknown_subtype",
      });

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("unknown");
    });
  });

  describe("mapException", () => {
    it("should map API key errors to validation_error", () => {
      const result = mapException(new Error("Invalid API key provided"));

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("validation_error");
      if (result.error.type === "validation_error") {
        expect(result.error.field).toBe("apiKey");
      }
    });

    it("should map network errors to network_error", () => {
      const result = mapException(new Error("fetch failed: network error"));

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("network_error");
      if (result.error.type === "network_error") {
        expect(result.error.cause).toBeInstanceOf(Error);
      }
    });

    it("should map ENOTFOUND to network_error", () => {
      const result = mapException(
        new Error("getaddrinfo ENOTFOUND api.anthropic.com")
      );

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("network_error");
    });

    it("should map rate limit errors to rate_limit", () => {
      const result = mapException(new Error("Rate limit exceeded (429)"));

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("rate_limit");
      if (result.error.type === "rate_limit") {
        expect(result.error.retryAfterMs).toBe(60_000);
      }
    });

    it("should map content policy errors to content_moderation", () => {
      const result = mapException(
        new Error("Request blocked due to content policy violation")
      );

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("content_moderation");
      if (result.error.type === "content_moderation") {
        expect(result.error.reason).toBe("Content policy violation");
      }
    });

    it("should handle non-Error objects", () => {
      const result = mapException("string error");

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("unknown");
      expect(result.error.message).toBe("string error");
    });

    it("should handle unknown Error types", () => {
      const result = mapException(new Error("Some random error"));

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("unknown");
      expect(result.error.message).toBe("Some random error");
      if (result.error.type === "unknown") {
        expect(result.error.cause).toBeInstanceOf(Error);
      }
    });
  });
});
