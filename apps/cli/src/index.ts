import { runBuildCommand } from "./commands/build";
import { runConfigCommand } from "./commands/config";
import { runInitCommand } from "./commands/init";
import { runRegistryCommand } from "./commands/registry";
import { runRunCommand } from "./commands/run";
import { runSkillCommand } from "./commands/skill";

// Version injected from package.json at build time by tsup
declare const __VERSION__: string;
const VERSION = __VERSION__;

function printHelp(): void {
  console.log(`
looplia - Content intelligence CLI (v${VERSION})

Usage:
  looplia <command> [options]

Commands:
  init         Initialize or refresh workspace
  run          Execute a workflow on content
  build        Build workflow from natural language
  config       Manage user profile settings
  registry     Manage skill registry sources (v0.7.0)
  skill        Manage skill installation (v0.7.0)

Options:
  --help, -h     Show this help
  --version, -v  Show version

Examples:
  looplia init
  looplia run writing-kit --file ./article.txt
  looplia config topics "ai,productivity,writing"
  looplia registry sync
  looplia skill list

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
    case "build":
      await runBuildCommand(rest);
      break;
    case "config":
      await runConfigCommand(rest);
      break;
    case "registry":
      await runRegistryCommand(rest);
      break;
    case "skill":
      await runSkillCommand(rest);
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
