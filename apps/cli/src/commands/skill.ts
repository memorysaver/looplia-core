/**
 * Skill Command (v0.7.0)
 *
 * Manage skill installation and discovery.
 *
 * @see docs/DESIGN-0.7.0.md
 */

import type { CompiledSkill } from "@looplia-core/core";
import {
  findSkill,
  getAvailableSkills,
  getInstalledSkills,
  installSkill,
  loadCompiledRegistry,
  removeSkill,
  updateSkill,
} from "@looplia-core/provider";

function printHelp(): void {
  console.log(`
looplia skill - Manage skill installation

Usage:
  looplia skill <subcommand> [options]

Subcommands:
  add <name>        Install skill to workspace
  list              List installed/available skills
  info <name>       Show skill details
  remove <name>     Remove skill from workspace
  update <name>     Update third-party skill (git pull)

Options:
  --from <source>   Install from specific source
  --available       Show all skills from all sources
  --installed       Show only installed skills
  --help, -h        Show this help

Examples:
  looplia skill add media-reviewer
  looplia skill add custom-analyzer --from github:user/repo
  looplia skill list
  looplia skill list --available
  looplia skill info media-reviewer
  looplia skill update custom-analyzer
`);
}

function formatCategory(category: string): string {
  const colors: Record<string, string> = {
    analysis: "\x1b[36m", // cyan
    generation: "\x1b[32m", // green
    assembly: "\x1b[33m", // yellow
    validation: "\x1b[35m", // magenta
    search: "\x1b[34m", // blue
    orchestration: "\x1b[31m", // red
    utility: "\x1b[37m", // white
  };
  const color = colors[category] ?? "\x1b[37m";
  return `${color}${category}\x1b[0m`;
}

function formatSkillRow(skill: CompiledSkill): string {
  const status = skill.installed ? "\x1b[32m●\x1b[0m" : "\x1b[90m○\x1b[0m";
  const name = skill.installed ? `\x1b[1m${skill.name}\x1b[0m` : skill.name;
  const category = formatCategory(skill.category);
  const source = skill.sourceType === "builtin" ? "builtin" : skill.source;

  // Truncate description to fit
  const maxDescLen = 40;
  const desc =
    skill.description.length > maxDescLen
      ? `${skill.description.slice(0, maxDescLen - 3)}...`
      : skill.description;

  return `  ${status} ${name.padEnd(28)} ${category.padEnd(22)} ${source.padEnd(15)} ${desc}`;
}

async function skillAdd(name: string, from?: string): Promise<void> {
  if (!name) {
    console.error("Error: Skill name required");
    console.error("Usage: looplia skill add <name>");
    process.exit(1);
  }

  console.log(`Installing skill: ${name}...`);

  // Load registry and find skill (optionally filter by source)
  const registry = await loadCompiledRegistry();
  let skill: CompiledSkill | undefined;

  if (from) {
    // Filter by source when --from is specified
    skill = registry.skills.find((s) => s.name === name && s.source === from);
    if (!skill) {
      console.error(`Skill not found: ${name} from source ${from}`);
      console.error(
        'Run "looplia skill list --available" to see available skills.'
      );
      process.exit(1);
    }
    console.log(`  Source: ${from}`);
  } else {
    skill = findSkill(registry, name);
    if (!skill) {
      console.error(`Skill not found: ${name}`);
      console.error(
        'Run "looplia skill list --available" to see available skills.'
      );
      process.exit(1);
    }
  }

  const result = await installSkill(name, registry);

  switch (result.status) {
    case "installed":
      console.log(`Skill installed: ${name}`);
      console.log(`  Path: ${result.path}`);
      break;

    case "updated":
      console.log(`Skill updated: ${name}`);
      console.log(`  Path: ${result.path}`);
      break;

    case "already_installed":
      console.log(`Skill already installed: ${name}`);
      console.log(`  Path: ${result.path}`);
      break;

    case "failed":
      console.error(`Failed to install skill: ${name}`);
      console.error(`  Error: ${result.error}`);
      process.exit(1);
      break;

    default:
      console.log(`Unexpected status: ${result.status}`);
  }
}

