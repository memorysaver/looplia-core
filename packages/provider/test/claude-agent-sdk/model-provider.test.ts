import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";

import {
  applyPreset,
  DEFAULT_SETTINGS,
  getConfigPath,
  getLoopliaHome,
  getSettingsDisplayInfo,
  injectLoopliaSettingsEnv,
  type LoopliaSettings,
  maskAuthToken,
  PRESETS,
  readKeychainToken,
  readLoopliaSettings,
  removeLoopliaSettings,
  writeLoopliaSettings,
} from "../../src/claude-agent-sdk/model-provider";

describe("model-provider", () => {
  describe("DEFAULT_SETTINGS", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_SETTINGS.version).toBe("1.0");
      expect(DEFAULT_SETTINGS.apiProvider.type).toBe("anthropic");
      expect(DEFAULT_SETTINGS.agents.main).toBe("claude-haiku-4-5-20251001");
      expect(DEFAULT_SETTINGS.agents.executor).toBe(
        "claude-haiku-4-5-20251001"
      );
    });

    it("should not have authToken or baseUrl in defaults", () => {
      expect(DEFAULT_SETTINGS.apiProvider.authToken).toBeUndefined();
      expect(DEFAULT_SETTINGS.apiProvider.baseUrl).toBeUndefined();
    });
  });

  describe("PRESETS", () => {
    it("should have 19 presets defined", () => {
      expect(Object.keys(PRESETS)).toHaveLength(19);
    });

    it("should have required fields for each preset", () => {
      for (const [_key, preset] of Object.entries(PRESETS)) {
        expect(preset.name).toBeDefined();
        expect(preset.apiProvider).toBeDefined();
        expect(preset.mainModel).toBeDefined();
        expect(preset.executorModel).toBeDefined();
        expect(preset.haikuModel).toBeDefined();
        expect(preset.sonnetModel).toBeDefined();
        expect(preset.opusModel).toBeDefined();
      }
    });

    it("should have all model fields set to the same value per preset", () => {
      for (const [_key, preset] of Object.entries(PRESETS)) {
        const expectedModel = preset.mainModel;
        expect(preset.executorModel).toBe(expectedModel);
        expect(preset.haikuModel).toBe(expectedModel);
        expect(preset.sonnetModel).toBe(expectedModel);
        expect(preset.opusModel).toBe(expectedModel);
      }
    });

    it("should have anthropic presets without baseUrl", () => {
      expect(PRESETS.ANTHROPIC_CLAUDE_HAIKU.apiProvider).toBe("anthropic");
      expect(PRESETS.ANTHROPIC_CLAUDE_HAIKU.baseUrl).toBeUndefined();

      expect(PRESETS.ANTHROPIC_CLAUDE_SONNET.apiProvider).toBe("anthropic");
      expect(PRESETS.ANTHROPIC_CLAUDE_SONNET.baseUrl).toBeUndefined();
    });

    it("should have zenmux presets with baseUrl", () => {
      expect(PRESETS.ZENMUX_ZAI_GLM47.apiProvider).toBe("zenmux");
      expect(PRESETS.ZENMUX_ZAI_GLM47.baseUrl).toBe(
        "https://zenmux.ai/api/anthropic"
      );
    });

    it("should have Claude Code subscription presets with subscription authTokenSource", () => {
      expect(PRESETS.CLAUDE_CODE_SUBSCRIPTION_HAIKU.authTokenSource).toBe(
        "subscription"
      );
      expect(PRESETS.CLAUDE_CODE_SUBSCRIPTION_HAIKU.apiProvider).toBe(
        "anthropic"
      );
      expect(PRESETS.CLAUDE_CODE_SUBSCRIPTION_HAIKU.mainModel).toBe(
        "claude-haiku-4-5-20251001"
      );

      expect(PRESETS.CLAUDE_CODE_SUBSCRIPTION_SONNET.authTokenSource).toBe(
        "subscription"
      );
      expect(PRESETS.CLAUDE_CODE_SUBSCRIPTION_SONNET.mainModel).toBe(
        "claude-sonnet-4-5-20250929"
      );

      expect(PRESETS.CLAUDE_CODE_SUBSCRIPTION_OPUS.authTokenSource).toBe(
        "subscription"
      );
      expect(PRESETS.CLAUDE_CODE_SUBSCRIPTION_OPUS.mainModel).toBe(
        "claude-opus-4-5-20251101"
      );
    });
  });

  describe("applyPreset", () => {
    it("should apply preset correctly", () => {
      const settings = applyPreset("ZENMUX_ZAI_GLM47");

      expect(settings.version).toBe("1.0");
      expect(settings.preset).toBe("ZENMUX_ZAI_GLM47");
      expect(settings.apiProvider.type).toBe("zenmux");
      expect(settings.apiProvider.baseUrl).toBe(
        "https://zenmux.ai/api/anthropic"
      );
      expect(settings.agents.main).toBe("z-ai/glm-4.7");
      expect(settings.agents.executor).toBe("z-ai/glm-4.7");
    });

    it("should preserve existing authToken when applying preset", () => {
      const existingSettings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
          authToken: "sk-existing-token",
        },
        agents: {
          main: "old-model",
          executor: "old-executor",
        },
      };

      const settings = applyPreset("ZENMUX_ZAI_GLM47", existingSettings);

      expect(settings.apiProvider.authToken).toBe("sk-existing-token");
      expect(settings.agents.main).toBe("z-ai/glm-4.7");
    });

    it("should throw error for unknown preset", () => {
      expect(() => applyPreset("UNKNOWN_PRESET")).toThrow(
        "Unknown preset: UNKNOWN_PRESET"
      );
    });

    it("should handle anthropic preset correctly", () => {
      const settings = applyPreset("ANTHROPIC_CLAUDE_HAIKU");

      expect(settings.apiProvider.type).toBe("anthropic");
      expect(settings.apiProvider.baseUrl).toBeUndefined();
      expect(settings.agents.main).toBe("claude-haiku-4-5-20251001");
    });

    it("should include authTokenSource for Claude Code subscription presets", () => {
      const settings = applyPreset("CLAUDE_CODE_SUBSCRIPTION_OPUS");

      expect(settings.apiProvider.type).toBe("anthropic");
      expect(settings.apiProvider.authTokenSource).toBe("subscription");
      expect(settings.agents.main).toBe("claude-opus-4-5-20251101");
    });
  });

  describe("maskAuthToken", () => {
    it("should mask long tokens (show last 4 chars)", () => {
      expect(maskAuthToken("sk-ant-1234567890abcdef")).toBe("****cdef");
      expect(maskAuthToken("very-long-api-key-12345")).toBe("****2345");
    });

    it("should return **** for short tokens (<=4 chars)", () => {
      expect(maskAuthToken("abcd")).toBe("****");
      expect(maskAuthToken("abc")).toBe("****");
      expect(maskAuthToken("ab")).toBe("****");
    });

    it("should handle empty string", () => {
      expect(maskAuthToken("")).toBe("****");
    });
  });

  describe("getSettingsDisplayInfo", () => {
    it("should return not-configured status when settings is null", () => {
      const info = getSettingsDisplayInfo(null);

      expect(info.status).toBe("not-configured");
      expect(info.provider).toBe("Anthropic (default)");
      expect(info.agents.main).toBe(DEFAULT_SETTINGS.agents.main);
      expect(info.agents.executor).toBe(DEFAULT_SETTINGS.agents.executor);
    });

    it("should return configured status with settings", () => {
      const settings: LoopliaSettings = {
        version: "1.0",
        preset: "ZENMUX_ZAI_GLM47",
        apiProvider: {
          type: "zenmux",
          baseUrl: "https://zenmux.ai/api/anthropic",
          authToken: "sk-test-token",
        },
        agents: {
          main: "z-ai/glm-4.7",
          executor: "z-ai/glm-4.7",
        },
      };

      const info = getSettingsDisplayInfo(settings);

      expect(info.status).toBe("configured");
      expect(info.preset).toBe("ZENMUX_ZAI_GLM47");
      expect(info.provider).toBe("https://zenmux.ai/api/anthropic");
      expect(info.authToken).toBe("sk-test-token");
      expect(info.agents.main).toBe("z-ai/glm-4.7");
    });

    it("should show correct provider display name for anthropic", () => {
      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
        },
        agents: {
          main: "claude-haiku-4-5-20251001",
          executor: "haiku",
        },
      };

      const info = getSettingsDisplayInfo(settings);

      expect(info.provider).toBe("Anthropic (direct)");
    });

    it("should fallback to type when no baseUrl for custom", () => {
      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "custom",
        },
        agents: {
          main: "model",
          executor: "model",
        },
      };

      const info = getSettingsDisplayInfo(settings);

      expect(info.provider).toBe("custom");
    });

    it("should include authTokenSource when using subscription auth", () => {
      const settings: LoopliaSettings = {
        version: "1.0",
        preset: "CLAUDE_CODE_SUBSCRIPTION_OPUS",
        apiProvider: {
          type: "anthropic",
          authTokenSource: "subscription",
        },
        agents: {
          main: "claude-opus-4-5-20251101",
          executor: "claude-opus-4-5-20251101",
        },
      };

      const info = getSettingsDisplayInfo(settings);

      expect(info.status).toBe("configured");
      expect(info.authTokenSource).toBe("subscription");
      expect(info.authToken).toBeUndefined();
    });
  });

  describe("injectLoopliaSettingsEnv", () => {
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      // Save original env vars
      originalEnv.ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;
      originalEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      originalEnv.ZENMUX_API_KEY = process.env.ZENMUX_API_KEY;
      originalEnv.LOOPLIA_AGENT_MODEL_MAIN =
        process.env.LOOPLIA_AGENT_MODEL_MAIN;
      originalEnv.LOOPLIA_AGENT_MODEL_EXECUTOR =
        process.env.LOOPLIA_AGENT_MODEL_EXECUTOR;
      originalEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL =
        process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
      originalEnv.ANTHROPIC_DEFAULT_SONNET_MODEL =
        process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
      originalEnv.ANTHROPIC_DEFAULT_OPUS_MODEL =
        process.env.ANTHROPIC_DEFAULT_OPUS_MODEL;

      // Clear env vars for testing
      process.env.ANTHROPIC_BASE_URL = undefined;
      process.env.ANTHROPIC_API_KEY = undefined;
      process.env.ZENMUX_API_KEY = undefined;
      process.env.LOOPLIA_AGENT_MODEL_MAIN = undefined;
      process.env.LOOPLIA_AGENT_MODEL_EXECUTOR = undefined;
      process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = undefined;
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = undefined;
      process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = undefined;
    });

    afterEach(() => {
      // Restore original env vars
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    it("should set ANTHROPIC_BASE_URL for non-anthropic providers", () => {
      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "zenmux",
          baseUrl: "https://zenmux.ai/api/anthropic",
        },
        agents: {
          main: "model",
          executor: "model",
        },
      };

      injectLoopliaSettingsEnv(settings);

      expect(process.env.ANTHROPIC_BASE_URL).toBe(
        "https://zenmux.ai/api/anthropic"
      );
    });

    it("should prioritize authToken over ZENMUX_API_KEY for ZenMux providers", () => {
      process.env.ZENMUX_API_KEY = "sk-zenmux-key";

      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "zenmux",
          baseUrl: "https://zenmux.ai/api/anthropic",
          authToken: "sk-config-token",
        },
        agents: {
          main: "model",
          executor: "model",
        },
      };

      injectLoopliaSettingsEnv(settings);

      // authToken from settings file takes priority over env var
      expect(process.env.ANTHROPIC_API_KEY).toBe("sk-config-token");
    });

    it("should use authToken when ZENMUX_API_KEY not set", () => {
      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "zenmux",
          baseUrl: "https://zenmux.ai/api/anthropic",
          authToken: "sk-config-token",
        },
        agents: {
          main: "model",
          executor: "model",
        },
      };

      injectLoopliaSettingsEnv(settings);

      expect(process.env.ANTHROPIC_API_KEY).toBe("sk-config-token");
    });

    it("should fallback to ZENMUX_API_KEY when authToken not set", () => {
      process.env.ZENMUX_API_KEY = "sk-zenmux-key";

      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "zenmux",
          baseUrl: "https://zenmux.ai/api/anthropic",
          // No authToken set
        },
        agents: {
          main: "model",
          executor: "model",
        },
      };

      injectLoopliaSettingsEnv(settings);

      // Falls back to ZENMUX_API_KEY when no authToken
      expect(process.env.ANTHROPIC_API_KEY).toBe("sk-zenmux-key");
    });

    it("should set LOOPLIA_AGENT_MODEL_* env vars", () => {
      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
        },
        agents: {
          main: "claude-haiku-4-5-20251001",
          executor: "haiku",
        },
      };

      injectLoopliaSettingsEnv(settings);

      expect(process.env.LOOPLIA_AGENT_MODEL_MAIN).toBe(
        "claude-haiku-4-5-20251001"
      );
      expect(process.env.LOOPLIA_AGENT_MODEL_EXECUTOR).toBe("haiku");
    });

    it("should NOT override existing env vars for model", () => {
      process.env.LOOPLIA_AGENT_MODEL_MAIN = "existing-main";
      process.env.LOOPLIA_AGENT_MODEL_EXECUTOR = "existing-executor";

      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
        },
        agents: {
          main: "new-main",
          executor: "new-executor",
        },
      };

      injectLoopliaSettingsEnv(settings);

      expect(process.env.LOOPLIA_AGENT_MODEL_MAIN).toBe("existing-main");
      expect(process.env.LOOPLIA_AGENT_MODEL_EXECUTOR).toBe(
        "existing-executor"
      );
    });

    it("should NOT set ANTHROPIC_BASE_URL for anthropic provider", () => {
      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
        },
        agents: {
          main: "claude-haiku-4-5-20251001",
          executor: "haiku",
        },
      };

      injectLoopliaSettingsEnv(settings);

      expect(process.env.ANTHROPIC_BASE_URL).toBeUndefined();
    });

    it("should set ANTHROPIC_DEFAULT_*_MODEL env vars from main agent model", () => {
      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
        },
        agents: {
          main: "claude-haiku-4-5-20251001",
          executor: "claude-haiku-4-5-20251001",
        },
      };

      injectLoopliaSettingsEnv(settings);

      expect(process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe(
        "claude-haiku-4-5-20251001"
      );
      expect(process.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe(
        "claude-haiku-4-5-20251001"
      );
      expect(process.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe(
        "claude-haiku-4-5-20251001"
      );
    });

    it("should NOT override existing ANTHROPIC_DEFAULT_*_MODEL env vars", () => {
      process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = "existing-haiku";
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = "existing-sonnet";
      process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = "existing-opus";

      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
        },
        agents: {
          main: "claude-haiku-4-5-20251001",
          executor: "claude-haiku-4-5-20251001",
        },
      };

      injectLoopliaSettingsEnv(settings);

      expect(process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("existing-haiku");
      expect(process.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe(
        "existing-sonnet"
      );
      expect(process.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe("existing-opus");
    });
  });

  describe("File I/O", () => {
    // Note: These tests use the actual ~/.looplia directory since
    // homedir() doesn't respect process.env.HOME in bun test runtime.
    // We backup/restore any existing settings to avoid test pollution.

    let existingSettings: LoopliaSettings | null = null;

    beforeEach(async () => {
      // Backup existing settings
      existingSettings = await readLoopliaSettings();
      // Remove settings for clean test
      await removeLoopliaSettings();
    });

    afterEach(async () => {
      // Remove test settings
      await removeLoopliaSettings();
      // Also remove corrupted backup if created
      await rm(`${getConfigPath()}.corrupted`, { force: true });
      // Restore original settings if existed
      if (existingSettings) {
        await writeLoopliaSettings(existingSettings);
      }
    });

    describe("getLoopliaHome", () => {
      it("should return path ending with .looplia", () => {
        const home = getLoopliaHome();
        expect(home.endsWith(".looplia")).toBe(true);
      });
    });

    describe("getConfigPath", () => {
      it("should return path to settings file", () => {
        const configPath = getConfigPath();
        expect(configPath.endsWith("looplia.setting.json")).toBe(true);
        expect(configPath.includes(".looplia")).toBe(true);
      });
    });

    describe("readLoopliaSettings", () => {
      it("should return null when file does not exist", async () => {
        const settings = await readLoopliaSettings();
        expect(settings).toBeNull();
      });

      it("should return parsed settings when file exists", async () => {
        const settingsData: LoopliaSettings = {
          version: "1.0",
          apiProvider: {
            type: "zenmux",
            baseUrl: "https://zenmux.ai/api/anthropic",
          },
          agents: {
            main: "z-ai/glm-4.7",
            executor: "z-ai/glm-4.7",
          },
        };

        await writeLoopliaSettings(settingsData);
        const settings = await readLoopliaSettings();

        expect(settings).not.toBeNull();
        expect(settings?.version).toBe("1.0");
        expect(settings?.apiProvider.type).toBe("zenmux");
        expect(settings?.agents.main).toBe("z-ai/glm-4.7");
      });

      it("should handle corrupted JSON gracefully", async () => {
        // Write corrupted JSON directly
        const loopliaDir = getLoopliaHome();
        await mkdir(loopliaDir, { recursive: true });
        await writeFile(getConfigPath(), "{ invalid json }", "utf-8");

        const settings = await readLoopliaSettings();

        // Should return null after backing up corrupted file
        expect(settings).toBeNull();

        // Backup file should exist
        const backupPath = `${getConfigPath()}.corrupted`;
        const backupExists = await stat(backupPath)
          .then(() => true)
          .catch(() => false);
        expect(backupExists).toBe(true);
      });
    });

    describe("writeLoopliaSettings", () => {
      it("should create directory and write valid JSON", async () => {
        const settings: LoopliaSettings = {
          version: "1.0",
          preset: "ANTHROPIC_CLAUDE_HAIKU",
          apiProvider: {
            type: "anthropic",
          },
          agents: {
            main: "claude-haiku-4-5-20251001",
            executor: "haiku",
          },
        };

        await writeLoopliaSettings(settings);

        const content = await readFile(getConfigPath(), "utf-8");
        const parsed = JSON.parse(content);

        expect(parsed.version).toBe("1.0");
        expect(parsed.preset).toBe("ANTHROPIC_CLAUDE_HAIKU");
        expect(parsed.apiProvider.type).toBe("anthropic");
      });

      it("should set chmod 600 on config file", async () => {
        const settings: LoopliaSettings = {
          version: "1.0",
          apiProvider: {
            type: "zenmux",
            authToken: "sk-secret-token",
          },
          agents: {
            main: "model",
            executor: "model",
          },
        };

        await writeLoopliaSettings(settings);

        const fileStat = await stat(getConfigPath());

        // Check file permissions (0o600 = owner read/write only)
        // biome-ignore lint/suspicious/noBitwiseOperators: intentional bitmask for file permissions
        const mode = fileStat.mode & 0o777;
        expect(mode).toBe(0o600);
      });
    });

    describe("removeLoopliaSettings", () => {
      it("should delete file if exists", async () => {
        // First create a settings file
        await writeLoopliaSettings({
          version: "1.0",
          apiProvider: { type: "anthropic" },
          agents: { main: "model", executor: "model" },
        });

        await removeLoopliaSettings();

        const exists = await stat(getConfigPath())
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(false);
      });

      it("should not throw if file does not exist", async () => {
        // Should not throw
        await expect(removeLoopliaSettings()).resolves.toBeUndefined();
      });
    });
  });

  describe("readKeychainToken", () => {
    it("should return null on non-darwin platforms", () => {
      // This test validates behavior when not on macOS
      // On non-darwin, it should return null immediately without calling execSync
      if (process.platform !== "darwin") {
        const result = readKeychainToken();
        expect(result).toBeNull();
      } else {
        // On macOS, the function will try to read the keychain
        // It will either return a token or null (if not logged in)
        const result = readKeychainToken();
        expect(result === null || typeof result === "string").toBe(true);
      }
    });

    it("should return string or null on macOS", () => {
      // On macOS, should either return valid token string or null
      // (null if Claude Code not installed or not logged in)
      const result = readKeychainToken();

      if (process.platform === "darwin") {
        // Result should be either null or a non-empty string
        if (result !== null) {
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        }
      } else {
        // Non-darwin always returns null
        expect(result).toBeNull();
      }
    });
  });

  describe("injectLoopliaSettingsEnv with subscription auth", () => {
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      // Save original env vars
      originalEnv.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      originalEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      originalEnv.ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;
      originalEnv.LOOPLIA_AGENT_MODEL_MAIN =
        process.env.LOOPLIA_AGENT_MODEL_MAIN;
      originalEnv.LOOPLIA_AGENT_MODEL_EXECUTOR =
        process.env.LOOPLIA_AGENT_MODEL_EXECUTOR;
      originalEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL =
        process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
      originalEnv.ANTHROPIC_DEFAULT_SONNET_MODEL =
        process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
      originalEnv.ANTHROPIC_DEFAULT_OPUS_MODEL =
        process.env.ANTHROPIC_DEFAULT_OPUS_MODEL;

      // Clear env vars for testing
      process.env.CLAUDE_CODE_OAUTH_TOKEN = undefined;
      process.env.ANTHROPIC_API_KEY = undefined;
      process.env.ANTHROPIC_BASE_URL = undefined;
      process.env.LOOPLIA_AGENT_MODEL_MAIN = undefined;
      process.env.LOOPLIA_AGENT_MODEL_EXECUTOR = undefined;
      process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = undefined;
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = undefined;
      process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = undefined;
    });

    afterEach(() => {
      // Restore original env vars
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    it("should use existing CLAUDE_CODE_OAUTH_TOKEN when set", () => {
      // Pre-set the OAuth token (simulating CI environment)
      process.env.CLAUDE_CODE_OAUTH_TOKEN = "sk-ant-oat01-test-token";
      process.env.ANTHROPIC_API_KEY = "sk-existing-api-key";

      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
          authTokenSource: "subscription",
        },
        agents: {
          main: "claude-opus-4-5-20251101",
          executor: "claude-opus-4-5-20251101",
        },
      };

      injectLoopliaSettingsEnv(settings);

      // OAuth token should be preserved
      expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBe(
        "sk-ant-oat01-test-token"
      );
      // API key should be cleared to force SDK to use OAuth
      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it("should clear ANTHROPIC_API_KEY when using subscription auth", () => {
      process.env.ANTHROPIC_API_KEY = "sk-should-be-cleared";
      process.env.CLAUDE_CODE_OAUTH_TOKEN = "sk-ant-oat01-oauth-token";

      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
          authTokenSource: "subscription",
        },
        agents: {
          main: "claude-haiku-4-5-20251001",
          executor: "claude-haiku-4-5-20251001",
        },
      };

      injectLoopliaSettingsEnv(settings);

      // ANTHROPIC_API_KEY must be cleared for SDK to use OAuth token
      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it("should NOT clear ANTHROPIC_API_KEY when NOT using subscription auth", () => {
      process.env.ANTHROPIC_API_KEY = "sk-should-remain";

      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
          // No authTokenSource - regular API key auth
        },
        agents: {
          main: "claude-haiku-4-5-20251001",
          executor: "claude-haiku-4-5-20251001",
        },
      };

      injectLoopliaSettingsEnv(settings);

      // API key should remain unchanged for non-subscription auth
      expect(process.env.ANTHROPIC_API_KEY).toBe("sk-should-remain");
    });

    it("should attempt keychain read when CLAUDE_CODE_OAUTH_TOKEN not set on macOS", () => {
      // This test verifies the keychain fallback path on macOS
      const settings: LoopliaSettings = {
        version: "1.0",
        apiProvider: {
          type: "anthropic",
          authTokenSource: "subscription",
        },
        agents: {
          main: "claude-opus-4-5-20251101",
          executor: "claude-opus-4-5-20251101",
        },
      };

      // Ensure no pre-existing OAuth token
      expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();

      injectLoopliaSettingsEnv(settings);

      if (process.platform === "darwin") {
        // On macOS, keychain will be attempted
        // CLAUDE_CODE_OAUTH_TOKEN may be set if logged into Claude Code
        // Either way, ANTHROPIC_API_KEY should be cleared if token found
        if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
          expect(typeof process.env.CLAUDE_CODE_OAUTH_TOKEN).toBe("string");
          expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
        }
        // If token not found, no changes (warning logged)
      } else {
        // Non-macOS: keychain not available, token not set
        expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
      }
    });

    it("should apply subscription preset correctly", () => {
      process.env.CLAUDE_CODE_OAUTH_TOKEN = "sk-ant-oat01-test";

      const settings = applyPreset("CLAUDE_CODE_SUBSCRIPTION_OPUS");
      injectLoopliaSettingsEnv(settings);

      // Verify preset was applied
      expect(settings.apiProvider.authTokenSource).toBe("subscription");
      expect(settings.agents.main).toBe("claude-opus-4-5-20251101");

      // Verify env vars
      expect(process.env.LOOPLIA_AGENT_MODEL_MAIN).toBe(
        "claude-opus-4-5-20251101"
      );
      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
    });
  });
});
