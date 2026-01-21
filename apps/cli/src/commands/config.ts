import {
  type UserProfile,
  type UserTopic,
  validateUserProfile,
  type WritingStyle,
} from "@looplia-core/core";
import {
  type ApiProviderType,
  applyPreset,
  DEFAULT_SETTINGS,
  ensureWorkspace,
  getConfigPath,
  getSettingsDisplayInfo,
  type LoopliaSettings,
  maskAuthToken,
  PRESETS,
  readLoopliaSettings,
  readUserProfile,
  removeLoopliaSettings,
  writeLoopliaSettings,
  writeUserProfile,
} from "@looplia-core/provider/claude-agent-sdk";
import { parseFlags } from "../utils/args";

function printConfigHelp(): void {
  console.log(`
looplia config - Manage user profile and provider settings

Usage:
  looplia config topics <topics>
  looplia config style [options]
  looplia config provider [subcommand]
  looplia config show

Subcommands:
  topics <topics>    Set topics of interest (comma-separated)
  style [options]    Set writing style preferences
  provider           Configure model provider (ZenMux, etc.)
  show              Display current user profile

Style options:
  --tone <tone>          Tone: beginner, intermediate, expert, mixed
  --word-count <count>   Target word count (100-10000)
  --voice <voice>        Voice: first-person, third-person, instructional

Examples:
  looplia config topics "AI, productivity, writing"
  looplia config style --tone expert --word-count 1500
  looplia config style --voice first-person
  looplia config provider show
  looplia config provider preset ZENMUX_ZAI_GLM47
  looplia config provider set auth-token sk-ai-v1-xxx
  looplia config show
`);
}

function printProviderHelp(): void {
  console.log(`
looplia config provider - Configure model provider

Usage:
  looplia config provider              Interactive setup wizard
  looplia config provider show         Display current configuration
  looplia config provider preset <n>   Apply a provider preset
  looplia config provider set <k> <v>  Set a configuration value
  looplia config provider reset        Remove all provider configuration

Available presets:
  ANTHROPIC_CLAUDE_HAIKU           Anthropic Claude Haiku (default)
  ANTHROPIC_CLAUDE_SONNET          Anthropic Claude Sonnet
  CLAUDE_CODE_SUBSCRIPTION_HAIKU   Claude Haiku via subscription (macOS)
  CLAUDE_CODE_SUBSCRIPTION_SONNET  Claude Sonnet via subscription (macOS)
  CLAUDE_CODE_SUBSCRIPTION_OPUS    Claude Opus via subscription (macOS)
  ZENMUX_ANTHROPIC_HAIKU45         ZenMux Claude Haiku 4.5
  ZENMUX_ZAI_GLM47                 ZenMux GLM-4.7
  ZENMUX_ZAI_GLM46VFLASH           ZenMux GLM-4.6v-Flash
  ZENMUX_MINIMAX_M21               ZenMux MiniMax-M2.1
  ZENMUX_GOOGLE_GEMINI3FLASH       ZenMux Gemini-3-Flash
  ZENMUX_GOOGLE_GEMINI3FLASH_FREE  ZenMux Gemini-3-Flash (Free)
  ZENMUX_XIAOMI_MIMOV2FLASH        ZenMux MiMo-v2-Flash
  ZENMUX_XAI_GROK41FAST            ZenMux Grok-4.1-Fast
  ZENMUX_DEEPSEEK_V32              ZenMux DeepSeek-v3.2
  ZENMUX_MISTRAL_LARGE2512         ZenMux Mistral-Large-2512
  OPENROUTER_PRESET                OpenRouter (user-configured preset)
  OLLAMA_GLM47_CLOUD               Ollama GLM-4.7 Cloud
  OLLAMA_MINIMAX_M21_CLOUD         Ollama MiniMax-M2.1 Cloud

Configuration keys for 'set':
  api-provider     Provider type: anthropic, zenmux, openrouter, ollama, custom
  base-url         API base URL (for zenmux/openrouter/ollama/custom)
  auth-token       Authentication token (fallback if env var not set)
  main-model       Model for main agent
  executor-model   Model for skill executor

API keys (set in .env - looplia auto-maps based on provider):
  ANTHROPIC_API_KEY   For Anthropic (direct)
  ZENMUX_API_KEY      For ZenMux (auto-mapped to ANTHROPIC_API_KEY)
  OPENROUTER_API_KEY  For OpenRouter (auto-mapped to ANTHROPIC_AUTH_TOKEN)
  OLLAMA_API_KEY      For Ollama (optional, defaults to "ollama")

Examples:
  looplia config provider preset ZENMUX_ZAI_GLM47
  looplia config provider preset OPENROUTER_PRESET
  looplia config provider preset OLLAMA_GLM47_CLOUD
  looplia config provider show
`);
}

