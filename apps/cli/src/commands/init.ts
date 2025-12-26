import { createInterface } from "node:readline";
import {
  copyBundledPlugins,
  downloadRemotePlugins,
  getLoopliaPluginPath,
  isLoopliaInitialized,
} from "@looplia-core/provider/bootstrap";

type InitOptions = {
  skipConfirmation: boolean;
  forceInstall: boolean;
  useRemote: boolean;
  remoteVersion: string;
};

function printInitHelp(): void {
  console.log(`
looplia init - Initialize looplia plugin at ~/.looplia

Usage:
  looplia init [options]

Options:
  --remote [version]  Download from GitHub release (default: latest)
  --force, -f         Overwrite existing installation
  --yes, -y           Skip confirmation prompt (for automation/Docker)

Description:
  Installs the looplia plugin to ~/.looplia for use with Claude Code.

  Default mode (npm bundle):
    - Copies bundled plugins from npm package to ~/.looplia
    - Merges looplia-core (infrastructure) + looplia-writer (domain)

  Remote mode (--remote):
    - Downloads plugins from GitHub release
    - Use --remote v0.6.5 for specific version

  Created structure:
    ~/.looplia/
    ├── .claude-plugin/plugin.json  Plugin manifest
    ├── commands/                   /looplia:run, /looplia:build, etc.
    ├── skills/                     Workflow executor, validators, etc.
    ├── hooks/                      Event handlers
    ├── workflows/                  Workflow definitions
    ├── sandbox/                    Execution isolation
    └── user-profile.json           User preferences

Examples:
  looplia init              # Copy from npm package
  looplia init --remote     # Download latest from GitHub
  looplia init --remote v0.6.5  # Download specific version
  looplia init --force      # Overwrite existing
`);
}

function parseInitArgs(args: string[]): InitOptions {
  const skipConfirmation = args.includes("--yes") || args.includes("-y");
  const forceInstall = args.includes("--force") || args.includes("-f");
  const remoteIndex = args.indexOf("--remote");
  const useRemote = remoteIndex !== -1;

  let remoteVersion = "latest";
  if (useRemote) {
    const nextArg = args[remoteIndex + 1];
    if (nextArg && !nextArg.startsWith("-")) {
      remoteVersion = nextArg;
    }
  }

  return { skipConfirmation, forceInstall, useRemote, remoteVersion };
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

async function confirmOverwrite(
  targetDir: string,
  skipConfirmation: boolean
): Promise<boolean> {
  console.log(`WARNING: This will DELETE ${targetDir} and recreate it.`);
  console.log("   All customizations will be lost.");
  console.log("");

  if (skipConfirmation) {
    return true;
  }

  const confirmed = await promptConfirmation("Continue?");
  if (!confirmed) {
    console.log("Aborted.");
  }
  return confirmed;
}

function printInitSuccess(targetDir: string): void {
  console.log("");
  console.log(`Looplia initialized at ${targetDir}`);
  console.log("");
  console.log("Created:");
  console.log("  - .claude-plugin/plugin.json (manifest)");
  console.log("  - commands/ (slash commands)");
  console.log("  - skills/ (workflow skills)");
  console.log("  - workflows/ (workflow definitions)");
  console.log("  - sandbox/ (execution isolation)");
  console.log("  - user-profile.json (preferences)");
  console.log("");
  console.log("Next: Run looplia from any project directory!");
  console.log('  looplia run writing-kit --file "path/to/content.md"');
}

export async function runInitCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printInitHelp();
    process.exit(0);
  }

  const options = parseInitArgs(args);
  const targetDir = getLoopliaPluginPath();
  const isInitialized = await isLoopliaInitialized();

  if (isInitialized && !options.forceInstall) {
    console.log(`Looplia is already initialized at ${targetDir}`);
    console.log("Use --force to overwrite existing installation.");
    return;
  }

  if (isInitialized) {
    const confirmed = await confirmOverwrite(
      targetDir,
      options.skipConfirmation
    );
    if (!confirmed) {
      return;
    }
  }

  try {
    if (options.useRemote) {
      console.log(
        `Downloading looplia from GitHub (${options.remoteVersion})...`
      );
      await downloadRemotePlugins(options.remoteVersion, targetDir);
    } else {
      console.log("Copying bundled looplia plugins...");
      await copyBundledPlugins(targetDir);
    }

    printInitSuccess(targetDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error during init:", message);
    process.exit(1);
  }
}
