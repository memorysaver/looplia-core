import { runKitCommand } from "./commands/kit";
import { runSummarizeCommand } from "./commands/summarize";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`
looplia - Content intelligence CLI

Usage:
  looplia <command> [options]

Commands:
  summarize    Summarize content from a file
  kit          Build a complete writing kit

Options:
  --help, -h     Show this help
  --version, -v  Show version

Examples:
  looplia summarize --file ./article.txt
  looplia kit --file ./article.txt --topics "ai,startup"

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
    case "summarize":
      await runSummarizeCommand(rest);
      break;
    case "kit":
      await runKitCommand(rest);
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