async function setTopics(args: string[]): Promise<void> {
  const topicsStr = args[0];
  if (!topicsStr) {
    console.error("Error: Topics required");
    console.error("Usage: looplia config topics <topics>");
    process.exit(1);
  }

  const topics = topicsStr.split(",").map((t) => t.trim());
  const workspace = await ensureWorkspace();

  let profile: UserProfile;
  try {
    const existingProfile = (await readUserProfile(workspace)) as UserProfile;
    profile = existingProfile;
  } catch {
    // Create default profile if doesn't exist
    profile = {
      userId: "default",
      topics: [],
      style: {
        tone: "intermediate",
        targetWordCount: 1000,
        voice: "first-person",
      },
    };
  }

  // Overwrite topics array
  profile.topics = topics.map(
    (topic): UserTopic => ({
      topic,
      interestLevel: 3, // Default interest level
    })
  );

  // Validate profile
  const validation = validateUserProfile(profile);
  if (!validation.success) {
    console.error("Error: Invalid profile configuration");
    console.error(validation.error.message);
    process.exit(1);
  }

  await writeUserProfile(workspace, profile);
  console.log(`Topics set: ${topics.join(", ")}`);
}

async function setStyle(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const workspace = await ensureWorkspace();

  let profile: UserProfile;
  try {
    profile = (await readUserProfile(workspace)) as UserProfile;
  } catch {
    // Create default profile if doesn't exist
    profile = {
      userId: "default",
      topics: [],
      style: {
        tone: "intermediate",
        targetWordCount: 1000,
        voice: "first-person",
      },
    };
  }

  // Update only provided fields
  if (flags.tone) {
    profile.style.tone = flags.tone as WritingStyle["tone"];
  }
  if (flags["word-count"]) {
    profile.style.targetWordCount = Number.parseInt(flags["word-count"], 10);
  }
  if (flags.voice) {
    profile.style.voice = flags.voice as WritingStyle["voice"];
  }

  // Validate profile
  const validation = validateUserProfile(profile);
  if (!validation.success) {
    console.error("Error: Invalid style configuration");
    console.error(validation.error.message);
    process.exit(1);
  }

  await writeUserProfile(workspace, profile);
  console.log("Style preferences updated");
}

async function showProfile(): Promise<void> {
  const workspace = await ensureWorkspace();

  let profile: UserProfile;
  try {
    profile = (await readUserProfile(workspace)) as UserProfile;
  } catch {
    console.log("No user profile configured yet.");
    console.log(
      'Use "looplia config topics" and "looplia config style" to set up your profile.'
    );
    return;
  }

  // Validate profile
  const validation = validateUserProfile(profile);
  if (!validation.success) {
    console.error("Error: Invalid user-profile.json");
    console.error(validation.error.message);
    console.error("\nPlease fix the profile or run:");
    console.error("  looplia bootstrap");
    process.exit(1);
  }

  console.log("\nUser Profile:");
  console.log(`  User ID: ${profile.userId}`);
  console.log("\n  Topics:");
  if (profile.topics.length === 0) {
    console.log("    (none configured)");
  } else {
    for (const topic of profile.topics) {
      console.log(
        `    - ${topic.topic} (interest level: ${topic.interestLevel}/5)`
      );
    }
  }
  console.log("\n  Writing Style:");
  console.log(`    Tone: ${profile.style.tone}`);
  console.log(`    Target word count: ${profile.style.targetWordCount}`);
  console.log(`    Voice: ${profile.style.voice}`);
  console.log("");
}

// ============================================================================
// Provider Configuration Commands (v0.6.6)
// ============================================================================

async function showProviderConfig(): Promise<void> {
  const settings = await readLoopliaSettings();
  const info = getSettingsDisplayInfo(settings);

  console.log("\nModel Provider Configuration:");
  console.log(`  Status: ${info.status}`);
  if (info.preset) {
    console.log(`  Preset: ${info.preset}`);
  }
  console.log(`  Provider: ${info.provider}`);

  if (info.authTokenSource === "subscription") {
    console.log("  Auth Source: Claude Code Subscription (OAuth)");
  } else if (info.authToken) {
    console.log(`  Auth Token: ${maskAuthToken(info.authToken)}`);
  }

  console.log("\n  Agent Models:");
  console.log(`    Main: ${info.agents.main}`);
  console.log(`    Executor: ${info.agents.executor}`);

  console.log(`\n  Config file: ${getConfigPath()}`);
  console.log("");
}

