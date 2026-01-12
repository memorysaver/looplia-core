---
name: registry-loader
description: |
  Load the skill catalog for workflow building. This skill should be used when
  discovering available looplia skills or listing what capabilities are available. Use when
  someone says "what looplia skills are installed", "list available skills", "/build",
  "what can looplia do", or "show me all looplia capabilities".

  v0.7.0: Replaces plugin-registry-scanner with skill catalog for faster access.
  Auto-syncs from all sources on every build to ensure freshest skill catalog.
tools: Read
model: haiku
---

# Registry Loader

Load the skill catalog for workflow building and skill discovery.

## Purpose

Provides fast access to the skill catalog for the build pipeline.
Uses the pre-compiled `~/.looplia/registry/skill-catalog.json` instead of runtime scanning.

## Behavior

1. Read the skill catalog from `~/.looplia/registry/skill-catalog.json`
2. If catalog doesn't exist, return empty registry with instructions to run `looplia registry sync`
3. Return catalog data for skill-capability-matcher

## Process

### 1. Load Skill Catalog

Read the skill catalog file:

```bash
cat ~/.looplia/registry/skill-catalog.json
```

Or use the Read tool to access the file directly.

### 2. Parse Catalog Data

The skill catalog contains:

```json
{
  "compiledAt": "2026-01-04T12:00:00Z",
  "version": "1.0.0",
  "sources": [
    {
      "id": "official",
      "type": "official",
      "url": "https://github.com/memorysaver/looplia-core/releases/latest/download/registry.json",
      "enabled": true,
      "priority": 100
    }
  ],
  "skills": [
    {
      "name": "media-reviewer",
      "title": "Media Reviewer",
      "description": "Deep content analysis (structure, themes, narrative)",
      "plugin": "looplia-writer",
      "category": "analysis",
      "capabilities": ["content-analysis", "media-processing"],
      "tools": ["Read", "Grep", "Glob"],
      "model": "claude-haiku-4-5-20251001",
      "source": "local",
      "sourceType": "builtin",
      "installed": true,
      "installedPath": "/home/user/.looplia/looplia-writer/skills/media-reviewer"
    }
  ],
  "summary": {
    "totalSkills": 14,
    "byCategory": {
      "analysis": 3,
      "generation": 2,
      "assembly": 2,
      "validation": 1,
      "search": 1,
      "orchestration": 3,
      "utility": 2
    },
    "bySource": {
      "local": 14
    }
  }
}
```

### 3. Format for skill-capability-matcher

Transform the skill catalog into the format expected by skill-capability-matcher:

```json
{
  "plugins": [
    {
      "name": "looplia-writer",
      "path": "~/.looplia/looplia-writer",
      "skills": [
        {
          "name": "media-reviewer",
          "description": "Deep content analysis (structure, themes, narrative)",
          "tools": ["Read", "Grep", "Glob"],
          "model": "haiku",
          "capabilities": ["content-analysis", "media-processing"],
          "installed": true
        }
      ]
    }
  ],
  "summary": {
    "totalPlugins": 2,
    "totalSkills": 14,
    "installedSkills": 14,
    "availableSkills": 0
  }
}
```

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
          "capabilities": ["string"],
          "installed": "boolean"
        }
      ]
    }
  ],
  "summary": {
    "totalPlugins": "number",
    "totalSkills": "number",
    "installedSkills": "number",
    "availableSkills": "number"
  }
}
```

## Advantages over plugin-registry-scanner

| Aspect | plugin-registry-scanner | registry-loader (v0.7.0) |
|--------|------------------------|--------------------------|
| Speed | Scans filesystem at runtime | Reads pre-compiled JSON |
| Sources | Local only | Official + third-party |
| Installation Status | Not tracked | Included in output |
| Third-party Skills | Not discovered | Included from remote registries |

## Usage

This skill is typically invoked as the first step in workflow building:

1. Load skill catalog (this skill)
2. Pass catalog to skill-capability-matcher
3. Use matched skills in workflow-schema-composer

## Notes

- If skill catalog doesn't exist, advise user to run `looplia registry sync`
- Catalog is auto-synced on every `looplia build` command
- Includes installation status for each skill
- Third-party skills may show `installed: false` until installed via `looplia skill add`
