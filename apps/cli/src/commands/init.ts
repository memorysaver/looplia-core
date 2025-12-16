import { createInterface } from "node:readline";
import { ensureWorkspace } from "@looplia-core/provider/claude-agent-sdk";

function printInitHelp(): void {
  console.log(`
looplia init - Initialize or refresh workspace

Usage:
  looplia init [options]

Options:
  --yes, -y    Skip confirmation prompt (for automation/Docker)

Description:
  Performs a destructive refresh of the ~/.looplia/ workspace from the
  looplia-writer plugin. This will:

  1. DELETE existing ~/.looplia/ directory
  2. Copy agents, skills, and pipelines from plugins/looplia-writer/
  3. Create fresh CLAUDE.md and user-profile.json

  WARNING: This removes ALL customizations in ~/.looplia/

  Use this when:
  - Setting up looplia for the first time
  - Required workspace files are missing
  - You want to reset to plugin defaults

Examples:
  looplia init
  looplia init --yes
`);
}

function promptConfirmation(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export async function runInitCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printInitHelp();
    process.exit(0);
  }

  // Check for --yes or -y flag to skip confirmation
  const skipConfirmation = args.includes("--yes") || args.includes("-y");

  console.log(
    "WARNING: init will DELETE ~/.looplia/ and recreate it from plugin."
  );
  console.log("   All customizations will be lost.");
  console.log("");

  let confirmed = skipConfirmation;
  if (!skipConfirmation) {
    confirmed = await promptConfirmation("Continue?");
  }

  if (!confirmed) {
    console.log("Aborted.");
    return;
  }

  try {
    await ensureWorkspace({ force: true });
    console.log("Workspace initialized from looplia-writer plugin");
    console.log(
      "Fresh agents, skills, pipelines, CLAUDE.md, and user-profile.json created"
    );
    console.log("");
    console.log('Next steps: Configure your profile with "looplia config"');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error during init:", message);
    process.exit(1);
  }
}