async function setProviderValue(key: string, value: string): Promise<void> {
  if (!(key && value)) {
    console.error("Usage: looplia config provider set <key> <value>");
    console.error(
      "Valid keys: api-provider, base-url, auth-token, main-model, executor-model"
    );
    process.exit(1);
  }

  const settings: LoopliaSettings = (await readLoopliaSettings()) ?? {
    ...DEFAULT_SETTINGS,
  };

  switch (key) {
    case "api-provider":
      settings.apiProvider.type = value as ApiProviderType;
      break;
    case "base-url":
      settings.apiProvider.baseUrl = value;
      break;
    case "auth-token":
      settings.apiProvider.authToken = value;
      break;
    case "main-model":
      settings.agents.main = value;
      break;
    case "executor-model":
      settings.agents.executor = value;
      break;
    default:
      console.error(`Unknown key: ${key}`);
      console.error(
        "Valid keys: api-provider, base-url, auth-token, main-model, executor-model"
      );
      process.exit(1);
  }

  await writeLoopliaSettings(settings);

  // Mask auth token in output
  const displayValue = key === "auth-token" ? maskAuthToken(value) : value;
  console.log(`Set ${key} = ${displayValue}`);

  // Security warning for auth-token storage
  if (key === "auth-token") {
    console.log(
      "\n⚠️  Warning: API key stored in plain text at ~/.looplia/looplia.setting.json"
    );
    console.log(
      "   Prefer using ZENMUX_API_KEY or ANTHROPIC_API_KEY environment variables."
    );
  }
}

async function resetProviderConfig(): Promise<void> {
  await removeLoopliaSettings();
  console.log("Provider configuration removed");
}

async function applyProviderPreset(presetName: string): Promise<void> {
  const preset = PRESETS[presetName];

  if (!preset) {
    console.error(`Unknown preset: ${presetName}`);
    console.error(`Available presets: ${Object.keys(PRESETS).join(", ")}`);
    process.exit(1);
  }

  const existingSettings = await readLoopliaSettings();
  const settings = applyPreset(presetName, existingSettings);

  await writeLoopliaSettings(settings);

  console.log(`Applied ${preset.name} preset`);
  console.log(`  Provider: ${preset.baseUrl ?? "Anthropic (direct)"}`);
  console.log(`  Main Model: ${preset.mainModel}`);
  console.log(`  Executor Model: ${preset.executorModel}`);

  if (!settings.apiProvider.authToken) {
    console.log(
      "\nNote: Set your API key with: looplia config provider set auth-token <your-key>"
    );
  }
}

function runProviderWizard(): void {
  // Simple non-interactive wizard for now
  // Future: use inquirer or similar for interactive prompts
  console.log("\nModel Provider Setup");
  console.log("====================\n");
  console.log("Available options:\n");
  console.log("1. Apply a preset:");
  console.log("   looplia config provider preset ZENMUX_ZAI_GLM47");
  console.log("   looplia config provider preset ANTHROPIC_CLAUDE_HAIKU");
  console.log("");
  console.log("2. Configure manually:");
  console.log("   looplia config provider set api-provider zenmux");
  console.log(
    "   looplia config provider set base-url https://zenmux.ai/api/anthropic"
  );
  console.log("   looplia config provider set auth-token <token>");
  console.log("   looplia config provider set main-model z-ai/glm-4.7");
  console.log("   looplia config provider set executor-model z-ai/glm-4.7");
  console.log("");
  console.log("3. View current configuration:");
  console.log("   looplia config provider show");
  console.log("");
  console.log("For more help: looplia config provider --help");
}

async function runProviderCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (subcommand === "--help" || subcommand === "-h") {
    printProviderHelp();
    process.exit(0);
  }

  switch (subcommand) {
    case undefined:
      runProviderWizard();
      break;

    case "show":
      await showProviderConfig();
      break;

    case "set":
      if (!(args[1] && args[2])) {
        console.error("Usage: looplia config provider set <key> <value>");
        process.exit(1);
      }
      await setProviderValue(args[1], args[2]);
      break;

    case "reset":
      await resetProviderConfig();
      break;

    case "preset":
      if (!args[1]) {
        console.error("Usage: looplia config provider preset <preset-name>");
        console.error(`Available presets: ${Object.keys(PRESETS).join(", ")}`);
        process.exit(1);
      }
      await applyProviderPreset(args[1]);
      break;

    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      printProviderHelp();
      process.exit(1);
  }
}

export async function runConfigCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printConfigHelp();
    process.exit(0);
  }

  switch (subcommand) {
    case "topics":
      await setTopics(args.slice(1));
      break;
    case "style":
      await setStyle(args.slice(1));
      break;
    case "provider":
      await runProviderCommand(args.slice(1));
      break;
    case "show":
      await showProfile();
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      printConfigHelp();
      process.exit(1);
  }
}
