/**
 * Registry Command (v0.7.0)
 *
 * Manage skill registry sources and synchronization.
 *
 * @see docs/DESIGN-0.7.0.md
 */

import {
  addSource,
  compileRegistry,
  getRegistryPath,
  initializeRegistry,
  loadCompiledRegistry,
  loadSources,
  removeSource,
} from "@looplia-core/provider";

// Top-level regex patterns for URL normalization
const PROTOCOL_REGEX = /^https?:\/\//;
const TRAILING_SLASH_REGEX = /\/$/;

function printHelp(): void {
  console.log(`
looplia registry - Manage skill registry sources

Usage:
  looplia registry <subcommand> [options]

Subcommands:
  init              Initialize local registry with official source
  add <url>         Add GitHub registry source (auto-detects format)
  sync              Compile from all sources (auto-runs on build)
  list              List configured sources and stats
  remove <id>       Remove a registry source

Options:
  --force, -f       Force reinitialization (for init)
  --help, -h        Show this help

Examples:
  looplia registry init
  looplia registry add github.com/anthropics/skills
  looplia registry sync
  looplia registry list
  looplia registry remove github:anthropics/skills
`);
}

async function registryInit(force: boolean): Promise<void> {
  console.log("Initializing skill registry...");

  await initializeRegistry(force);

  console.log(`Registry initialized at ${getRegistryPath()}`);
  console.log("Running initial sync...");

  const registry = await compileRegistry();

  console.log(
    `Synced ${registry.summary.totalSkills} skills from ${registry.sources.length} source(s)`
  );
}

async function registryAdd(url: string): Promise<void> {
  if (!url) {
    console.error("Error: URL required");
    console.error("Usage: looplia registry add <url>");
    console.error("Example: looplia registry add github.com/anthropics/skills");
    process.exit(1);
  }

  // Normalize URL
  const normalizedUrl = url
    .replace(PROTOCOL_REGEX, "")
    .replace(TRAILING_SLASH_REGEX, "");

  console.log(`Adding registry source: ${normalizedUrl}`);

  try {
    const source = await addSource(normalizedUrl);
    console.log(`Added source: ${source.id}`);
    console.log("Running sync to fetch skills (auto-detecting format)...");

    const registry = await compileRegistry();
    console.log(
      `Synced ${registry.summary.totalSkills} skills from ${registry.sources.length} source(s)`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

async function registrySync(): Promise<void> {
  console.log("Syncing registry from all sources...");

  const registry = await compileRegistry();

  console.log("\nRegistry compiled successfully!");
  console.log(`  Total skills: ${registry.summary.totalSkills}`);
  console.log(`  Sources: ${registry.sources.length}`);
  console.log("\nBy category:");

  for (const [category, count] of Object.entries(registry.summary.byCategory)) {
    if (count > 0) {
      console.log(`  ${category}: ${count}`);
    }
  }

  console.log("\nBy source:");
  for (const [source, count] of Object.entries(registry.summary.bySource)) {
    console.log(`  ${source}: ${count}`);
  }
}

async function registryList(): Promise<void> {
  const sources = await loadSources();

  if (sources.length === 0) {
    console.log("No registry sources configured.");
    console.log('Run "looplia registry init" to set up the official registry.');
    return;
  }

  console.log("\nConfigured Registry Sources:");
  console.log("─".repeat(60));

  for (const source of sources) {
    const status = source.enabled ? "enabled" : "disabled";
    console.log(`\n  ID: ${source.id}`);
    console.log(`  Type: ${source.type}`);
    console.log(`  URL: ${source.url}`);
    console.log(`  Status: ${status}`);
    console.log(`  Priority: ${source.priority}`);
  }

  // Try to load compiled registry for stats
  try {
    const registry = await loadCompiledRegistry();
    console.log(`\n${"─".repeat(60)}`);
    console.log("\nRegistry Summary:");
    console.log(`  Total skills: ${registry.summary.totalSkills}`);
    console.log(`  Last compiled: ${registry.compiledAt}`);
  } catch {
    console.log(
      "\nNo compiled registry found. Run 'looplia registry sync' to compile."
    );
  }

  console.log("");
}

async function registryRemove(sourceId: string): Promise<void> {
  if (!sourceId) {
    console.error("Error: Source ID required");
    console.error("Usage: looplia registry remove <id>");
    console.error('Run "looplia registry list" to see available sources.');
    process.exit(1);
  }

  const removed = await removeSource(sourceId);

  if (!removed) {
    console.error(`Source not found: ${sourceId}`);
    console.error('Run "looplia registry list" to see available sources.');
    process.exit(1);
  }

  console.log(`Removed source: ${sourceId}`);
  console.log("Running sync to update registry...");

  const registry = await compileRegistry();
  console.log(
    `Registry now has ${registry.summary.totalSkills} skills from ${registry.sources.length} source(s)`
  );
}

export async function runRegistryCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const hasForce = args.includes("--force") || args.includes("-f");

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printHelp();
    process.exit(0);
  }

  switch (subcommand) {
    case "init":
      await registryInit(hasForce);
      break;

    case "add":
      await registryAdd(args[1] ?? "");
      break;

    case "sync":
      await registrySync();
      break;

    case "list":
      await registryList();
      break;

    case "remove":
      await registryRemove(args[1] ?? "");
      break;

    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      printHelp();
      process.exit(1);
  }
}
