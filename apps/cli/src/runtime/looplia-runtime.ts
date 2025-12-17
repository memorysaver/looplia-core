/**
 * Looplia Runtime
 *
 * Clean Architecture: Runtime uses CommandDefinition from core
 * and AgentExecutor from provider to execute commands.
 */

import { join } from "node:path";
import type {
  AgentExecutor,
  CommandDefinition,
  CommandResult,
  ContentSummary,
  PromptContext,
  StreamingEvent,
  UserProfile,
  WritingKit,
} from "@looplia-core/core";
import {
  buildWorkflowPrompt,
  createMockSummarizer,
  createMockWritingKitProvider,
  generateValidationManifest,
  getCommand,
  parseWorkflow,
  workflowCommand,
} from "@looplia-core/core";
import {
  createClaudeAgentExecutor,
  readUserProfile,
} from "@looplia-core/provider/claude-agent-sdk";
import { renderStreamingQuery } from "../components";
import { isInteractive } from "../utils/terminal";
import { SessionManager } from "./session-manager";
import type {
  BaseConfig,
  ExecutionContext,
  KitConfig,
  SummarizeConfig,
  WorkflowConfig,
} from "./types";

/**
 * Main runtime class for CLI command execution
 *
 * Target complexity: ≤10 per method
 */
export class LoopliaRuntime {
  private readonly context: ExecutionContext;
  private readonly sessionManager: SessionManager;
  private executor: AgentExecutor;

  constructor(config: BaseConfig) {
    this.validateEnvironment(config);
    this.context = this.buildContext(config);
    this.sessionManager = new SessionManager(
      this.context.workspace,
      config.mock
    );
    this.executor = createClaudeAgentExecutor();
  }

  /**
   * Execute a command by name using the command registry
   *
   * Clean Architecture: Command definition comes from core,
   * execution is delegated to the executor.
   */
  async executeCommand<T>(
    commandName: string,
    contentId: string,
    contentTitle: string
  ): Promise<CommandResult<T>> {
    const command = getCommand<T>(commandName);
    if (!command) {
      return {
        success: false,
        error: {
          type: "not_found",
          message: `Command "${commandName}" not found`,
        },
        sessionId: "",
      };
    }

    const promptContext: PromptContext = {
      contentId,
      contentPath: `contentItem/${contentId}/content.md`,
      workspace: this.context.workspace,
    };

    const prompt = command.promptTemplate(promptContext);

    if (this.context.mode === "streaming") {
      return await this.executeStreaming<T>(
        command,
        prompt,
        contentId,
        contentTitle
      );
    }

    return await this.executeBatch<T>(command, prompt, contentId);
  }

  /**
   * Execute kit building workflow
   */
  async executeKit(config: KitConfig): Promise<CommandResult<WritingKit>> {
    const content = await this.sessionManager.prepare({
      file: config.file,
      sessionId: config.sessionId,
    });

    this.context.workspace = this.sessionManager.getWorkspace();

    // Mock mode uses non-streaming provider
    if (this.context.mock) {
      return this.executeKitMock(content, await this.loadUserProfile(config));
    }

    // Update executor workspace
    this.executor = createClaudeAgentExecutor({
      workspace: this.context.workspace,
    });

    return this.executeCommand<WritingKit>("kit", content.id, content.title);
  }

  /**
   * Execute kit in mock mode (non-streaming)
   */
  private async executeKitMock(
    content: Parameters<
      ReturnType<typeof createMockWritingKitProvider>["buildKit"]
    >[0],
    userProfile: UserProfile
  ): Promise<CommandResult<WritingKit>> {
    console.error("⏳ Processing (mock)...");
    const provider = createMockWritingKitProvider();
    const result = await provider.buildKit(content, userProfile);
    return {
      success: result.success,
      data: result.success ? result.data : undefined,
      error: result.success
        ? undefined
        : { type: "mock", message: result.error?.message ?? "Mock error" },
      sessionId: `mock-${content.id}`,
    };
  }

