import { runConfigCommand } from "./commands/config";
import { runInitCommand } from "./commands/init";
import { runRunCommand } from "./commands/run";

const VERSION = "0.5.0";

function printHelp(): void {
  console.log(`
looplia - Content intelligence CLI (v${VERSION})

Usage:
  looplia <command> [options]

Commands:
  init         Initialize or refresh workspace
  run          Run a pipeline to build writing kit
  config       Manage user profile settings

Options:
  --help, -h     Show this help
  --version, -v  Show version

Examples:
  looplia init
  looplia run --file ./article.txt
  looplia config topics "ai,productivity,writing"

For command-specific help:
  looplia <command> --help
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

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
    case "init":
      await runInitCommand(rest);
      break;
    case "run":
      await runRunCommand(rest);
      break;
    case "config":
      await runConfigCommand(rest);
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
