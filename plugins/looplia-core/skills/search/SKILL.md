---
name: search
description: |
  This skill should be used when the user needs to search for information, find files,
  look up content online, or retrieve data without providing input files.

  Trigger phrases include:
  - "search for", "find", "look up", "research"
  - "search the web", "search online", "fetch from URL"
  - "search files", "scan codebase", "find in project", "grep for"
  - "get news from", "read hacker news", "check what's trending"

  Supports multiple search modes:
  - local: Search local filesystem using Glob, Grep, Read, Bash
  - web: Search web content using WebSearch, WebFetch
  - future: Pluggable providers (jina.ai, firecrawl, exa.ai)

  This is an input-less skill - it executes search missions autonomously.
model: claude-haiku-4-5-20251001
tools:
  - Glob
  - Grep
  - Read
  - Bash
  - WebSearch
  - WebFetch
---

# Search Skill

Execute search missions and compile structured results from various sources.

## Purpose

Provide a unified search interface that can:
1. Search local files, codebases, and directories
2. Search web content (via WebSearch/WebFetch or future provider integrations)
3. Compile results into structured JSON output

This skill operates **without user-provided input files** - it receives a search mission and executes it autonomously.

## Search Modes

### Local Mode

Search the local environment:

| Tool | Use Case |
|------|----------|
| `Glob` | Find files by pattern (e.g., `**/*.md`, `src/**/*.ts`) |
| `Grep` | Search file contents for patterns |
| `Read` | Read matched files for content extraction |
| `Bash` | Execute find, ls, or other search commands |

### Web Mode

Search web content:

| Tool | Use Case |
|------|----------|
| `WebSearch` | Search the web for topics, news, documentation |
| `WebFetch` | Fetch and extract content from URLs |

**Future Providers** (planned integration):
- `jina.ai` - AI-powered web search and extraction
- `firecrawl` - Web crawling and scraping
- `exa.ai` - Neural search engine

## Process

### Step 1: Parse Mission

Extract from the mission description:
- **Search target**: What to search for (keywords, patterns, topics)
- **Search mode**: local, web, or auto-detect
- **Scope**: Directories, file types, domains, date range
- **Compile format**: How to structure results

### Step 2: Execute Search

Based on mode:

**Local:**
```
1. Use Glob to find matching files
2. Use Grep to search content patterns
3. Use Read to extract relevant sections
4. Compile matched results
```

**Web:**
```
1. Use WebSearch to find relevant pages
2. Use WebFetch to extract content
3. Parse and filter results
4. Compile into structured format
```

### Step 3: Compile Results

Structure findings into the output schema with:
- Source attribution (file path or URL)
- Relevance scoring
- Extracted content snippets
- Metadata (date, author if available)

## Input

The skill receives a **mission description** specifying:
- What to search for
- Where to search (mode/scope)
- What to extract and compile

Example missions:
```
Search for all TODO comments in the src/ directory and compile a list with file locations.
```
```
Search Hacker News for the top 5 trending AI stories today and summarize each.
```
```
Find all TypeScript files that import from '@looplia-core/core' and list their exports.
```

## Output Schema

```json
{
  "query": "original search query/mission",
  "mode": "local | web",
  "results": [
    {
      "source": "path/to/file.ts | https://example.com/page",
      "type": "file | url",
      "title": "Optional title or filename",
      "content": "Extracted content or snippet",
      "relevance": 0.95,
      "metadata": {
        "lineNumber": 42,
        "matchContext": "surrounding context",
        "date": "2025-12-24",
        "author": "optional"
      }
    }
  ],
  "summary": "Brief summary of findings",
  "totalMatches": 15,
  "compiledAt": "2025-12-24T10:30:00Z"
}
```

## Usage in Workflows

This skill enables **input-less workflow steps**:

```yaml
steps:
  - id: find-news
    skill: search
    mission: |
      Search Hacker News for today's top 3 AI stories.
      Extract title, URL, points, and brief summary for each.
    output: outputs/news.json
```

No `input:` field required - the skill operates autonomously.

## Important Rules

1. **Always attribute sources** - Include file paths or URLs for all results
2. **Respect scope** - Only search within specified boundaries
3. **Compile, don't dump** - Structure results, don't return raw search output
4. **Handle empty results** - Return valid JSON even when no matches found
5. **Rate limit web searches** - Be mindful of API limits for web providers
