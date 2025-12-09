import { runBootstrapCommand } from "./commands/bootstrap";
import { runConfigCommand } from "./commands/config";
import { runKitCommand } from "./commands/kit";
import { runSummarizeCommand } from "./commands/summarize";

const VERSION = "0.3.4";

function printHelp(): void {
  console.log(`
looplia - Content intelligence CLI

Usage:
  looplia <command> [options]

Commands:
  config       Manage user profile settings
  bootstrap    Initialize or refresh workspace
  kit          Build a complete writing kit
  summarize    Summarize content from a file

Options:
  --help, -h     Show this help
  --version, -v  Show version

Examples:
  looplia config topics "ai,productivity,writing"
  looplia config style --tone expert --word-count 1500
  looplia bootstrap
  looplia kit --file ./article.txt

For command-specific help:
  looplia <command> --help
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  // Show global help only if no command or help is requested without a command
  if (
    !command ||
    (args.length === 1 && (args[0] === "--help" || args[0] === "-h"))
  ) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`looplia ${VERSION}`);
    process.exit(0);
  }

  switch (command) {
    case "config":
      await runConfigCommand(rest);
      break;
    case "bootstrap":
      await runBootstrapCommand(rest);
      break;
    case "kit":
      await runKitCommand(rest);
      break;
    case "summarize":
      await runSummarizeCommand(rest);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Error:", message);
  process.exit(1);
});
