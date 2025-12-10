/**
 * Looplia Runtime
 *
 * Encapsulates execution context and provides unified interface for all commands.
 * Handles environment validation, session management, and streaming/batch execution.
 */

import type {
  ContentSummary,
  UserProfile,
  WritingKit,
} from "@looplia-core/core";
import {
  createMockSummarizer,
  createMockWritingKitProvider,
} from "@looplia-core/core";
import {
  createClaudeSummarizer,
  createClaudeWritingKitProvider,
  readUserProfile,
} from "@looplia-core/provider/claude-agent-sdk";
import { renderStreamingQuery } from "../components";
import { isInteractive } from "../utils/terminal";
import { SessionManager } from "./session-manager";
import type {
  AgenticQueryResult,
  BaseConfig,
  ExecutionContext,
  KitConfig,
  StreamingEvent,
  SummarizeConfig,
} from "./types";

/**
 * Main runtime class for CLI command execution
 *
 * Target complexity: ≤10 per method
 */
export class LoopliaRuntime {
  private readonly context: ExecutionContext;
  private readonly sessionManager: SessionManager;

  constructor(config: BaseConfig) {
    this.validateEnvironment(config);
    this.context = this.buildContext(config);
    this.sessionManager = new SessionManager(
      this.context.workspace,
      config.mock
    );
  }

  /**
   * Execute kit building workflow
   *
   * Provider API: buildKitStreaming(content: ContentItem, user: UserProfile)
   */
  async executeKit(config: KitConfig): Promise<AgenticQueryResult<WritingKit>> {
    const content = await this.sessionManager.prepare({
      file: config.file,
      sessionId: config.sessionId,
    });

    // Update context workspace after session preparation
    this.context.workspace = this.sessionManager.getWorkspace();

    const userProfile = await this.loadUserProfile(config);

    // Mock mode uses non-streaming provider
    if (this.context.mock) {
      return this.executeKitMock(content, userProfile);
    }

    const provider = createClaudeWritingKitProvider({
      workspace: this.context.workspace,
    });

    return this.execute<WritingKit>(
      () => provider.buildKitStreaming(content, userProfile),
      { title: "Writing Kit Builder", subtitle: content.title }
    );
  }

  /**
   * Execute kit in mock mode (non-streaming)
   */
  private async executeKitMock(
    content: Parameters<
      ReturnType<typeof createMockWritingKitProvider>["buildKit"]
    >[0],
    userProfile: UserProfile
  ): Promise<AgenticQueryResult<WritingKit>> {
    console.error("⏳ Processing (mock)...");
    const provider = createMockWritingKitProvider();
    const result = await provider.buildKit(content, userProfile);
    return {
      ...result,
      sessionId: `mock-${content.id}`,
    };
  }

  /**
   * Execute summarization workflow
   *
   * Provider API: summarizeStreaming(content: ContentItem, user?: UserProfile)
   */
  async executeSummarize(
    config: SummarizeConfig
  ): Promise<AgenticQueryResult<ContentSummary>> {
    const content = await this.sessionManager.prepareFromFile(config.file);

    // Update context workspace after session preparation
    this.context.workspace = this.sessionManager.getWorkspace();

    // Mock mode uses non-streaming provider
    if (this.context.mock) {
      return this.executeSummarizeMock(content);
    }

    const provider = createClaudeSummarizer({
      workspace: this.context.workspace,
    });

    return this.execute<ContentSummary>(
      () => provider.summarizeStreaming(content),
      { title: "Content Summarizer", subtitle: content.title }
    );
  }

  /**
   * Execute summarize in mock mode (non-streaming)
   */
  private async executeSummarizeMock(
    content: Parameters<ReturnType<typeof createMockSummarizer>["summarize"]>[0]
  ): Promise<AgenticQueryResult<ContentSummary>> {
    console.error("⏳ Processing (mock)...");
    const provider = createMockSummarizer();
    const result = await provider.summarize(content);
    return {
      ...result,
      sessionId: `mock-${content.id}`,
    };
  }

  /**
   * Get the prepared content item (for renderer access)
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Generic execute method - handles streaming vs batch
   */
  private async execute<T>(
    generator: () => AsyncGenerator<StreamingEvent, AgenticQueryResult<T>>,
    options: { title: string; subtitle?: string }
  ): Promise<AgenticQueryResult<T>> {
    if (this.context.mode === "streaming") {
      const { result, error } = await renderStreamingQuery<T>({
        title: options.title,
        subtitle: options.subtitle,
        streamGenerator: generator,
      });

      if (error) {
        return {
          success: false,
          error: { type: "unknown", message: error.message },
          sessionId: "",
        };
      }

      // renderStreamingQuery returns the data directly, wrap it in AgenticQueryResult
      if (result) {
        return {
          success: true,
          data: result,
          sessionId: "", // TODO: capture sessionId from streaming state
        };
      }

      return {
        success: false,
        error: { type: "unknown", message: "No result received" },
        sessionId: "",
      };
    }

    return this.executeBatch(generator);
  }

  /**
   * Execute in batch mode (non-streaming)
   */
  private async executeBatch<T>(
    generator: () => AsyncGenerator<StreamingEvent, AgenticQueryResult<T>>
  ): Promise<AgenticQueryResult<T>> {
    console.error("⏳ Processing...");
    const stream = generator();
    let result = await stream.next();

    while (!result.done) {
      result = await stream.next();
    }

    return result.value;
  }

  /**
   * Validate environment (API key)
   */
  private validateEnvironment(config: BaseConfig): void {
    if (config.mock) {
      return;
    }

    if (
      !(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN)
    ) {
      console.error(
        "Error: ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN required"
      );
      console.error("Get your API key from: https://console.anthropic.com");
      console.error("Or use --mock flag to run without API key");
      process.exit(1);
    }
  }

  /**
   * Build execution context from config
   */
  private buildContext(config: BaseConfig): ExecutionContext {
    const shouldStream = isInteractive() && !config.noStreaming && !config.mock;

    return {
      workspace: "", // Will be set by ensureWorkspace in SessionManager
      mode: shouldStream ? "streaming" : "batch",
      mock: config.mock,
    };
  }

  /**
   * Load user profile with CLI overrides
   */
  private async loadUserProfile(config: KitConfig): Promise<UserProfile> {
    let profile: UserProfile;

    try {
      profile = (await readUserProfile(this.context.workspace)) as UserProfile;
    } catch {
      profile = {
        userId: "cli-user",
        topics: [],
        style: {
          tone: "intermediate",
          targetWordCount: 1000,
          voice: "first-person",
        },
      };
    }

    // Apply CLI overrides
    if (config.topics) {
      profile.topics = config.topics.map((t) => ({
        topic: t,
        interestLevel: 3 as const,
      }));
    }
    if (config.tone) {
      profile.style.tone = config.tone as
        | "beginner"
        | "intermediate"
        | "expert"
        | "mixed";
    }
    if (config.wordCount) {
      profile.style.targetWordCount = config.wordCount;
    }

    return profile;
  }
}

/**
 * Factory function for creating runtime
 */
export function createRuntime(config: BaseConfig): LoopliaRuntime {
  return new LoopliaRuntime(config);
}