  /**
   * Execute summarization workflow
   */
  async executeSummarize(
    config: SummarizeConfig
  ): Promise<CommandResult<ContentSummary>> {
    const content = await this.sessionManager.prepareFromFile(config.file);

    this.context.workspace = this.sessionManager.getWorkspace();

    // Mock mode uses non-streaming provider
    if (this.context.mock) {
      return this.executeSummarizeMock(content);
    }

    // Update executor workspace
    this.executor = createClaudeAgentExecutor({
      workspace: this.context.workspace,
    });

    return this.executeCommand<ContentSummary>(
      "summarize",
      content.id,
      content.title
    );
  }

  /**
   * Execute summarize in mock mode (non-streaming)
   */
  private async executeSummarizeMock(
    content: Parameters<ReturnType<typeof createMockSummarizer>["summarize"]>[0]
  ): Promise<CommandResult<ContentSummary>> {
    console.error("⏳ Processing (mock)...");
    const provider = createMockSummarizer();
    const result = await provider.summarize(content);
    return {
      success: result.success,
      data: result.success ? result.data : undefined,
      error: result.success
        ? undefined
        : { type: "mock", message: result.error?.message ?? "Mock error" },
      sessionId: `mock-${content.id}`,
    };
  }

  /**
   * Get the session manager (for renderer access)
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Execute workflow (v0.5.1)
   *
   * Uses workflow-as-markdown pattern:
   * 1. Parse workflow definition from workflows/{id}.md
   * 2. Generate validation.json from frontmatter
   * 3. Build prompt with workflow context
   * 4. Execute workflow command
   */
  async executeWorkflow(
    config: WorkflowConfig
  ): Promise<CommandResult<unknown>> {
    if (!config.workflowId) {
      return {
        success: false,
        error: { type: "validation", message: "Workflow ID is required" },
        sessionId: "",
      };
    }

    const content = await this.sessionManager.prepare({
      file: config.file,
      sessionId: config.sessionId,
    });

    this.context.workspace = this.sessionManager.getWorkspace();

    // Mock mode for writing-kit workflow falls back to kit mock provider
    if (this.context.mock) {
      if (config.workflowId === "writing-kit") {
        const userProfile = await this.loadUserProfile(config as KitConfig);
        return this.executeKitMock(content, userProfile) as Promise<
          CommandResult<unknown>
        >;
      }
      // Other workflows not yet supported in mock mode
      return {
        success: false,
        error: {
          type: "unsupported",
          message: `Mock mode not yet supported for workflow: ${config.workflowId}`,
        },
        sessionId: content.id,
      };
    }

    // Load and parse workflow
    const workflowPath = `workflows/${config.workflowId}.md`;
    const workflowFullPath = join(this.context.workspace, workflowPath);

    let workflowContent: string;
    try {
      const { readFile } = await import("node:fs/promises");
      workflowContent = await readFile(workflowFullPath, "utf-8");
    } catch {
      return {
        success: false,
        error: {
          type: "not_found",
          message: `Workflow not found: ${workflowPath}`,
        },
        sessionId: content.id,
      };
    }

    const { definition, instructions } = parseWorkflow(workflowContent);

    // Generate validation.json
    const validationManifest = generateValidationManifest(definition);
    const validationPath = join(
      this.context.workspace,
      `contentItem/${content.id}/validation.json`
    );

    try {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(validationPath), { recursive: true });
      await writeFile(
        validationPath,
        JSON.stringify(validationManifest, null, 2)
      );
    } catch (error) {
      return {
        success: false,
        error: {
          type: "io",
          message: `Failed to write validation.json: ${error}`,
        },
        sessionId: content.id,
      };
    }

