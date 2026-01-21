/**
 * Shared command initialization for build and run commands.
 * v0.6.10: Extracted from run.ts to ensure consistent behavior.
 *
 * @module command-init
 */

import {
  injectLoopliaSettingsEnv,
  type LoopliaSettings,
  readLoopliaSettings,
} from "./model-provider";

export type CommandInitOptions = {
  /**
   * If true, skip API key validation.
   * Used for --mock flag or offline testing.
   */
  mock?: boolean;
};

export type CommandInitResult = {
  /**
   * The loaded settings, or null if no settings file exists.
   * Can be used by commands that need access to settings.
   */
  settings: LoopliaSettings | null;
};

/**
 * Initialize command environment with settings and API key validation.
 *
 * This function ensures consistent initialization across all commands by:
 * 1. Loading settings from ~/.looplia/looplia.setting.json
 * 2. Injecting settings into environment variables (API key, base URL, models)
 * 3. Validating API key presence (after injection, so all sources are available)
 *
 * **Order is critical:** Settings must be loaded and injected BEFORE validation
 * because injectLoopliaSettingsEnv() may map ZENMUX_API_KEY to ANTHROPIC_API_KEY.
 *
 * @example
 * ```typescript
 * // In build.ts or run.ts
 * const workspace = ensureWorkspace(parsed.mock);
 * await initializeCommandEnvironment({ mock: parsed.mock });
 * // Now safe to execute - API key is validated
 * ```
 */
export async function initializeCommandEnvironment(
  options: CommandInitOptions = {}
): Promise<CommandInitResult> {
  // Step 1: Load settings from ~/.looplia/looplia.setting.json
  const settings = await readLoopliaSettings();

  // Step 2: Inject settings into environment
  // This may set ANTHROPIC_API_KEY from authToken or ZENMUX_API_KEY
  if (settings) {
    injectLoopliaSettingsEnv(settings);
  }

  // Step 3: Validate API key (unless mock mode)
  if (!options.mock) {
    validateApiKeyPresence();
  }

  return { settings };
}

/**
 * Validate that an API key is available.
 *
 * Called AFTER settings injection so all key sources are available:
 * - ANTHROPIC_API_KEY (direct or mapped from ZENMUX_API_KEY, OLLAMA_API_KEY)
 * - ANTHROPIC_AUTH_TOKEN (mapped from OPENROUTER_API_KEY)
 * - CLAUDE_CODE_OAUTH_TOKEN (OAuth flow)
 *
 * Exits with code 1 if no key is found, displaying helpful guidance.
 */
function validateApiKeyPresence(): void {
  if (
    !(
      process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_AUTH_TOKEN ||
      process.env.CLAUDE_CODE_OAUTH_TOKEN
    )
  ) {
    console.error("Error: API key required");
    console.error("");
    console.error("Options:");
    console.error("  1. Set ANTHROPIC_API_KEY environment variable");
    console.error("  2. Set ZENMUX_API_KEY with a ZenMux preset");
    console.error("  3. Set OPENROUTER_API_KEY with an OpenRouter preset");
    console.error("  4. Configure via: looplia config provider preset <name>");
    console.error("  5. Use --mock flag for testing without API");
    console.error("");
    console.error("Get your API key from: https://console.anthropic.com");
    console.error("Or use ZenMux at: https://zenmux.ai");
    console.error("Or use OpenRouter at: https://openrouter.ai");
    process.exit(1);
  }
}
