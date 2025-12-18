# Looplia Writer Plugin

Writing domain plugin providing content analysis, idea generation, and writing-kit workflow.

## Overview

This plugin is a **domain plugin** that depends on `looplia-core` for workflow execution. It provides:

- **Writing-kit workflow** for transforming content into actionable writing materials
- **Specialized agents** for content analysis and idea generation
- **Domain skills** for media review, content documentation, and writing enhancement

## Workflow

### writing-kit

Transforms source content into a comprehensive writing kit:

```
/run writing-kit --file article.md
```

**Stages:**
1. **content-analyzer** → `summary.json` - Deep content analysis
2. **idea-generator** → `ideas.json` - Writing ideas and hooks
3. **writing-kit-builder** → `writing-kit.json` - Final assembled kit

## Agents

### content-analyzer

Deep content analysis using media-reviewer skill.

**Skills:** media-reviewer, content-documenter

**Output:** `summary.json` with:
- Content ID, headline, TLDR
- Key themes and talking points
- Important quotes (verbatim)
- Source metadata

### idea-generator

Generate writing ideas based on content analysis.

**Skills:** user-profile-reader

**Output:** `ideas.json` with:
- Content ideas with hooks and angles
- Format recommendations
- Target audience alignment

### writing-kit-builder

Assemble final writing kit from all artifacts.

**Skills:** user-profile-reader

**Output:** `writing-kit.json` with:
- Complete writing kit structure
- All previous artifacts integrated
- Ready-to-use writing materials

## Skills

| Skill | Purpose |
|-------|---------|
| media-reviewer | Analyze media content (transcripts, articles) |
| content-documenter | Generate structured documentation |
| id-generator | Create meaningful session IDs |
| user-profile-reader | Load user preferences and style |
| writing-enhancer | Enhance content quality |

## Dependencies

This plugin requires `looplia-core` which provides:
- `/run` command for workflow execution
- `workflow-executor` skill for orchestration
- `workflow-validator` skill for output validation

## Installation

```bash
looplia init
```

Both `looplia-core` and `looplia-writer` are installed together.

## File Structure

```
plugins/looplia-writer/
├── .claude-plugin/plugin.json    # Plugin manifest
├── agents/
│   ├── content-analyzer.md       # Stage 1 agent
│   ├── idea-generator.md         # Stage 2 agent
│   └── writing-kit-builder.md    # Stage 3 agent
├── skills/
│   ├── media-reviewer/SKILL.md
│   ├── content-documenter/SKILL.md
│   ├── id-generator/SKILL.md
│   ├── user-profile-reader/SKILL.md
│   └── writing-enhancer/SKILL.md
├── workflows/
│   └── writing-kit.md            # Workflow definition
└── README.md                     # This file
```