async function skillList(options: {
  installed?: boolean;
  available?: boolean;
}): Promise<void> {
  const registry = await loadCompiledRegistry();

  let skills: CompiledSkill[];
  let title: string;

  if (options.installed) {
    skills = getInstalledSkills(registry);
    title = "Installed Skills";
  } else if (options.available) {
    skills = getAvailableSkills(registry);
    title = "Available Skills (not installed)";
  } else {
    skills = registry.skills;
    title = "All Skills";
  }

  if (skills.length === 0) {
    console.log("No skills found.");
    return;
  }

  console.log(`\n${title} (${skills.length}):`);
  console.log("─".repeat(100));
  console.log(
    "  ST NAME                         CATEGORY              SOURCE          DESCRIPTION"
  );
  console.log("─".repeat(100));

  // Sort by installed status, then by name
  const sorted = [...skills].sort((a, b) => {
    if (a.installed !== b.installed) {
      return a.installed ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  for (const skill of sorted) {
    console.log(formatSkillRow(skill));
  }

  console.log("─".repeat(100));
  console.log("\n● = installed, ○ = not installed");
  console.log("");
}

async function skillInfo(name: string): Promise<void> {
  if (!name) {
    console.error("Error: Skill name required");
    console.error("Usage: looplia skill info <name>");
    process.exit(1);
  }

  const registry = await loadCompiledRegistry();
  const skill = findSkill(registry, name);

  if (!skill) {
    console.error(`Skill not found: ${name}`);
    console.error(
      'Run "looplia skill list --available" to see available skills.'
    );
    process.exit(1);
  }

  console.log(`\nSkill: ${skill.title}`);
  console.log("═".repeat(50));
  console.log(`  Name: ${skill.name}`);
  console.log(`  Description: ${skill.description}`);
  console.log(`  Category: ${skill.category}`);
  console.log(`  Plugin: ${skill.plugin}`);
  console.log(`  Source: ${skill.source}`);
  console.log(`  Source Type: ${skill.sourceType}`);
  console.log(`  Installed: ${skill.installed ? "Yes" : "No"}`);

  if (skill.installed && skill.installedPath) {
    console.log(`  Path: ${skill.installedPath}`);
  }

  if (skill.model) {
    console.log(`  Model: ${skill.model}`);
  }

  if (skill.inputless) {
    console.log("  Input-less: Yes");
  }

  if (skill.capabilities && skill.capabilities.length > 0) {
    console.log(`  Capabilities: ${skill.capabilities.join(", ")}`);
  }

  if (skill.tools && skill.tools.length > 0) {
    console.log(`  Tools: ${skill.tools.join(", ")}`);
  }

  if (skill.dependencies && skill.dependencies.length > 0) {
    console.log(`  Dependencies: ${skill.dependencies.join(", ")}`);
  }

  if (skill.gitUrl) {
    console.log(`  Git URL: ${skill.gitUrl}`);
  }

  console.log("");
}

async function skillRemove(name: string): Promise<void> {
  if (!name) {
    console.error("Error: Skill name required");
    console.error("Usage: looplia skill remove <name>");
    process.exit(1);
  }

  console.log(`Removing skill: ${name}...`);

  const result = await removeSkill(name);

  switch (result.status) {
    case "removed":
      console.log(`Skill removed: ${name}`);
      if (result.path) {
        console.log(`  Removed directory: ${result.path}`);
      }
      break;

    case "failed":
      console.error(`Failed to remove skill: ${name}`);
      console.error(`  Error: ${result.error}`);
      process.exit(1);
      break;

    default:
      console.log(`Unexpected status: ${result.status}`);
  }
}

async function skillUpdate(name: string): Promise<void> {
  if (!name) {
    console.error("Error: Skill name required");
    console.error("Usage: looplia skill update <name>");
    process.exit(1);
  }

  console.log(`Updating skill: ${name}...`);

  const result = await updateSkill(name);

  switch (result.status) {
    case "updated":
      console.log(`Skill updated: ${name}`);
      break;

    case "failed":
      console.error(`Failed to update skill: ${name}`);
      console.error(`  Error: ${result.error}`);
      process.exit(1);
      break;

    default:
      console.log(`Unexpected status: ${result.status}`);
  }
}

export async function runSkillCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printHelp();
    process.exit(0);
  }

  // Parse options
  const hasInstalled = args.includes("--installed");
  const hasAvailable = args.includes("--available");
  const fromIndex = args.indexOf("--from");
  const from = fromIndex > -1 ? args[fromIndex + 1] : undefined;

  // Filter out options to get positional args
  const positionalArgs = args.filter(
    (arg, i) => !(arg.startsWith("--") || args[i - 1] === "--from")
  );

  switch (subcommand) {
    case "add":
      await skillAdd(positionalArgs[1] ?? "", from);
      break;

    case "list":
      await skillList({ installed: hasInstalled, available: hasAvailable });
      break;

    case "info":
      await skillInfo(positionalArgs[1] ?? "");
      break;

    case "remove":
      await skillRemove(positionalArgs[1] ?? "");
      break;

    case "update":
      await skillUpdate(positionalArgs[1] ?? "");
      break;

    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      printHelp();
      process.exit(1);
  }
}
