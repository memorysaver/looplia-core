---
name: plugin-registry-scanner
description: |
  Looplia core skill for discovering available skills from installed plugins.
  Use when building looplia workflows, matching capabilities, or listing available skills.
  Triggered by /build command or when user asks about available looplia skills.
  Skills-first: scans skills only, no agent discovery.
tools: Bash, Read, Glob
model: haiku
---

# Plugin Registry Scanner

Discover and catalog all skills from installed looplia plugins.

## Purpose

Scan the `plugins/*/skills/*/SKILL.md` directory structure to build a registry of available skills with their capabilities.

## Process

### 1. Scan Plugin Directories

```bash
bun plugins/looplia-core/skills/plugin-registry-scanner/scripts/scan-plugins.ts
```

This deterministic script returns a JSON registry of all discovered skills.

### 2. Parse the Registry

The script output contains:

```json
{
  "plugins": [
    {
      "name": "looplia-writer",
      "path": "plugins/looplia-writer",
      "skills": [
        {
          "name": "media-reviewer",
          "description": "Deep content analysis (structure, themes, narrative)",
          "tools": ["Read", "Grep", "Glob"],
          "model": "haiku",
          "capabilities": ["content analysis", "theme extraction", "quote identification"]
        }
      ]
    }
  ],
  "summary": {
    "totalPlugins": 2,
    "totalSkills": 7
  }
}
```

### 3. Infer Capabilities (Optional LLM Step)

If capability inference is needed beyond what the script provides, analyze skill descriptions to extract:
- Input types handled (video, audio, text, etc.)
- Processing capabilities (analyze, transform, generate, etc.)
- Output formats (JSON, markdown, structured data)

## Output Schema

```json
{
  "plugins": [
    {
      "name": "string",
      "path": "string",
      "skills": [
        {
          "name": "string",
          "description": "string",
          "tools": ["string"],
          "model": "string",
          "capabilities": ["string"]
        }
      ]
    }
  ],
  "summary": {
    "totalPlugins": "number",
    "totalSkills": "number"
  }
}
```

## Usage

This skill is typically invoked as the first step in workflow building:

1. Scan available plugins and skills
2. Pass registry to skill-capability-matcher
3. Use matched skills in workflow-schema-composer

## Notes

- The scan script is deterministic (no LLM tokens)
- Capabilities can be inferred from descriptions if not explicitly declared
- Skills without SKILL.md files are skipped
- Invalid frontmatter generates warnings but doesn't halt scanning
