import {
  type UserProfile,
  type UserTopic,
  validateUserProfile,
  type WritingStyle,
} from "@looplia-core/core";
import {
  ensureWorkspace,
  getConfigPath,
  getProviderDisplayInfo,
  type ModelProviderConfig,
  maskAuthToken,
  PROVIDER_PRESETS,
  readModelProviderConfig,
  readUserProfile,
  removeModelProviderConfig,
  writeModelProviderConfig,
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
  looplia config provider set base-url https://zenmux.ai/api/anthropic
  looplia config show
`);
}

function printProviderHelp(): void {
  console.log(`
looplia config provider - Configure model provider

Usage:
  looplia config provider              Interactive setup wizard
  looplia config provider show         Display current configuration
  looplia config provider set <k> <v>  Set a configuration value
  looplia config provider enable       Enable provider configuration
  looplia config provider disable      Disable (use Anthropic defaults)
  looplia config provider reset        Remove all provider configuration
  looplia config provider preset <name>  Apply a provider preset

Available presets:
  zenmux    ZenMux API gateway (https://zenmux.ai)

Configuration keys for 'set':
  base-url      API base URL (e.g., https://zenmux.ai/api/anthropic)
  auth-token    Authentication token for the provider
  model-haiku   Model ID for haiku tier
  model-sonnet  Model ID for sonnet tier
  model-opus    Model ID for opus tier

Examples:
  looplia config provider preset zenmux
  looplia config provider set auth-token sk-ai-v1-xxx
  looplia config provider enable
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
  console.log(`✓ Topics set: ${topics.join(", ")}`);
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
  console.log("✓ Style preferences updated");
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
  const config = await readModelProviderConfig();
  const info = getProviderDisplayInfo(config);

  console.log("\nModel Provider Configuration:");
  console.log(`  Status: ${info.status}`);
  console.log(`  Provider: ${info.provider}`);

  if (info.authToken) {
    console.log(`  Auth Token: ${maskAuthToken(info.authToken)}`);
  }

  console.log("\n  Model Mappings:");
  console.log(`    haiku:  ${info.models.haiku}`);
  console.log(`    sonnet: ${info.models.sonnet}`);
  console.log(`    opus:   ${info.models.opus}`);

  console.log(`\n  Config file: ${getConfigPath()}`);
  console.log("");
}

async function setProviderValue(key: string, value: string): Promise<void> {
  if (!(key && value)) {
    console.error("Usage: looplia config provider set <key> <value>");
    console.error(
      "Valid keys: base-url, auth-token, model-haiku, model-sonnet, model-opus"
    );
    process.exit(1);
  }

  const config: ModelProviderConfig = (await readModelProviderConfig()) ?? {
    enabled: false,
  };

  switch (key) {
    case "base-url":
      config.baseUrl = value;
      break;
    case "auth-token":
      config.authToken = value;
      break;
    case "model-haiku":
      config.models = { ...config.models, haiku: value };
      break;
    case "model-sonnet":
      config.models = { ...config.models, sonnet: value };
      break;
    case "model-opus":
      config.models = { ...config.models, opus: value };
      break;
    default:
      console.error(`Unknown key: ${key}`);
      console.error(
        "Valid keys: base-url, auth-token, model-haiku, model-sonnet, model-opus"
      );
      process.exit(1);
  }

  await writeModelProviderConfig(config);

  // Mask auth token in output
  const displayValue = key === "auth-token" ? maskAuthToken(value) : value;
  console.log(`✓ Set ${key} = ${displayValue}`);
}

async function setProviderEnabled(enabled: boolean): Promise<void> {
  const config: ModelProviderConfig = (await readModelProviderConfig()) ?? {
    enabled: false,
  };

  config.enabled = enabled;
  await writeModelProviderConfig(config);

  if (enabled) {
    console.log("✓ Provider configuration enabled");
  } else {
    console.log("✓ Provider configuration disabled (using Anthropic defaults)");
  }
}

async function resetProviderConfig(): Promise<void> {
  await removeModelProviderConfig();
  console.log("✓ Provider configuration removed");
}

async function applyProviderPreset(presetName: string): Promise<void> {
  const preset = PROVIDER_PRESETS[presetName];

  if (!preset) {
    console.error(`Unknown preset: ${presetName}`);
    console.error(
      `Available presets: ${Object.keys(PROVIDER_PRESETS).join(", ")}`
    );
    process.exit(1);
  }

  const existingConfig = await readModelProviderConfig();

  const config: ModelProviderConfig = {
    enabled: true,
    baseUrl: preset.baseUrl,
    authToken: existingConfig?.authToken, // Preserve existing auth token
    models: { ...preset.models },
  };

  await writeModelProviderConfig(config);

  console.log(`✓ Applied ${preset.name} preset`);
  console.log(`  Base URL: ${preset.baseUrl}`);
  console.log("  Models:");
  console.log(`    haiku:  ${preset.models.haiku}`);
  console.log(`    sonnet: ${preset.models.sonnet}`);
  console.log(`    opus:   ${preset.models.opus}`);

  if (!config.authToken) {
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
  console.log("   looplia config provider preset zenmux");
  console.log("");
  console.log("2. Configure manually:");
  console.log("   looplia config provider set base-url <url>");
  console.log("   looplia config provider set auth-token <token>");
  console.log("   looplia config provider set model-haiku <model-id>");
  console.log("   looplia config provider enable");
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

    case "enable":
      await setProviderEnabled(true);
      break;

    case "disable":
      await setProviderEnabled(false);
      break;

    case "reset":
      await resetProviderConfig();
      break;

    case "preset":
      if (!args[1]) {
        console.error("Usage: looplia config provider preset <preset-name>");
        console.error(
          `Available presets: ${Object.keys(PROVIDER_PRESETS).join(", ")}`
        );
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
