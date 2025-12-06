import { ensureWorkspace } from "@looplia-core/provider/claude-agent-sdk";
import * as readline from "node:readline";

function printBootstrapHelp(): void {
  console.log(`
looplia bootstrap - Initialize or refresh workspace

Usage:
  looplia bootstrap

Description:
  Performs a destructive refresh of the ~/.looplia/ workspace from the
  looplia-writer plugin. This will:

  1. DELETE existing ~/.looplia/ directory
  2. Copy agents and skills from plugins/looplia-writer/
  3. Create fresh CLAUDE.md and user-profile.json

  ⚠️  WARNING: This removes ALL customizations in ~/.looplia/

  Use this when:
  - Setting up looplia for the first time
  - Required workspace files are missing
  - You want to reset to plugin defaults

Examples:
  looplia bootstrap
`);
}

async function promptConfirmation(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export async function runBootstrapCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printBootstrapHelp();
    process.exit(0);
  }

  console.log("⚠️  Bootstrap will DELETE ~/.looplia/ and recreate it from plugin.");
  console.log("   All customizations will be lost.");
  console.log("");

  const confirmed = await promptConfirmation("Continue?");

  if (!confirmed) {
    console.log("Aborted.");
    return;
  }

  try {
    await ensureWorkspace({ force: true });
    console.log("✓ Workspace bootstrapped from looplia-writer plugin");
    console.log("✓ Fresh agents, skills, CLAUDE.md, and user-profile.json created");
    console.log("");
    console.log('Next steps: Configure your profile with "looplia config"');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error during bootstrap:", message);
    process.exit(1);
  }
}
