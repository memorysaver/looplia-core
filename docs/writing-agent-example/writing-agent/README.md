# Looplia Writing Agent Templates

This directory contains the agent definitions and skills for the Looplia Writing Assistant system.

## Contents

### CLAUDE.md
Provides context to all agents about Looplia's material organization and document format. This file is copied to the Looplia root folder and contains:
- Material organization structure
- Document frontmatter format
- Material location patterns
- Agent capabilities and rules

### .claude/agents/
Agent definitions that orchestrate the documentation workflow:
- **media-reporter.md** - Journalist-style documentation of media materials (MVP)
  - Analyzes content structure
  - Documents with journalistic rigor
  - Preserves original meaning
  - Future: article-writer.md, research-assistant.md

### .claude/skills/
Reusable skills that agents use to accomplish their tasks:
- **media-reviewer/** - Analyzes media content structure and ideas
  - Used by: media-reporter (analysis phase)
  - Purpose: Deep content understanding

- **content-documenter/** - Writes structured documentation
  - Used by: media-reporter (documentation phase)
  - Purpose: Transform analysis into enriched markdown
  - Future: article-writer.md, citation-formatter.md

## Installation

These templates are automatically installed to the user's iCloud Looplia folder when they first use the writing agent feature:
- `CLAUDE.md` → `~/Library/Mobile Documents/.../Looplia/CLAUDE.md`
- `.claude/agents/media-reporter.md` → `~/.../Looplia/.claude/agents/media-reporter.md`
- `.claude/skills/*` → `~/.../Looplia/.claude/skills/*/`

## MVP Phase (Current)

### Media Reporter Agent
**Purpose**: Document media materials with journalistic rigor

**Workflow**:
1. Locate material by ID
2. Gather all available sources (captions, transcripts, blog posts)
3. Use media-reviewer skill to analyze structure and ideas
4. Use content-documenter skill to write enriched markdown
5. Return documented material with preserved frontmatter

**Key Features**:
- Reads from ALL available sources (nothing skipped)
- Preserves original meaning (no interpretation)
- Includes timestamps for media references
- Documents narrative structure and flow
- Extracts key themes and important quotes
- Creates foundation for future agents

**Document Structure**:
- Overview (summary)
- Key Themes (main topics)
- Detailed Analysis (structure-following breakdown)
- Narrative Flow (how ideas progress)
- Core Ideas (key concepts)
- Important Quotes & Moments (with timestamps)
- Context & Background (foundational knowledge)
- Related Concepts (connections)

## Future Phases

### Phase 2: Additional Agents
- **Article Writer**: Write polished articles using media-reporter output
- **Research Assistant**: Answer questions using documented materials
- **Brainstormer**: Generate ideas and outlines

### Phase 2-3: Additional Skills
- **citation-formatter**: Format citations for different platforms
- **material-reader**: Generic skill for reading any material type
- **outline-generator**: Generate article outlines

## Architecture

```
Agent System:
  ├── CLAUDE.md (context for all agents)
  ├── .claude/agents/ (agent orchestrators)
  │   └── media-reporter.md (MVP)
  └── .claude/skills/ (reusable components)
      ├── media-reviewer/ (analysis)
      └── content-documenter/ (writing)

Data Flow:
  Material ID → Agent → Skills → Markdown Output
```

## Development Notes

- All templates use Markdown format with YAML frontmatter
- Agents run as Claude Code CLI subprocesses with `--headless` flag
- Output is JSONL format with progress events
- Skills are composable and reusable across agents
- Each skill is independent and can be used standalone

## Testing

To test the media-reporter agent locally:

1. Ensure Claude Code is installed and authenticated
2. Verify templates are installed to iCloud Looplia
3. Create a test material with captions/transcript
4. Run agent: `claude --headless --agent media-reporter --materials test_id`
5. Verify output markdown is well-structured

## Troubleshooting

**Agent not found**: Verify `.claude/agents/media-reporter.md` exists in Looplia folder
**CLAUDE.md not found**: Reinstall templates from Preferences
**Material not found**: Check material ID is correct, file exists in youtube-channels/podcasts/rss-feeds
**Permission errors**: Check iCloud folder is readable/writable
**Incomplete output**: Verify all source files exist and are accessible
