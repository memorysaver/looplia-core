import { describe, expect, it } from "bun:test";
import {
  createTransformContext,
  transformSdkMessage,
} from "../../../src/claude-agent-sdk/streaming/transformer";

describe("streaming/transformer", () => {
  describe("createTransformContext", () => {
    it("should create initial context with empty state", () => {
      const context = createTransformContext("claude-sonnet-4");

      expect(context.model).toBe("claude-sonnet-4");
      expect(context.sessionId).toBe("");
      expect(context.toolUseMap.size).toBe(0);
    });
  });

  describe("transformSdkMessage", () => {
    it("should transform system.init to session_start event", () => {
      const context = createTransformContext("claude-sonnet-4");
      const message = {
        type: "system",
        subtype: "init",
        sessionId: "test-session-123",
        tools: ["Read", "Skill"],
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("session_start");
      if (events[0].type === "session_start") {
        expect(events[0].sessionId).toBe("test-session-123");
        expect(events[0].model).toBe("claude-sonnet-4");
        expect(events[0].availableTools).toEqual(["Read", "Skill"]);
      }
      expect(context.sessionId).toBe("test-session-123");
    });

    it("should transform assistant message with text content", () => {
      const context = createTransformContext("claude-sonnet-4");
      const message = {
        type: "assistant",
        subtype: "message",
        content: [
          {
            type: "text",
            text: "Hello, world!",
          },
        ],
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("text");
      if (events[0].type === "text") {
        expect(events[0].content).toBe("Hello, world!");
      }
    });

    it("should transform assistant message with thinking content", () => {
      const context = createTransformContext("claude-sonnet-4");
      const message = {
        type: "assistant",
        subtype: "message",
        content: [
          {
            type: "thinking",
            thinking: "I need to analyze this...",
          },
        ],
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("thinking");
      if (events[0].type === "thinking") {
        expect(events[0].content).toBe("I need to analyze this...");
      }
    });

    it("should transform tool_use to tool_start event", () => {
      const context = createTransformContext("claude-sonnet-4");
      const message = {
        type: "assistant",
        subtype: "message",
        content: [
          {
            type: "tool_use",
            id: "tool-123",
            name: "Read",
            input: { path: "/path/to/file.txt" },
          },
        ],
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("tool_start");
      if (events[0].type === "tool_start") {
        expect(events[0].toolUseId).toBe("tool-123");
        expect(events[0].tool).toBe("Read");
        expect(events[0].input.path).toBe("/path/to/file.txt");
      }
    });

    it("should transform tool_result to tool_end event", () => {
      const context = createTransformContext("claude-sonnet-4");
      const toolUseId = "tool-123";

      // First register the tool start
      context.toolUseMap.set(toolUseId, {
        tool: "Read",
        startTime: Date.now(),
      });

      const message = {
        type: "user",
        subtype: "message",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseId,
            content: "File contents here",
          },
        ],
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("tool_end");
      if (events[0].type === "tool_end") {
        expect(events[0].toolUseId).toBe(toolUseId);
        expect(events[0].tool).toBe("Read");
        expect(events[0].success).toBe(true);
        expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it("should transform result.success to complete event", () => {
      const context = createTransformContext("claude-sonnet-4");
      context.sessionId = "test-session";

      const message = {
        type: "result",
        subtype: "success",
        result: { data: "test result" },
        usage: {
          inputTokens: 100,
          outputTokens: 200,
          totalCostUsd: 0.05,
        },
        durationMs: 5000,
        numTurns: 3,
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("complete");
      if (events[0].type === "complete") {
        expect(events[0].subtype).toBe("success");
        expect(events[0].result).toEqual({ data: "test result" });
        expect(events[0].usage.inputTokens).toBe(100);
        expect(events[0].usage.outputTokens).toBe(200);
        expect(events[0].usage.totalCostUsd).toBe(0.05);
        expect(events[0].metrics.durationMs).toBe(5000);
        expect(events[0].metrics.numTurns).toBe(3);
        expect(events[0].sessionId).toBe("test-session");
      }
    });

    it("should handle error results", () => {
      const context = createTransformContext("claude-sonnet-4");
      const message = {
        type: "result",
        subtype: "error_max_turns",
        usage: {
          inputTokens: 50,
          outputTokens: 100,
          totalCostUsd: 0.02,
        },
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("complete");
      if (events[0].type === "complete") {
        expect(events[0].subtype).toBe("error_max_turns");
      }
    });

    it("should truncate long text content", () => {
      const context = createTransformContext("claude-sonnet-4");
      const longText = "a".repeat(300);
      const message = {
        type: "assistant",
        subtype: "message",
        content: [
          {
            type: "text",
            text: longText,
          },
        ],
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(1);
      if (events[0].type === "text") {
        expect(events[0].content.length).toBeLessThan(longText.length);
        expect(events[0].content).toContain("...");
      }
    });

    it("should ignore unknown message types", () => {
      const context = createTransformContext("claude-sonnet-4");
      const message = {
        type: "unknown_type",
        data: "some data",
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(0);
    });

    it("should handle multiple content blocks in a single message", () => {
      const context = createTransformContext("claude-sonnet-4");
      const message = {
        type: "assistant",
        subtype: "message",
        content: [
          {
            type: "thinking",
            thinking: "Let me think...",
          },
          {
            type: "text",
            text: "Here is the answer",
          },
          {
            type: "tool_use",
            id: "tool-456",
            name: "Skill",
            input: { skill: "test-skill" },
          },
        ],
      };

      const events = Array.from(transformSdkMessage(message, context));

      expect(events.length).toBe(3);
      expect(events[0].type).toBe("thinking");
      expect(events[1].type).toBe("text");
      expect(events[2].type).toBe("tool_start");
    });
  });
});