    // Build prompt context
    const promptContext: PromptContext = {
      contentId: content.id,
      contentPath: `contentItem/${content.id}/content.md`,
      workspace: this.context.workspace,
      workflowName: config.workflowId,
      workflowPath,
      workflowDefinition: this.serializeWorkflowDefinition(definition),
      workflowInstructions: instructions,
    };

    const prompt = buildWorkflowPrompt(promptContext);

    // Update executor workspace
    this.executor = createClaudeAgentExecutor({
      workspace: this.context.workspace,
    });

    if (this.context.mode === "streaming") {
      return await this.executeStreaming<unknown>(
        workflowCommand,
        prompt,
        content.id,
        content.title
      );
    }

    return await this.executeBatch<unknown>(
      workflowCommand,
      prompt,
      content.id
    );
  }

  /**
   * Serialize workflow definition to YAML-like string for prompt
   */
  private serializeWorkflowDefinition(definition: {
    name: string;
    description: string;
    outputs: Record<string, unknown>;
  }): string {
    const lines: string[] = [];
    lines.push(`name: ${definition.name}`);
    lines.push(`description: ${definition.description}`);
    lines.push("outputs:");

    for (const [name, output] of Object.entries(definition.outputs)) {
      this.serializeOutput(lines, name, output as Record<string, unknown>);
    }

    return lines.join("\n");
  }

  /**
   * Serialize a single output definition
   */
  private serializeOutput(
    lines: string[],
    name: string,
    out: Record<string, unknown>
  ): void {
    lines.push(`  ${name}:`);
    if (out.artifact) {
      lines.push(`    artifact: ${out.artifact}`);
    }
    if (out.agent) {
      lines.push(`    agent: ${out.agent}`);
    }
    if (out.requires) {
      lines.push(`    requires: [${(out.requires as string[]).join(", ")}]`);
    }
    if (out.final) {
      lines.push("    final: true");
    }
    if (out.validate) {
      this.serializeValidate(lines, out.validate as Record<string, unknown>);
    }
  }

  /**
   * Serialize validate criteria
   */
  private serializeValidate(
    lines: string[],
    validate: Record<string, unknown>
  ): void {
    lines.push("    validate:");
    for (const [key, val] of Object.entries(validate)) {
      if (Array.isArray(val)) {
        lines.push(`      ${key}: [${val.join(", ")}]`);
      } else {
        lines.push(`      ${key}: ${val}`);
      }
    }
  }

  /**
   * Execute command with streaming UI
   */
  private async executeStreaming<T>(
    command: CommandDefinition<T>,
    prompt: string,
    contentId: string,
    contentTitle: string
  ): Promise<CommandResult<T>> {
    // DisplayConfig now lives in CLI layer (Clean Architecture)
    const { getDisplayConfig } = await import("../config/display-config");
    const displayConfig = getDisplayConfig(command.name);
    const title = displayConfig?.title ?? command.name;

    const { result, error } = await renderStreamingQuery<T>({
      title,
      subtitle: contentTitle,
      streamGenerator: () =>
        this.executor.executeStreaming(prompt, command.outputSchema, {
          workspace: this.context.workspace,
          contentId,
        }) as AsyncGenerator<
          StreamingEvent,
          { success: boolean; data?: T; error?: { message: string } }
        >,
    });

    if (error) {
      return {
        success: false,
        error: { type: "unknown", message: error.message },
        sessionId: contentId,
      };
    }

    if (result) {
      return {
        success: true,
        data: result,
        sessionId: contentId,
      };
    }

    return {
      success: false,
      error: { type: "unknown", message: "No result received" },
      sessionId: contentId,
    };
  }

  /**
   * Execute command in batch mode (non-streaming)
   */
  private async executeBatch<T>(
    command: CommandDefinition<T>,
    prompt: string,
    contentId: string
  ): Promise<CommandResult<T>> {
    console.error("⏳ Processing...");
    return await this.executor.execute(prompt, command.outputSchema, {
      workspace: this.context.workspace,
      contentId,
    });
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
      workspace: "",
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
