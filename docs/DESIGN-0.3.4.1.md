# Looplia Core – Technical Design Document v0.3.4.1

**Version:** 0.3.4.1
**Status:** Proposed
**Last Updated:** 2025-12-09
**Depends On:** v0.3.3

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Architecture: Media Processor Subagent](#3-architecture-media-processor-subagent)
4. [Feature 1: --url Input Option](#4-feature-1---url-input-option)
5. [Feature 2: Media Processor Subagent](#5-feature-2-media-processor-subagent)
6. [Feature 3: yt-dlp Skill](#6-feature-3-yt-dlp-skill)
7. [Implementation Details](#7-implementation-details)
8. [File Changes](#8-file-changes)
9. [Usage Guide](#9-usage-guide)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Overview

### 1.1 Purpose

v0.3.4.1 adds **URL-based input** for automatic transcript extraction from YouTube, podcasts, and other media sources using `yt-dlp`. This extends the existing `--file` input pattern with a new `--url` option.

### 1.2 Key Features

| Feature | Description |
|---------|-------------|
| **--url Input** | New CLI option to accept YouTube/podcast URLs directly |
| **media-processor Subagent** | Autonomous subagent for downloading and extracting media transcripts |
| **yt-dlp Skill** | Skill that knows how to use yt-dlp for various extraction tasks |
| **Multi-Source Support** | Handle YouTube, podcasts, and other yt-dlp compatible sources |

### 1.3 Design Principles

Following the agentic architecture established in v0.3.1:

1. **One CLI command = One prompt** - `--url` triggers the same single-prompt pattern as `--file`
2. **Agent-controlled extraction** - The media-processor subagent decides how to handle each URL type
3. **Skill-based expertise** - yt-dlp knowledge encapsulated in a skill, not hardcoded
4. **File-based state** - Downloaded transcripts written to workspace for auditability

### 1.4 Key Changes from v0.3.3

| Aspect | v0.3.3 | v0.3.4.1 |
|--------|--------|----------|
| **Input Sources** | `--file` (local files only) | `--file` + `--url` (local + remote) |
| **Media Processing** | Manual pre-download required | Automatic yt-dlp extraction |
| **Subagents** | 3 (analyzer, ideator, builder) | 4 (+ media-processor) |
| **Skills** | 5 existing | 6 (+ yt-dlp) |

---

## 2. Problem Statement

### 2.1 Current Limitation

Users must manually download transcripts before using looplia:

```bash
# Current workflow (tedious)
yt-dlp --write-auto-sub --sub-lang en --skip-download -o "video" "https://youtube.com/watch?v=..."
looplia kit --file video.en.vtt
```

### 2.2 User Stories

1. **Content Creator**: "I want to paste a YouTube URL and get a writing kit automatically"
2. **Podcast Listener**: "I found an interesting podcast episode, I want to analyze it without manual download"
3. **Researcher**: "I have a playlist of videos, I want to process them efficiently"

### 2.3 Technical Challenges

| Challenge | Solution |
|-----------|----------|
| Multiple URL formats | yt-dlp handles 1000+ sites natively |
| Transcript availability | Fallback: auto-subs → manual subs → audio extraction |
| Large file handling | Extract subs/metadata only, skip video download |
| Error handling | Agent-controlled retry with different strategies |

---

## 3. Architecture: Media Processor Subagent

### 3.1 Updated Agent Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLI Command: looplia kit --url "https://youtube.com/watch?v=..."           │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │ ONE prompt: "Build WritingKit for URL: {url}"
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAIN AGENT (Orchestrator)                                                   │
│  Reads CLAUDE.md → Checks session state → Invokes subagents                 │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
     ┌───────────────────┼───────────────────┬───────────────────┐
     ▼                   ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ media-       │  │ content-     │  │ idea-        │  │ writing-kit- │
│ processor    │  │ analyzer     │  │ generator    │  │ builder      │
│ (NEW)        │  │              │  │              │  │              │
└──────┬───────┘  └──────────────┘  └──────────────┘  └──────────────┘
       │
       │ Uses Skill
       ▼
┌──────────────┐
│ yt-dlp       │
│ (NEW SKILL)  │
└──────────────┘
```

### 3.2 Flow for URL Input

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  --url Flow                                                                  │
│                                                                             │
│  1. CLI receives --url "https://youtube.com/watch?v=XYZ"                    │
│                                                                             │
│  2. CLI writes url-request.json to contentItem/{id}/                        │
│     {                                                                        │
│       "url": "https://youtube.com/watch?v=XYZ",                             │
│       "requestedAt": "2025-12-09T10:30:00Z",                                │
│       "status": "pending"                                                    │
│     }                                                                        │
│                                                                             │
│  3. Main Agent detects url-request.json, no content.md                      │
│     → Invokes media-processor subagent FIRST                                │
│                                                                             │
│  4. media-processor subagent:                                               │
│     a. Uses yt-dlp skill to determine best extraction method                │
│     b. Executes yt-dlp command via Bash tool                                │
│     c. Reads extracted transcript (VTT/SRT/JSON)                            │
│     d. Writes content.md with transcript + metadata                         │
│     e. Updates url-request.json with status: "completed"                    │
│                                                                             │
│  5. Main Agent continues with content-analyzer → idea-generator → etc.      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Flow Comparison: --file vs --url

| Step | --file | --url |
|------|--------|-------|
| 1. Input | Local file path | Remote URL |
| 2. CLI writes | content.md directly | url-request.json |
| 3. First subagent | content-analyzer | media-processor |
| 4. Produces | (already have content) | content.md from URL |
| 5. Continues | → ideas → outline → kit | → analyzer → ideas → outline → kit |

---

## 4. Feature 1: --url Input Option

### 4.1 CLI Interface

```bash
# New option alongside existing --file
looplia kit --url <url> [options]

# Examples
looplia kit --url "https://youtube.com/watch?v=dQw4w9WgXcQ"
looplia kit --url "https://podcasts.apple.com/podcast/episode/123"
looplia kit --url "https://youtu.be/dQw4w9WgXcQ" --topics "music,80s"
```

### 4.2 Updated Help Text

```
looplia kit - Build a complete writing kit from content

Usage:
  looplia kit --file <path> [options]        # From local file
  looplia kit --url <url> [options]          # From YouTube/podcast URL (NEW)
  looplia kit --session-id <id> [options]    # Resume session

Options:
  --file, -f         Path to content file (creates new session)
  --url, -u          YouTube/podcast URL to process (creates new session) [NEW]
  --session-id       Session ID to continue (resumes existing session)
  --format           Output format: json, markdown (default: json)
  --output, -o       Output file path (default: stdout)
  --topics           Comma-separated topics of interest
  --tone             Writing tone: beginner, intermediate, expert, mixed
  --word-count       Target word count (default: 1000)
  --mock, -m         Use mock providers (no API key required)
  --help, -h         Show this help

Note:
  - Either --file, --url, or --session-id is required
  - --file and --url always create new sessions
  - --url requires yt-dlp to be installed (see: https://github.com/yt-dlp/yt-dlp)
```

### 4.3 URL Validation

The CLI performs basic validation:

```typescript
function isValidMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // yt-dlp handles validation, we just check it's a URL
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

**Full URL validation is delegated to yt-dlp** via the agent - the skill knows which sites are supported.

---

## 5. Feature 2: Media Processor Subagent

### 5.1 Agent Definition

**File:** `plugins/looplia-writer/agents/media-processor.md`

```markdown
---
name: media-processor
description: Downloads and extracts transcripts from URLs using yt-dlp skill
model: haiku
tools: Read, Write, Bash, Skill
---

# Media Processor Agent

Extract transcripts from YouTube videos, podcasts, and other media URLs.

## Task

1. Read URL request from `contentItem/{id}/url-request.json`
2. Use **yt-dlp** skill to determine extraction strategy
3. Execute yt-dlp command to download transcript/subtitles
4. Convert extracted content to markdown format
5. Write output to: `contentItem/{id}/content.md`
6. Update url-request.json with status: "completed"

## Extraction Strategy Priority

For each URL, try these methods in order:

### 1. Subtitles (Preferred)
```bash
yt-dlp --write-auto-sub --write-sub --sub-lang en --skip-download \
       --sub-format vtt -o "transcript" "{url}"
```
Output: `transcript.en.vtt` or similar

### 2. Info JSON with Description
```bash
yt-dlp --write-info-json --skip-download -o "info" "{url}"
```
Output: `info.info.json` with title, description, chapters

### 3. Audio + Whisper (Fallback - if no subs available)
Note: This requires additional Whisper setup, skip for v0.3.4.1

## Output Format

Write `content.md` with YAML frontmatter:

```yaml
---
id: "{session-id}"
title: "{video/episode title}"
source_type: "youtube" | "podcast" | "media"
source_url: "{original url}"
extracted_at: "2025-12-09T10:30:00Z"
extraction_method: "subtitles" | "info-json" | "whisper"
duration_seconds: {if available}
channel: "{channel/podcast name if available}"
---

# {Title}

{Transcript content here...}
```

## Error Handling

If extraction fails:
1. Log error details to url-request.json
2. Try next extraction method
3. If all methods fail, update status: "failed" with error message
4. Main agent will report error to user

## Important Rules

- Always use --skip-download to avoid downloading video files
- Prefer subtitles over audio transcription (faster, more accurate)
- Include metadata in frontmatter for content-analyzer
- Clean up temporary files after extraction
- Handle both youtube.com and youtu.be formats
- Support common podcast platforms (Apple, Spotify embeds, RSS feeds)
```

### 5.2 Subagent Responsibilities

| Responsibility | Details |
|----------------|---------|
| **URL Analysis** | Determine if YouTube, podcast, or other media |
| **Strategy Selection** | Choose best extraction method via yt-dlp skill |
| **Command Execution** | Run yt-dlp with appropriate flags |
| **Content Conversion** | Convert VTT/SRT/JSON to clean markdown |
| **Metadata Extraction** | Pull title, channel, duration into frontmatter |
| **Error Recovery** | Try fallback methods if primary fails |

### 5.3 Integration with Main Agent

The main agent's CLAUDE.md instructions are updated:

```markdown
## Workflow Decision

Check the session folder for existing files:

### If url-request.json exists AND content.md does NOT exist:
→ URL needs processing first
→ Invoke **media-processor** subagent
→ Wait for content.md to be created
→ Then continue with content-analyzer

### If content.md exists (from --file OR after media-processor):
→ Continue normal workflow: content-analyzer → idea-generator → writing-kit-builder
```

---

## 6. Feature 3: yt-dlp Skill

### 6.1 Skill Definition

**File:** `plugins/looplia-writer/skills/yt-dlp/SKILL.md`

```markdown
---
name: yt-dlp
description: Expert knowledge for using yt-dlp to extract transcripts,
subtitles, and metadata from YouTube, podcasts, and 1000+ video/audio sites.
---

# yt-dlp Skill

Expert knowledge for extracting transcripts and metadata from media URLs.

## What This Skill Does

- Knows yt-dlp command syntax and options
- Selects optimal extraction strategy for each URL type
- Handles errors and suggests fallback approaches
- Understands output formats (VTT, SRT, JSON)

## Supported Platforms

yt-dlp supports 1000+ sites including:
- **YouTube**: youtube.com, youtu.be, YouTube Music, YouTube Shorts
- **Podcasts**: Apple Podcasts, Spotify (metadata), podcast RSS feeds
- **Social**: Twitter/X videos, TikTok, Instagram Reels
- **News**: CNN, BBC, NPR, various news sites
- **Educational**: Coursera, Khan Academy, TED Talks
- **Other**: Vimeo, Dailymotion, SoundCloud, and many more

## Common Commands

### Extract Subtitles (Best Quality)
```bash
# Auto-generated + manual subs, prefer VTT format
yt-dlp --write-auto-sub --write-sub --sub-lang en,en-US \
       --sub-format vtt --skip-download \
       -o "%(id)s" "{url}"
```

### Extract Info/Metadata Only
```bash
# Get title, description, chapters, duration
yt-dlp --write-info-json --skip-download \
       -o "%(id)s" "{url}"
```

### List Available Subtitles
```bash
# Check what subtitle options exist
yt-dlp --list-subs "{url}"
```

### Extract Audio (for Whisper transcription)
```bash
# Only if subtitles unavailable
yt-dlp -x --audio-format mp3 --audio-quality 5 \
       -o "%(id)s.%(ext)s" "{url}"
```

## Output File Patterns

| Command | Output Files |
|---------|--------------|
| --write-auto-sub | `{id}.en.vtt` or `{id}.en.srt` |
| --write-info-json | `{id}.info.json` |
| -x --audio-format mp3 | `{id}.mp3` |

## Subtitle Formats

### VTT (WebVTT) - Preferred
```
WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:05.000
Hello and welcome to this video.

00:00:05.000 --> 00:00:10.000
Today we're going to talk about...
```

### SRT (SubRip)
```
1
00:00:00,000 --> 00:00:05,000
Hello and welcome to this video.

2
00:00:05,000 --> 00:00:10,000
Today we're going to talk about...
```

### Info JSON Structure
```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Video Title",
  "description": "Full video description...",
  "channel": "Channel Name",
  "duration": 212,
  "upload_date": "20091025",
  "chapters": [
    {"title": "Intro", "start_time": 0, "end_time": 30},
    {"title": "Main Content", "start_time": 30, "end_time": 180}
  ]
}
```

## Error Handling

| Error | Meaning | Solution |
|-------|---------|----------|
| "Video unavailable" | Private/deleted | Cannot extract, report to user |
| "No subtitles" | No captions available | Try info.json or audio extraction |
| "Age-restricted" | Requires login | May need cookies or skip |
| "Geo-restricted" | Region blocked | Report unavailable |

## Strategy Selection

Given a URL, choose strategy:

1. **YouTube/Video sites**: Try --write-auto-sub first, fallback to --write-info-json
2. **Podcasts**: Try --write-info-json for show notes, may need audio extraction
3. **News sites**: Usually have article text in description/info.json
4. **Unknown**: Try --list-subs to check availability, then decide

## Important Rules

- ALWAYS use --skip-download unless audio extraction needed
- ALWAYS include -o pattern for predictable output names
- Check --list-subs before assuming no captions exist
- Use --sub-lang "en,en-US,en-GB" to catch various English variants
- Clean up downloaded files after processing
- Never download video files (large, unnecessary for transcription)
```

### 6.2 Skill vs Hardcoded Logic

**Why a skill instead of hardcoded commands?**

| Approach | Pros | Cons |
|----------|------|------|
| **Hardcoded** | Predictable | Rigid, can't adapt to edge cases |
| **Skill-based** | Flexible, agent adapts | Agent must learn skill |

The skill-based approach allows:
- Agent to reason about which strategy to use
- Easy updates to extraction methods (edit markdown, not code)
- Agent can handle novel situations not anticipated in code

---

## 7. Implementation Details

### 7.1 CLI Changes

**File:** `apps/cli/src/commands/kit.ts`

```typescript
// New imports and constants
const URL_REQUEST_FILENAME = "url-request.json";

// Updated argument parsing
const filePath = getArg(parsed, "file", "f");
const urlArg = getArg(parsed, "url", "u");
const sessionId = getArg(parsed, "session-id");

// Validate mutually exclusive inputs
if ([filePath, urlArg, sessionId].filter(Boolean).length !== 1) {
  console.error("Error: Exactly one of --file, --url, or --session-id required");
  printKitHelp();
  process.exit(1);
}

// Handle --url input
if (urlArg) {
  if (!isValidMediaUrl(urlArg)) {
    console.error(`Error: Invalid URL: ${urlArg}`);
    process.exit(1);
  }

  const newSessionId = generateSessionId(urlArg);
  await writeUrlRequest(workspace, newSessionId, urlArg);
  console.error(`✓ New session created: ${newSessionId}`);
  console.error(`✓ URL queued for processing: ${urlArg}`);

  // Content will be created by media-processor subagent
  content = createPendingContentItem(newSessionId, urlArg);
}
```

### 7.2 URL Request File Format

**File:** `contentItem/{id}/url-request.json`

```json
{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "requestedAt": "2025-12-09T10:30:00.000Z",
  "status": "pending",
  "extractionMethod": null,
  "error": null,
  "completedAt": null
}
```

After successful processing:

```json
{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "requestedAt": "2025-12-09T10:30:00.000Z",
  "status": "completed",
  "extractionMethod": "subtitles",
  "extractedFiles": ["dQw4w9WgXcQ.en.vtt"],
  "error": null,
  "completedAt": "2025-12-09T10:30:15.000Z"
}
```

### 7.3 Content I/O Updates

**File:** `packages/provider/src/claude-agent-sdk/content-io.ts`

```typescript
// New function: Write URL request
export async function writeUrlRequest(
  workspace: string,
  sessionId: string,
  url: string
): Promise<void> {
  const dir = join(workspace, "contentItem", sessionId);
  await mkdir(dir, { recursive: true });

  const request = {
    url,
    requestedAt: new Date().toISOString(),
    status: "pending" as const,
    extractionMethod: null,
    error: null,
    completedAt: null,
  };

  await writeFile(
    join(dir, "url-request.json"),
    JSON.stringify(request, null, 2)
  );
}

// New function: Create pending content item
export function createPendingContentItem(
  sessionId: string,
  url: string
): ContentItem {
  return {
    id: sessionId,
    title: `Pending: ${url}`,
    rawText: "", // Will be populated by media-processor
    url,
    source: {
      id: sessionId,
      type: "url",
      url,
    },
    metadata: {
      processingStatus: "pending",
    },
  };
}
```

### 7.4 Updated CLAUDE.md Instructions

**Addition to:** `plugins/looplia-writer/README.md`

```markdown
## URL Processing (v0.3.4.1)

If the session folder contains `url-request.json` but NO `content.md`:

1. **Invoke media-processor subagent FIRST**
   - This subagent will download the transcript using yt-dlp
   - It will create content.md from the extracted transcript
   - Wait for completion before proceeding

2. **Check url-request.json status**
   - If status: "completed" → content.md should exist, continue workflow
   - If status: "failed" → Report error to user, do not continue

3. **Then continue normal workflow**
   - content-analyzer → idea-generator → writing-kit-builder
```

### 7.5 Session ID Generation for URLs

```typescript
function generateSessionId(url: string): string {
  // Extract video/episode ID if possible
  const youtubeMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    return `yt-${youtubeMatch[1]}`;
  }

  // Fallback: timestamp-based
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `url-${timestamp}`;
}
```

---

## 8. File Changes

### 8.1 New Files

| File | Purpose |
|------|---------|
| `plugins/looplia-writer/agents/media-processor.md` | Media processor subagent definition |
| `plugins/looplia-writer/skills/yt-dlp/SKILL.md` | yt-dlp expertise skill |
| `docs/DESIGN-0.3.4.1.md` | This document |

### 8.2 Modified Files

| File | Changes |
|------|---------|
| `apps/cli/src/commands/kit.ts` | Add `--url` option parsing and handling |
| `packages/provider/src/claude-agent-sdk/content-io.ts` | Add `writeUrlRequest`, `createPendingContentItem` |
| `plugins/looplia-writer/README.md` | Add URL processing workflow instructions |
| `apps/cli/src/index.ts` | Bump VERSION to "0.3.4.1" |
| `packages/*/package.json` | Bump version to 0.3.4.1 |

### 8.3 Workspace Structure Changes

```
~/.looplia/
├── CLAUDE.md
├── user-profile.json
├── .claude/
│   ├── agents/
│   │   ├── content-analyzer.md
│   │   ├── idea-generator.md
│   │   ├── writing-kit-builder.md
│   │   └── media-processor.md      # NEW
│   └── skills/
│       ├── media-reviewer/SKILL.md
│       ├── content-documenter/SKILL.md
│       ├── user-profile-reader/SKILL.md
│       ├── writing-enhancer/SKILL.md
│       ├── id-generator/SKILL.md
│       └── yt-dlp/SKILL.md          # NEW
└── contentItem/
    └── yt-dQw4w9WgXcQ/              # Example YouTube session
        ├── url-request.json          # NEW: URL processing request
        ├── content.md                # Created by media-processor
        ├── summary.json
        ├── ideas.json
        ├── outline.json
        ├── writing-kit.json
        └── logs/
            └── query-*.log
```

---

## 9. Usage Guide

### 9.1 Prerequisites

Install yt-dlp (required for --url):

```bash
# macOS
brew install yt-dlp

# Linux
pip install yt-dlp

# Windows
winget install yt-dlp
```

Verify installation:
```bash
yt-dlp --version
# Should output version like: 2024.12.06
```

### 9.2 Basic Usage

```bash
# Process YouTube video
looplia kit --url "https://youtube.com/watch?v=dQw4w9WgXcQ"

# With topic preferences
looplia kit --url "https://youtu.be/abc123" --topics "ai,technology" --tone expert

# Output to file
looplia kit --url "https://youtube.com/watch?v=xyz" -o output.json

# Markdown format
looplia kit --url "https://youtube.com/watch?v=xyz" --format markdown
```

### 9.3 Supported URL Formats

```bash
# YouTube
looplia kit --url "https://youtube.com/watch?v=dQw4w9WgXcQ"
looplia kit --url "https://youtu.be/dQw4w9WgXcQ"
looplia kit --url "https://youtube.com/shorts/abc123"

# Podcast RSS (with direct episode link)
looplia kit --url "https://podcasts.apple.com/podcast/id123/episode456"

# Other yt-dlp supported sites
looplia kit --url "https://vimeo.com/123456"
looplia kit --url "https://ted.com/talks/speaker_title"
```

### 9.4 Session Continuation

```bash
# First run (creates session, downloads transcript)
looplia kit --url "https://youtube.com/watch?v=abc123"
# Output: ✓ New session created: yt-abc123
#         ✓ URL queued for processing
#         ⏳ Building writing kit...

# Resume if interrupted
looplia kit --session-id yt-abc123
# Agent detects existing progress and continues
```

### 9.5 Debugging

```bash
# Check session folder
ls ~/.looplia/contentItem/yt-abc123/
# url-request.json  content.md  summary.json  ...

# View extraction status
cat ~/.looplia/contentItem/yt-abc123/url-request.json

# View logs
cat ~/.looplia/contentItem/yt-abc123/logs/query-*.log | tail -50
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
describe("URL Input", () => {
  it("should validate YouTube URLs", () => {
    expect(isValidMediaUrl("https://youtube.com/watch?v=abc")).toBe(true);
    expect(isValidMediaUrl("https://youtu.be/abc")).toBe(true);
    expect(isValidMediaUrl("not-a-url")).toBe(false);
  });

  it("should generate correct session IDs", () => {
    expect(generateSessionId("https://youtube.com/watch?v=dQw4w9WgXcQ"))
      .toBe("yt-dQw4w9WgXcQ");
    expect(generateSessionId("https://example.com/video"))
      .toMatch(/^url-\d{4}-\d{2}-\d{2}/);
  });

  it("should write url-request.json correctly", async () => {
    await writeUrlRequest(workspace, "test-id", "https://youtube.com/...");
    const request = JSON.parse(
      readFileSync(join(workspace, "contentItem/test-id/url-request.json"), "utf-8")
    );
    expect(request.status).toBe("pending");
    expect(request.url).toBe("https://youtube.com/...");
  });
});
```

### 10.2 Integration Tests (Mock Provider)

```bash
# Test URL flow with mock (no API key, no yt-dlp)
looplia kit --url "https://youtube.com/watch?v=test" --mock

# Should create session and return mock WritingKit
```

### 10.3 E2E Tests

```bash
# Test with real yt-dlp (CI environment)
# Requires: yt-dlp installed, ANTHROPIC_API_KEY set

# Test: YouTube video with auto-subs
looplia kit --url "https://youtube.com/watch?v=jNQXAC9IVRw" --format json > /tmp/output.json
test -f /tmp/output.json && echo "PASS" || echo "FAIL"

# Verify output structure
jq '.contentId' /tmp/output.json | grep -q "yt-jNQXAC9IVRw" && echo "PASS" || echo "FAIL"
jq '.summary.headline' /tmp/output.json | grep -q "." && echo "PASS" || echo "FAIL"
```

### 10.4 Error Cases

```bash
# Test: Invalid URL
looplia kit --url "not-a-url"
# Expected: Error: Invalid URL: not-a-url

# Test: Private video
looplia kit --url "https://youtube.com/watch?v=PRIVATE_VIDEO_ID"
# Expected: Error in url-request.json, graceful failure message

# Test: No subtitles available
# Expected: Agent tries info.json fallback, reports if all methods fail
```

### 10.5 CI Pipeline Addition

```yaml
# .github/workflows/e2e.yml - Addition
  test-url-input:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install yt-dlp
        run: pip install yt-dlp

      - name: Build
        run: bun install && bun run build

      - name: Test URL input (public video with subs)
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          bun run apps/cli/dist/index.js kit \
            --url "https://youtube.com/watch?v=jNQXAC9IVRw" \
            --format json > /tmp/url-output.json

          # Verify output
          jq -e '.summary' /tmp/url-output.json
          jq -e '.ideas' /tmp/url-output.json
```

---

## 11. Future Considerations

### 11.1 v0.3.4.2 Potential Enhancements

| Enhancement | Description |
|-------------|-------------|
| **Batch URL processing** | `--urls file.txt` with multiple URLs |
| **Playlist support** | `--url playlist_url` extracts all videos |
| **Audio transcription** | Whisper integration for non-subtitled content |
| **Caching** | Skip re-download if transcript already cached |

### 11.2 Not in Scope for v0.3.4.1

- Audio-only extraction + Whisper transcription
- Video download (always --skip-download)
- Playlist processing (single URL only)
- Cookie-based authentication for private videos

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.3.4.1 | 2025-12-09 | Initial design: --url input, media-processor subagent, yt-dlp skill |
