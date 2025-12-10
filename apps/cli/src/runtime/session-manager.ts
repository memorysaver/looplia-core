/**
 * Session Manager
 *
 * Handles content preparation from file or existing session.
 * Returns ContentItem for provider API consumption.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ContentItem, validateContentItem } from "@looplia-core/core";
import {
  ensureWorkspace,
  writeContentItem,
} from "@looplia-core/provider/claude-agent-sdk";
import { createContentItemFromFile, readContentFile } from "../utils/file";

/** Regex for parsing content.md frontmatter */
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const TITLE_REGEX = /title:\s*"?([^"\n]+)"?/;

/**
 * Error thrown when session is not found
 */
export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(
      `Session "${sessionId}" not found. Use --file to create a new session.`
    );
    this.name = "SessionNotFoundError";
  }
}

/**
 * Error thrown when content validation fails
 */
export class ContentValidationError extends Error {
  constructor(message: string) {
    super(`Content validation failed: ${message}`);
    this.name = "ContentValidationError";
  }
}

/**
 * Session preparation options
 */
export type SessionPrepareOptions = {
  file?: string;
  sessionId?: string;
};

/**
 * Manages content session preparation
 *
 * Handles both new sessions (from file) and existing sessions (by ID).
 * Returns ContentItem for provider API consumption.
 */
export class SessionManager {
  private workspace: string;
  private readonly mock: boolean;

  constructor(workspace: string, mock = false) {
    this.workspace = workspace;
    this.mock = mock;
  }

  /**
   * Prepare ContentItem from file or session-id
   *
   * @param config - Either file path or session ID
   * @returns ContentItem for provider API
   */
  async prepare(config: SessionPrepareOptions): Promise<ContentItem> {
    this.workspace = await ensureWorkspace({
      skipPluginBootstrap: this.mock,
    });

    if (config.file) {
      return this.createNewSession(config.file);
    }

    if (config.sessionId) {
      return this.loadExistingSession(config.sessionId);
    }

    throw new Error("Either file or sessionId is required");
  }

  /**
   * Prepare ContentItem from file (for summarize command)
   */
  async prepareFromFile(filePath: string): Promise<ContentItem> {
    this.workspace = await ensureWorkspace({
      skipPluginBootstrap: this.mock,
    });
    return this.createNewSession(filePath);
  }

  /**
   * Get current workspace path
   */
  getWorkspace(): string {
    return this.workspace;
  }

  /**
   * Create a new session from file, return validated ContentItem
   */
  private async createNewSession(filePath: string): Promise<ContentItem> {
    const rawText = readContentFile(filePath);
    const content = createContentItemFromFile(filePath, rawText);

    const validation = validateContentItem(content);
    if (!validation.success) {
      throw new ContentValidationError(validation.error.message);
    }

    const sessionId = await writeContentItem(validation.data, this.workspace);
    console.error(`✓ New session created: ${sessionId}`);

    return { ...validation.data, id: sessionId };
  }

  /**
   * Load ContentItem from existing session
   *
   * Reconstructs ContentItem from content.md frontmatter
   */
  private loadExistingSession(sessionId: string): ContentItem {
    const contentPath = join(
      this.workspace,
      "contentItem",
      sessionId,
      "content.md"
    );

    if (!existsSync(contentPath)) {
      throw new SessionNotFoundError(sessionId);
    }

    const contentMd = readFileSync(contentPath, "utf-8");
    const frontmatterMatch = contentMd.match(FRONTMATTER_REGEX);

    let title = "Untitled";
    let rawText = contentMd;

    if (frontmatterMatch?.[1] && frontmatterMatch[2]) {
      const frontmatter = frontmatterMatch[1];
      rawText = frontmatterMatch[2].trim();

      const titleMatch = frontmatter.match(TITLE_REGEX);
      if (titleMatch?.[1]) {
        title = titleMatch[1].trim();
      }
    }

    console.error(`✓ Resuming session: ${sessionId}`);

    return {
      id: sessionId,
      title,
      rawText,
      url: "",
      source: {
        id: sessionId,
        type: "custom",
        url: "",
      },
      metadata: {},
    };
  }
}
