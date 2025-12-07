import {
  type UserProfile,
  type UserTopic,
  validateUserProfile,
  type WritingStyle,
} from "@looplia-core/core";
import {
  ensureWorkspace,
  readUserProfile,
  writeUserProfile,
} from "@looplia-core/provider/claude-agent-sdk";
import { parseFlags } from "../utils/args";

function printConfigHelp(): void {
  console.log(`
looplia config - Manage user profile settings

Usage:
  looplia config topics <topics>
  looplia config style [options]
  looplia config show

Subcommands:
  topics <topics>    Set topics of interest (comma-separated)
  style [options]    Set writing style preferences
  show              Display current user profile

Style options:
  --tone <tone>          Tone: beginner, intermediate, expert, mixed
  --word-count <count>   Target word count (100-10000)
  --voice <voice>        Voice: first-person, third-person, instructional

Examples:
  looplia config topics "AI, productivity, writing"
  looplia config style --tone expert --word-count 1500
  looplia config style --voice first-person
  looplia config show
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
    case "show":
      await showProfile();
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      printConfigHelp();
      process.exit(1);
  }
}
