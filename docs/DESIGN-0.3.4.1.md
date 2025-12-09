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
7. [Whisper Transcription Skill](#7-whisper-transcription-skill)
8. [Implementation Details](#8-implementation-details)
9. [File Changes](#9-file-changes)
10. [Usage Guide](#10-usage-guide)
11. [Testing Strategy](#11-testing-strategy)

---

## 1. Overview

### 1.1 Purpose

v0.3.4.1 adds **URL-based input** for automatic transcript extraction from YouTube, podcasts, and other media sources using `yt-dlp`. This extends the existing `--file` input pattern with a new `--url` option.

### 1.2 Key Features

| Feature | Description |
|---------|-------------|
| **--url Input** | New CLI option to accept YouTube/podcast URLs directly |
| **media-processor Subagent** | Autonomous subagent for downloading and extracting media transcripts |
| **yt-dlp Skill** | Skill with scripts for subtitle extraction, audio download, source detection |
| **Whisper Skill** | Audio transcription via Groq API (fast) or local WhisperKit (offline) |
| **Auto-Install Tools** | Skills auto-detect and install yt-dlp, configure whisper transcription |
| **Multi-Source Support** | YouTube, podcasts, TED, Coursera, TikTok, news sites, and 1000+ more |

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
  - --url will auto-install yt-dlp if not present (requires pip, brew, or curl)
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
2. Use **yt-dlp** skill to check if yt-dlp is installed
   - If not installed, the skill will auto-install it
   - Verify installation before proceeding
3. Use **yt-dlp** skill to determine extraction strategy
4. Execute yt-dlp command to download transcript/subtitles
5. Convert extracted content to markdown format
6. Write output to: `contentItem/{id}/content.md`
7. Update url-request.json with status: "completed"

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

## 6. Feature 3: yt-dlp Skill (Script-Based Architecture)

### 6.1 Token Efficiency: Why Pre-Programmed Scripts?

**Problem:** Without scripts, the agent regenerates detection/installation logic each time (~450 tokens per operation).

**Solution:** Pre-program complex logic in TypeScript scripts. The agent invokes scripts via Bash - **only script output consumes tokens**, not the source code.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOKEN COST COMPARISON                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WITHOUT SCRIPTS (per yt-dlp operation):                                    │
│    • Agent regenerates detection logic:     ~200 tokens                     │
│    • Agent generates install commands:      ~150 tokens                     │
│    • Agent writes validation logic:         ~100 tokens                     │
│    • Total per operation:                   ~450 tokens                     │
│                                                                             │
│  WITH SCRIPTS (per yt-dlp operation):                                       │
│    • Script source code:                    0 tokens (never loaded!)        │
│    • Script output (JSON result):           ~50-100 tokens                  │
│    • Saved per operation:                   ~350 tokens                     │
│                                                                             │
│  For 20 media extractions:                  7,000 tokens saved              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Skill Folder Structure

```
plugins/looplia-writer/skills/yt-dlp/
├── SKILL.md                        # Concise instructions (~100 lines)
├── scripts/
│   ├── detect-ytdlp.ts            # Detection + auto-install script
│   ├── extract-transcript.ts       # Transcript extraction wrapper
│   └── extract-metadata.ts         # Metadata extraction wrapper
└── references/
    ├── supported-platforms.md      # Detailed platform list (loaded on demand)
    ├── format-guide.md             # VTT/SRT/JSON format details
    └── troubleshooting.md          # Common errors and solutions
```

### 6.3 SKILL.md (Concise - References Scripts)

**File:** `plugins/looplia-writer/skills/yt-dlp/SKILL.md`

```markdown
---
name: yt-dlp
description: Extract transcripts from YouTube/podcasts using pre-programmed
scripts for detection, installation, and extraction. Token-efficient design.
---

# yt-dlp Media Extraction Skill

Extract transcripts and metadata from YouTube, podcasts, and 1000+ sites.

## How This Skill Works

This skill uses **pre-programmed TypeScript scripts** to handle yt-dlp operations.
The scripts encapsulate complex logic - you just invoke them and read the JSON output.

## Step 1: Detect and Install yt-dlp

**ALWAYS run this first** before any extraction:

```bash
bun run plugins/looplia-writer/skills/yt-dlp/scripts/detect-ytdlp.ts
```

Output (JSON):
- `installed: true` → Proceed to extraction
- `installed: false` → Script auto-installs, check `installResult`

## Step 2: Extract Transcript

```bash
bun run plugins/looplia-writer/skills/yt-dlp/scripts/extract-transcript.ts "{url}" "{output_dir}"
```

Output: JSON with transcript file path and metadata.

## Step 3: Extract Metadata Only (Optional)

```bash
bun run plugins/looplia-writer/skills/yt-dlp/scripts/extract-metadata.ts "{url}" "{output_dir}"
```

Output: JSON with title, description, duration, chapters.

## Script Output Format

All scripts output JSON for easy parsing:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

## Reference Documentation

For detailed information, see:
- `references/supported-platforms.md` - Full list of 1000+ supported sites
- `references/format-guide.md` - VTT/SRT/JSON format details
- `references/troubleshooting.md` - Common errors and solutions
```

### 6.4 Script: detect-ytdlp.ts

**File:** `plugins/looplia-writer/skills/yt-dlp/scripts/detect-ytdlp.ts`

```typescript
#!/usr/bin/env bun
/**
 * yt-dlp Detection and Auto-Installation Script
 *
 * This script:
 * 1. Checks if yt-dlp is installed
 * 2. If not, detects OS and available package managers
 * 3. Auto-installs using the best available method
 * 4. Verifies installation
 *
 * Output: JSON result for agent to parse
 */

import { $ } from "bun";

interface DetectionResult {
  success: boolean;
  installed: boolean;
  version: string | null;
  path: string | null;
  wasAutoInstalled: boolean;
  installMethod: string | null;
  error: string | null;
}

async function checkInstalled(): Promise<{ installed: boolean; path: string | null; version: string | null }> {
  try {
    const whichResult = await $`which yt-dlp`.quiet();
    if (whichResult.exitCode !== 0) {
      return { installed: false, path: null, version: null };
    }

    const path = whichResult.stdout.toString().trim();
    const versionResult = await $`yt-dlp --version`.quiet();
    const version = versionResult.stdout.toString().trim();

    return { installed: true, path, version };
  } catch {
    return { installed: false, path: null, version: null };
  }
}

async function detectOS(): Promise<"darwin" | "linux" | "windows"> {
  const result = await $`uname -s`.quiet();
  const os = result.stdout.toString().trim().toLowerCase();

  if (os === "darwin") return "darwin";
  if (os.includes("mingw") || os.includes("cygwin")) return "windows";
  return "linux";
}

async function hasCommand(cmd: string): Promise<boolean> {
  try {
    const result = await $`which ${cmd}`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

async function installYtDlp(): Promise<{ success: boolean; method: string; error: string | null }> {
  const os = await detectOS();

  // Try pip first (works on all platforms)
  if (await hasCommand("pip3")) {
    try {
      await $`pip3 install --user yt-dlp`.quiet();
      return { success: true, method: "pip3", error: null };
    } catch (e) {
      console.error(`pip3 install failed: ${e}`);
      // Continue to next method
    }
  }

  if (await hasCommand("pip")) {
    try {
      await $`pip install --user yt-dlp`.quiet();
      return { success: true, method: "pip", error: null };
    } catch (e) {
      console.error(`pip install failed: ${e}`);
      // Continue to next method
    }
  }

  // Try brew on macOS
  if (os === "darwin" && await hasCommand("brew")) {
    try {
      await $`brew install yt-dlp`.quiet();
      return { success: true, method: "brew", error: null };
    } catch (e) {
      console.error(`brew install failed: ${e}`);
      // Continue to next method
    }
  }

  // Try curl binary download on Linux/macOS
  if (os !== "windows" && await hasCommand("curl")) {
    try {
      const homeDir = process.env.HOME || "~";
      const binPath = `${homeDir}/.local/bin/yt-dlp`;
      await $`mkdir -p ${homeDir}/.local/bin`.quiet();
      await $`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${binPath}`.quiet();
      await $`chmod a+rx ${binPath}`.quiet();

      // Add to PATH for current session
      process.env.PATH = `${homeDir}/.local/bin:${process.env.PATH}`;

      return { success: true, method: "curl-binary", error: null };
    } catch (e) {
      console.error(`curl binary install failed: ${e}`);
      // Continue to error
    }
  }

  return {
    success: false,
    method: "none",
    error: "No supported package manager found. Please install yt-dlp manually: https://github.com/yt-dlp/yt-dlp#installation"
  };
}

async function main(): Promise<void> {
  const result: DetectionResult = {
    success: false,
    installed: false,
    version: null,
    path: null,
    wasAutoInstalled: false,
    installMethod: null,
    error: null
  };

  // Check if already installed
  const check = await checkInstalled();

  if (check.installed) {
    result.success = true;
    result.installed = true;
    result.version = check.version;
    result.path = check.path;
    result.wasAutoInstalled = false;
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Not installed - attempt auto-install
  console.error("yt-dlp not found. Attempting auto-installation...");
  const installResult = await installYtDlp();

  if (!installResult.success) {
    result.success = false;
    result.error = installResult.error;
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  // Verify installation
  const verifyCheck = await checkInstalled();

  if (verifyCheck.installed) {
    result.success = true;
    result.installed = true;
    result.version = verifyCheck.version;
    result.path = verifyCheck.path;
    result.wasAutoInstalled = true;
    result.installMethod = installResult.method;
    console.log(JSON.stringify(result, null, 2));
  } else {
    result.success = false;
    result.error = `Installation appeared to succeed via ${installResult.method} but yt-dlp not found in PATH`;
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

main();
```

### 6.5 Script: extract-transcript.ts

**File:** `plugins/looplia-writer/skills/yt-dlp/scripts/extract-transcript.ts`

```typescript
#!/usr/bin/env bun
/**
 * yt-dlp Transcript Extraction Script
 *
 * Usage: bun run extract-transcript.ts <url> <output_dir>
 *
 * Extraction strategy:
 * 1. Try auto-generated subtitles (most common)
 * 2. Try manual subtitles
 * 3. Fall back to info.json description
 *
 * Output: JSON with file paths and metadata
 */

import { $ } from "bun";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface ExtractionResult {
  success: boolean;
  data: {
    transcriptFile: string | null;
    metadataFile: string | null;
    extractionMethod: "subtitles" | "info-json" | null;
    videoId: string | null;
    title: string | null;
    duration: number | null;
  } | null;
  error: string | null;
}

async function extractVideoId(url: string): Promise<string> {
  // Try using yt-dlp to robustly extract video ID
  try {
    const { stdout } = await $`yt-dlp --get-id ${url}`.quiet();
    const id = stdout.trim();
    if (id && id.length === 11) return id;
  } catch {
    // Fall through to fallback
  }

  // Fallback 1: YouTube URL patterns (handles youtube.com, youtu.be, m.youtube.com, live, shorts, etc.)
  const patterns = [
    /(?:v=|youtu\.be\/|embed\/|v\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/.*[?&]v=)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Fallback 2: Generate ID from URL hash
  const hash = url.split("").reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & 0xFFFFFFFF;
  }, 0);
  return `url-${Math.abs(hash).toString(36)}`;
}

async function extractSubtitles(url: string, outputDir: string, videoId: string): Promise<boolean> {
  try {
    const result = await $`yt-dlp --write-auto-sub --write-sub --sub-lang en,en-US,en-GB --sub-format vtt --skip-download -o ${join(outputDir, videoId)} -- ${url}`.nothrow();

    if (result.exitCode !== 0) {
      // yt-dlp failed to run, log error for debugging
      console.error(`yt-dlp subtitle extraction failed with exit code ${result.exitCode}`);
      if (result.stderr) {
        console.error(`Error: ${result.stderr.toString().trim()}`);
      }
      return false;
    }

    // Check if any subtitle file was created
    const files = readdirSync(outputDir);
    return files.some(f => f.includes(videoId) && (f.endsWith(".vtt") || f.endsWith(".srt")));
  } catch (err) {
    // Unexpected error (e.g., filesystem error)
    console.error(`Unexpected error during subtitle extraction: ${err}`);
    return false;
  }
}

async function extractInfoJson(url: string, outputDir: string, videoId: string): Promise<boolean> {
  try {
    await $`yt-dlp --write-info-json --skip-download -o ${join(outputDir, videoId)} ${url}`.quiet();

    const infoFile = join(outputDir, `${videoId}.info.json`);
    return existsSync(infoFile);
  } catch {
    return false;
  }
}

function findTranscriptFile(outputDir: string, videoId: string): string | null {
  const files = readdirSync(outputDir);
  const subtitleFile = files.find(f =>
    f.includes(videoId) && (f.endsWith(".vtt") || f.endsWith(".srt"))
  );
  return subtitleFile ? join(outputDir, subtitleFile) : null;
}

function findMetadataFile(outputDir: string, videoId: string): string | null {
  const infoFile = join(outputDir, `${videoId}.info.json`);
  return existsSync(infoFile) ? infoFile : null;
}

function parseMetadata(metadataFile: string | null): { title: string | null; duration: number | null } {
  if (!metadataFile || !existsSync(metadataFile)) {
    return { title: null, duration: null };
  }

  try {
    const data = JSON.parse(readFileSync(metadataFile, "utf-8"));
    return {
      title: data.title || null,
      duration: data.duration || null
    };
  } catch {
    return { title: null, duration: null };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(JSON.stringify({
      success: false,
      data: null,
      error: "Usage: bun run extract-transcript.ts <url> <output_dir>"
    }, null, 2));
    process.exit(1);
  }

  const [url, outputDir] = args;
  const videoId = await extractVideoId(url);

  const result: ExtractionResult = {
    success: false,
    data: null,
    error: null
  };

  // Ensure output directory exists
  await $`mkdir -p ${outputDir}`.quiet();

  // Strategy 1: Try subtitles first
  const subtitlesExtracted = await extractSubtitles(url, outputDir, videoId);

  if (subtitlesExtracted) {
    // Also get metadata
    await extractInfoJson(url, outputDir, videoId);

    const transcriptFile = findTranscriptFile(outputDir, videoId);
    const metadataFile = findMetadataFile(outputDir, videoId);
    const { title, duration } = parseMetadata(metadataFile);

    result.success = true;
    result.data = {
      transcriptFile,
      metadataFile,
      extractionMethod: "subtitles",
      videoId,
      title,
      duration
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Strategy 2: Fall back to info.json
  const infoExtracted = await extractInfoJson(url, outputDir, videoId);

  if (infoExtracted) {
    const metadataFile = findMetadataFile(outputDir, videoId);
    const { title, duration } = parseMetadata(metadataFile);

    result.success = true;
    result.data = {
      transcriptFile: null, // No transcript, but have metadata
      metadataFile,
      extractionMethod: "info-json",
      videoId,
      title,
      duration
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // All strategies failed
  result.success = false;
  result.error = "Failed to extract transcript or metadata. Video may be unavailable, private, or geo-restricted.";
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

main();
```

### 6.6 Script Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SCRIPT-BASED EXTRACTION FLOW                                                │
│                                                                             │
│  media-processor subagent invokes:                                          │
│                                                                             │
│  Step 1: Detection                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ $ bun run scripts/detect-ytdlp.ts                                   │   │
│  │                                                                     │   │
│  │ Script internally:                                                  │   │
│  │   • Runs `which yt-dlp`                                            │   │
│  │   • If missing: detects OS, finds pip/brew/curl                    │   │
│  │   • Auto-installs using best method                                │   │
│  │   • Verifies with `yt-dlp --version`                               │   │
│  │                                                                     │   │
│  │ Output (JSON - only this consumes tokens):                         │   │
│  │   { "success": true, "installed": true, "version": "2024.12.06" }  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Step 2: Extraction                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ $ bun run scripts/extract-transcript.ts "{url}" "{output_dir}"      │   │
│  │                                                                     │   │
│  │ Script internally:                                                  │   │
│  │   • Extracts video ID from URL                                     │   │
│  │   • Tries --write-auto-sub first                                   │   │
│  │   • Falls back to --write-info-json                                │   │
│  │   • Parses metadata for title/duration                             │   │
│  │                                                                     │   │
│  │ Output (JSON - only this consumes tokens):                         │   │
│  │   {                                                                 │   │
│  │     "success": true,                                               │   │
│  │     "data": {                                                      │   │
│  │       "transcriptFile": "/path/to/abc123.en.vtt",                  │   │
│  │       "extractionMethod": "subtitles",                             │   │
│  │       "title": "Video Title",                                      │   │
│  │       "duration": 1234                                             │   │
│  │     }                                                              │   │
│  │   }                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Agent then reads the transcript file and creates content.md                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.7 Reference Files (Loaded On-Demand)

These files are NOT loaded into context unless the agent explicitly reads them:

**File:** `plugins/looplia-writer/skills/yt-dlp/references/supported-platforms.md`

```markdown
# Supported Platforms

yt-dlp supports 1000+ sites including:

## Video Platforms
- YouTube (youtube.com, youtu.be, music.youtube.com, shorts)
- Vimeo, Dailymotion, Twitch, TikTok
- Facebook, Instagram, Twitter/X

## Podcast Platforms
- Apple Podcasts (metadata only)
- Spotify (metadata only)
- SoundCloud (audio)
- Podcast RSS feeds (direct audio)

## Educational
- Coursera, Khan Academy, TED Talks, Udemy

## News
- CNN, BBC, NPR, and most major news sites

For full list: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md
```

**File:** `plugins/looplia-writer/skills/yt-dlp/references/troubleshooting.md`

```markdown
# Troubleshooting

## Common Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| "Video unavailable" | Private/deleted | Cannot extract |
| "No subtitles" | No captions | Falls back to info.json |
| "Age-restricted" | Requires login | May need cookies |
| "Geo-restricted" | Region blocked | Use VPN or skip |
| "Unable to extract" | Site not supported | Check supported sites list |

## Permission Issues

If pip install fails with permission error:
```bash
pip3 install --user yt-dlp
```

## PATH Issues

If yt-dlp installs but isn't found:
```bash
export PATH="$HOME/.local/bin:$PATH"
```
```

### 6.8 Why Script-Based Design?

| Aspect | Inline Instructions | Script-Based |
|--------|---------------------|--------------|
| **Token cost** | ~450 tokens/operation | ~100 tokens/operation |
| **Consistency** | Agent may vary approach | Same logic every time |
| **Maintainability** | Edit SKILL.md | Edit TypeScript files |
| **Testability** | Hard to test | Scripts are unit-testable |
| **Error handling** | Agent improvises | Programmatic handling |
| **Updates** | Re-read entire skill | Just update scripts |

---

## 7. Whisper Transcription Skill

### 7.1 Purpose

When yt-dlp cannot extract subtitles (podcasts, videos without captions), the **Whisper skill** transcribes audio using:
- **Groq API** (fast, cloud-based) - Primary
- **Local WhisperKit** (offline, privacy) - Fallback

### 7.2 Multi-Source Extraction Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPLETE EXTRACTION FLOW BY SOURCE TYPE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  URL Input                                                                  │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 1: Detect Source Type (yt-dlp skill)                           │   │
│  │                                                                     │   │
│  │ YouTube:     youtube.com, youtu.be, shorts                          │   │
│  │ Podcast:     podcasts.apple.com, spotify, RSS feeds, soundcloud     │   │
│  │ Video:       vimeo, dailymotion, twitch, tiktok                     │   │
│  │ News:        cnn, bbc, npr                                          │   │
│  │ Educational: coursera, khan academy, ted                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 2: Try Subtitles First (yt-dlp skill)                          │   │
│  │                                                                     │   │
│  │ yt-dlp --write-auto-sub --write-sub --skip-download                 │   │
│  │                                                                     │   │
│  │ ✓ Found subtitles? → Done! Use VTT/SRT transcript                   │   │
│  │ ✗ No subtitles? → Continue to Step 3                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 3: Extract Audio (yt-dlp skill)                                │   │
│  │                                                                     │   │
│  │ yt-dlp -x --audio-format mp3 --audio-quality 5                      │   │
│  │                                                                     │   │
│  │ Output: {id}.mp3 audio file                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 4: Transcribe Audio (whisper skill)                            │   │
│  │                                                                     │   │
│  │ Primary: Groq API (whisper-large-v3-turbo)                          │   │
│  │   - Fast: ~10x realtime                                             │   │
│  │   - Requires: GROQ_API_KEY                                          │   │
│  │                                                                     │   │
│  │ Fallback: Local WhisperKit                                          │   │
│  │   - Offline: No API key needed                                      │   │
│  │   - Slower: ~1x realtime                                            │   │
│  │                                                                     │   │
│  │ Output: Transcript text with timestamps                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 5: Create content.md                                           │   │
│  │                                                                     │   │
│  │ Combine metadata + transcript into markdown with frontmatter        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Source Type Handling Matrix

| Source Type | Has Subtitles? | Extraction Method | Skill Chain |
|-------------|----------------|-------------------|-------------|
| **YouTube** | Usually yes | Auto-captions → Manual subs | yt-dlp only |
| **YouTube (no captions)** | No | Audio extraction + Whisper | yt-dlp → whisper |
| **Podcast (Apple/Spotify)** | No | Audio extraction + Whisper | yt-dlp → whisper |
| **Podcast (RSS)** | No | Direct audio + Whisper | yt-dlp → whisper |
| **TED Talks** | Usually yes | Subtitles | yt-dlp only |
| **Coursera** | Usually yes | Subtitles | yt-dlp only |
| **TikTok** | Sometimes | Try subs, fallback to audio | yt-dlp → whisper |
| **News (video)** | Sometimes | Try subs, fallback to audio | yt-dlp → whisper |

### 7.4 Whisper Skill Folder Structure

```
plugins/looplia-writer/skills/whisper/
├── SKILL.md                        # Concise instructions
├── scripts/
│   ├── detect-whisper.ts          # Check Groq API key or local WhisperKit
│   ├── transcribe-groq.ts         # Groq API transcription
│   ├── transcribe-local.ts        # Local WhisperKit transcription
│   └── transcribe.ts              # Unified entry point (tries Groq, falls back to local)
└── references/
    ├── groq-setup.md              # Groq API setup instructions
    └── whisperkit-setup.md        # Local WhisperKit installation
```

### 7.5 SKILL.md (Whisper)

**File:** `plugins/looplia-writer/skills/whisper/SKILL.md`

```markdown
---
name: whisper
description: Transcribe audio files using Groq API (primary) or local WhisperKit (fallback).
Token-efficient script-based design.
---

# Whisper Transcription Skill

Transcribe audio files to text with timestamps.

## How This Skill Works

This skill uses **pre-programmed TypeScript scripts** for audio transcription.
It automatically selects the best available method.

## Step 1: Check Available Transcription Methods

```bash
bun run plugins/looplia-writer/skills/whisper/scripts/detect-whisper.ts
```

Output (JSON):
- `groqAvailable: true` → GROQ_API_KEY found, use Groq API
- `localAvailable: true` → WhisperKit installed locally
- Both false → Provide setup instructions

## Step 2: Transcribe Audio

```bash
bun run plugins/looplia-writer/skills/whisper/scripts/transcribe.ts "{audio_file}" "{output_dir}"
```

Output: JSON with transcript file path and method used.

## Transcription Priority

1. **Groq API** (if GROQ_API_KEY set) - Fastest, best quality
2. **Local WhisperKit** (if installed) - Offline, no API costs
3. **Error** - Provide setup instructions for either method

## Script Output Format

```json
{
  "success": true,
  "data": {
    "transcriptFile": "/path/to/transcript.txt",
    "method": "groq" | "local",
    "duration": 1234,
    "language": "en"
  },
  "error": null
}
```

## Reference Documentation

- `references/groq-setup.md` - Get Groq API key (free tier available)
- `references/whisperkit-setup.md` - Install local WhisperKit
```

### 7.6 Script: detect-whisper.ts

**File:** `plugins/looplia-writer/skills/whisper/scripts/detect-whisper.ts`

```typescript
#!/usr/bin/env bun
/**
 * Whisper Availability Detection Script
 *
 * Checks for:
 * 1. Groq API key (GROQ_API_KEY environment variable)
 * 2. Local WhisperKit installation
 *
 * Output: JSON with available transcription methods
 */

import { $ } from "bun";

interface DetectionResult {
  success: boolean;
  groqAvailable: boolean;
  localAvailable: boolean;
  recommendedMethod: "groq" | "local" | null;
  setupInstructions: string | null;
}

async function checkGroqApiKey(): Promise<boolean> {
  return !!process.env.GROQ_API_KEY;
}

async function checkLocalWhisper(): Promise<boolean> {
  // Check for whisperkit CLI or whisper.cpp
  try {
    const whisperKit = await $`which whisperkit`.quiet();
    if (whisperKit.exitCode === 0) return true;
  } catch {}

  try {
    const whisperCpp = await $`which whisper-cpp`.quiet();
    if (whisperCpp.exitCode === 0) return true;
  } catch {}

  try {
    // Check for Python whisper
    const pythonWhisper = await $`python3 -c "import whisper"`.quiet();
    if (pythonWhisper.exitCode === 0) return true;
  } catch {}

  return false;
}

async function main(): Promise<void> {
  const groqAvailable = await checkGroqApiKey();
  const localAvailable = await checkLocalWhisper();

  const result: DetectionResult = {
    success: groqAvailable || localAvailable,
    groqAvailable,
    localAvailable,
    recommendedMethod: groqAvailable ? "groq" : localAvailable ? "local" : null,
    setupInstructions: null
  };

  if (!result.success) {
    result.setupInstructions = `No transcription method available.

Option 1: Groq API (Recommended - Fast & Free Tier)
  1. Get API key at: https://console.groq.com/keys
  2. Set environment variable: export GROQ_API_KEY="your-key"

Option 2: Local WhisperKit (Offline)
  macOS: brew install whisperkit-cli
  Linux: pip install openai-whisper
`;
  }

  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exit(1);
  }
}

main();
```

### 7.7 Script: transcribe.ts (Unified Entry Point)

**File:** `plugins/looplia-writer/skills/whisper/scripts/transcribe.ts`

```typescript
#!/usr/bin/env bun
/**
 * Unified Whisper Transcription Script
 *
 * Usage: bun run transcribe.ts <audio_file> <output_dir>
 *
 * Automatically selects best available method:
 * 1. Groq API (if GROQ_API_KEY set)
 * 2. Local WhisperKit (if installed)
 */

import { $ } from "bun";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";

interface TranscriptionResult {
  success: boolean;
  data: {
    transcriptFile: string | null;
    method: "groq" | "local" | null;
    durationSeconds: number | null;
    language: string;
  } | null;
  error: string | null;
}

async function transcribeWithGroq(audioFile: string, outputDir: string): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { success: false, data: null, error: "GROQ_API_KEY not set" };
  }

  try {
    const audioBuffer = readFileSync(audioFile);
    const fileName = basename(audioFile);

    // Create form data for Groq API
    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer]), fileName);
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "verbose_json");
    formData.append("language", "en");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, data: null, error: `Groq API error (${response.status}): ${errorText}` };
    }

    const result = await response.json();

    // Validate response structure
    if (!result || typeof result.text !== "string") {
      return { success: false, data: null, error: "Invalid response format from Groq API" };
    }

    // Write transcript to file - use extname to handle any audio format
    const audioExt = extname(audioFile);
    const transcriptFile = join(outputDir, `${basename(audioFile, audioExt)}.transcript.txt`);

    // Format with timestamps if available
    let transcriptContent = "";
    if (result.segments) {
      for (const segment of result.segments) {
        const startTime = formatTimestamp(segment.start);
        const endTime = formatTimestamp(segment.end);
        transcriptContent += `[${startTime} --> ${endTime}]\n${segment.text.trim()}\n\n`;
      }
    } else {
      transcriptContent = result.text;
    }

    writeFileSync(transcriptFile, transcriptContent);

    return {
      success: true,
      data: {
        transcriptFile,
        method: "groq",
        durationSeconds: result.duration || null,
        language: result.language || "en"
      },
      error: null
    };
  } catch (e) {
    return { success: false, data: null, error: `Groq transcription failed: ${e}` };
  }
}

async function transcribeWithLocal(audioFile: string, outputDir: string): Promise<TranscriptionResult> {
  const audioExt = extname(audioFile);
  const transcriptFile = join(outputDir, `${basename(audioFile, audioExt)}.transcript.txt`);

  // Try whisperkit first (macOS)
  try {
    const result = await $`whisperkit transcribe --audio-path ${audioFile} --output-dir ${outputDir}`.nothrow();
    if (result.exitCode === 0 && existsSync(transcriptFile)) {
      return {
        success: true,
        data: { transcriptFile, method: "local", durationSeconds: null, language: "en" },
        error: null
      };
    }
    console.error(`WhisperKit failed with exit code ${result.exitCode}: ${result.stderr?.toString().trim()}`);
  } catch (err) {
    console.error(`WhisperKit error: ${err}`);
  }

  // Try Python whisper
  try {
    const result = await $`python3 -m whisper ${audioFile} --output_dir ${outputDir} --output_format txt --language en`.nothrow();
    if (result.exitCode === 0 && existsSync(transcriptFile)) {
      return {
        success: true,
        data: { transcriptFile, method: "local", durationSeconds: null, language: "en" },
        error: null
      };
    }
    console.error(`Python Whisper failed with exit code ${result.exitCode}: ${result.stderr?.toString().trim()}`);
  } catch (err) {
    console.error(`Python Whisper error: ${err}`);
  }

  return { success: false, data: null, error: "Local transcription failed. No whisper installation found or transcription failed." };
}

function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(JSON.stringify({
      success: false,
      data: null,
      error: "Usage: bun run transcribe.ts <audio_file> <output_dir>"
    }, null, 2));
    process.exit(1);
  }

  const [audioFile, outputDir] = args;

  if (!existsSync(audioFile)) {
    console.log(JSON.stringify({
      success: false,
      data: null,
      error: `Audio file not found: ${audioFile}`
    }, null, 2));
    process.exit(1);
  }

  // Ensure output directory exists
  await $`mkdir -p ${outputDir}`.quiet();

  // Try Groq first (faster, better quality)
  if (process.env.GROQ_API_KEY) {
    const groqResult = await transcribeWithGroq(audioFile, outputDir);
    if (groqResult.success) {
      console.log(JSON.stringify(groqResult, null, 2));
      return;
    }
    console.error(`Groq failed: ${groqResult.error}. Trying local...`);
  }

  // Fall back to local
  const localResult = await transcribeWithLocal(audioFile, outputDir);
  console.log(JSON.stringify(localResult, null, 2));

  if (!localResult.success) {
    process.exit(1);
  }
}

main();
```

### 7.8 Updated extract-transcript.ts (with Audio Fallback)

Update the yt-dlp script to include audio extraction when subtitles aren't available:

**File:** `plugins/looplia-writer/skills/yt-dlp/scripts/extract-transcript.ts` (Updated)

```typescript
// Add to ExtractionResult interface:
interface ExtractionResult {
  success: boolean;
  data: {
    transcriptFile: string | null;
    audioFile: string | null;        // NEW: For whisper transcription
    metadataFile: string | null;
    extractionMethod: "subtitles" | "info-json" | "audio" | null;  // NEW: audio option
    needsTranscription: boolean;     // NEW: Flag for whisper skill
    videoId: string | null;
    title: string | null;
    duration: number | null;
    sourceType: "youtube" | "podcast" | "video" | "news" | "educational" | "unknown";  // NEW
  } | null;
  error: string | null;
}

// Add source type detection function:
function detectSourceType(url: string): "youtube" | "podcast" | "video" | "news" | "educational" | "unknown" {
  const urlLower = url.toLowerCase();

  // YouTube
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
    return "youtube";
  }

  // Podcasts
  if (urlLower.includes("podcasts.apple.com") ||
      urlLower.includes("spotify.com/episode") ||
      urlLower.includes("soundcloud.com") ||
      urlLower.includes("anchor.fm") ||
      urlLower.includes("podbean.com") ||
      urlLower.includes(".rss") ||
      urlLower.includes("/feed")) {
    return "podcast";
  }

  // Educational
  if (urlLower.includes("ted.com") ||
      urlLower.includes("coursera.org") ||
      urlLower.includes("khanacademy.org") ||
      urlLower.includes("udemy.com")) {
    return "educational";
  }

  // News
  if (urlLower.includes("cnn.com") ||
      urlLower.includes("bbc.com") ||
      urlLower.includes("npr.org") ||
      urlLower.includes("nytimes.com")) {
    return "news";
  }

  // Video platforms
  if (urlLower.includes("vimeo.com") ||
      urlLower.includes("dailymotion.com") ||
      urlLower.includes("twitch.tv") ||
      urlLower.includes("tiktok.com")) {
    return "video";
  }

  return "unknown";
}

// Add audio extraction function:
async function extractAudio(url: string, outputDir: string, videoId: string): Promise<string | null> {
  try {
    // Use proper output template for yt-dlp
    const outputTemplate = `${outputDir}/${videoId}.%(ext)s`;
    await $`yt-dlp -x --audio-format mp3 --audio-quality 5 -o ${outputTemplate} -- ${url}`.quiet();

    const audioFile = join(outputDir, `${videoId}.mp3`);
    if (existsSync(audioFile)) {
      return audioFile;
    }
  } catch {}
  return null;
}

// Update main function to include audio extraction fallback:
async function main(): Promise<void> {
  // ... existing code ...

  const sourceType = detectSourceType(url);

  // Strategy 1: Try subtitles first (skip for known podcast sources)
  if (sourceType !== "podcast") {
    const subtitlesExtracted = await extractSubtitles(url, outputDir, videoId!);

    if (subtitlesExtracted) {
      await extractInfoJson(url, outputDir, videoId!);
      const transcriptFile = findTranscriptFile(outputDir, videoId!);
      const metadataFile = findMetadataFile(outputDir, videoId!);
      const { title, duration } = parseMetadata(metadataFile);

      result.success = true;
      result.data = {
        transcriptFile,
        audioFile: null,
        metadataFile,
        extractionMethod: "subtitles",
        needsTranscription: false,
        videoId,
        title,
        duration,
        sourceType
      };
      console.log(JSON.stringify(result, null, 2));
      return;
    }
  }

  // Strategy 2: Extract audio for transcription
  console.error("No subtitles found. Extracting audio for transcription...");
  const audioFile = await extractAudio(url, outputDir, videoId!);

  if (audioFile) {
    await extractInfoJson(url, outputDir, videoId!);
    const metadataFile = findMetadataFile(outputDir, videoId!);
    const { title, duration } = parseMetadata(metadataFile);

    result.success = true;
    result.data = {
      transcriptFile: null,
      audioFile,
      metadataFile,
      extractionMethod: "audio",
      needsTranscription: true,  // Signal to use whisper skill
      videoId,
      title,
      duration,
      sourceType
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Strategy 3: Info.json only (no transcript possible)
  // ... existing fallback code ...
}
```

### 7.9 Updated Media Processor Subagent Flow

The media-processor subagent now chains yt-dlp and whisper skills:

```markdown
## Updated Task Flow

1. Read URL request from `contentItem/{id}/url-request.json`
2. Use **yt-dlp** skill to detect and install yt-dlp
3. Use **yt-dlp** skill to extract transcript:
   - If `needsTranscription: false` → Have subtitles, proceed to step 6
   - If `needsTranscription: true` → Continue to step 4
4. Use **whisper** skill to detect transcription method
5. Use **whisper** skill to transcribe audio file
6. Convert transcript to markdown format
7. Write output to: `contentItem/{id}/content.md`
8. Update url-request.json with status: "completed"
```

### 7.10 Complete Skill Chain Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  media-processor Subagent: Complete Skill Chain                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. yt-dlp skill: detect-ytdlp.ts                                          │
│     └─► { "installed": true, "version": "2024.12.06" }                     │
│                                                                             │
│  2. yt-dlp skill: extract-transcript.ts                                    │
│     │                                                                       │
│     ├─► YouTube with captions:                                              │
│     │   { "needsTranscription": false, "transcriptFile": "abc.vtt" }       │
│     │   └─► DONE: Create content.md from VTT                               │
│     │                                                                       │
│     └─► Podcast or no captions:                                            │
│         { "needsTranscription": true, "audioFile": "abc.mp3" }             │
│         │                                                                   │
│         ▼                                                                   │
│  3. whisper skill: detect-whisper.ts                                       │
│     └─► { "groqAvailable": true, "recommendedMethod": "groq" }             │
│                                                                             │
│  4. whisper skill: transcribe.ts                                           │
│     └─► { "transcriptFile": "abc.transcript.txt", "method": "groq" }       │
│         │                                                                   │
│         ▼                                                                   │
│  5. Create content.md from transcript                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Details

### 8.1 CLI Changes

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

### 8.2 URL Request File Format

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
  "ytdlp": {
    "wasInstalled": false,
    "installedBy": "pip3",
    "version": "2024.12.06"
  },
  "extractionMethod": "subtitles",
  "extractedFiles": ["dQw4w9WgXcQ.en.vtt"],
  "error": null,
  "completedAt": "2025-12-09T10:30:15.000Z"
}
```

### 8.3 Content I/O Updates

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

### 8.4 Updated CLAUDE.md Instructions

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

### 8.5 Session ID Generation for URLs

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

## 9. File Changes

### 9.1 New Files

| File | Purpose |
|------|---------|
| `plugins/looplia-writer/agents/media-processor.md` | Media processor subagent definition |
| **yt-dlp Skill** | |
| `plugins/looplia-writer/skills/yt-dlp/SKILL.md` | yt-dlp skill (concise, references scripts) |
| `plugins/looplia-writer/skills/yt-dlp/scripts/detect-ytdlp.ts` | Detection + auto-install script |
| `plugins/looplia-writer/skills/yt-dlp/scripts/extract-transcript.ts` | Transcript/audio extraction with source detection |
| `plugins/looplia-writer/skills/yt-dlp/scripts/extract-metadata.ts` | Metadata extraction script |
| `plugins/looplia-writer/skills/yt-dlp/references/supported-platforms.md` | Platform list (on-demand) |
| `plugins/looplia-writer/skills/yt-dlp/references/troubleshooting.md` | Error solutions (on-demand) |
| **Whisper Skill** | |
| `plugins/looplia-writer/skills/whisper/SKILL.md` | Whisper skill (Groq API + local fallback) |
| `plugins/looplia-writer/skills/whisper/scripts/detect-whisper.ts` | Check Groq API key or local WhisperKit |
| `plugins/looplia-writer/skills/whisper/scripts/transcribe.ts` | Unified transcription entry point |
| `plugins/looplia-writer/skills/whisper/scripts/transcribe-groq.ts` | Groq API transcription |
| `plugins/looplia-writer/skills/whisper/scripts/transcribe-local.ts` | Local WhisperKit transcription |
| `plugins/looplia-writer/skills/whisper/references/groq-setup.md` | Groq API setup instructions |
| `plugins/looplia-writer/skills/whisper/references/whisperkit-setup.md` | Local WhisperKit installation |
| `docs/DESIGN-0.3.4.1.md` | This document |

### 9.2 Modified Files

| File | Changes |
|------|---------|
| `apps/cli/src/commands/kit.ts` | Add `--url` option parsing and handling |
| `packages/provider/src/claude-agent-sdk/content-io.ts` | Add `writeUrlRequest`, `createPendingContentItem` |
| `plugins/looplia-writer/README.md` | Add URL processing workflow instructions |
| `apps/cli/src/index.ts` | Bump VERSION to "0.3.4.1" |
| `packages/*/package.json` | Bump version to 0.3.4.1 |

### 9.3 Workspace Structure Changes

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
│       ├── yt-dlp/                   # NEW: Media extraction skill
│       │   ├── SKILL.md              # Concise instructions
│       │   ├── scripts/
│       │   │   ├── detect-ytdlp.ts   # Detection + auto-install
│       │   │   ├── extract-transcript.ts  # Subs + audio + source detection
│       │   │   └── extract-metadata.ts
│       │   └── references/
│       │       ├── supported-platforms.md
│       │       └── troubleshooting.md
│       └── whisper/                  # NEW: Audio transcription skill
│           ├── SKILL.md              # Groq API + local WhisperKit
│           ├── scripts/
│           │   ├── detect-whisper.ts # Check available methods
│           │   ├── transcribe.ts     # Unified entry point
│           │   ├── transcribe-groq.ts
│           │   └── transcribe-local.ts
│           └── references/
│               ├── groq-setup.md
│               └── whisperkit-setup.md
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

## 10. Usage Guide

### 10.1 Prerequisites

**yt-dlp will be auto-installed** by the media-processor subagent if not already present. The yt-dlp skill handles:
- Detection of existing installation
- OS-appropriate installation method (pip, brew, or binary download)
- Verification after installation

**Optional: Pre-install yt-dlp manually** for faster first run:

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

**Note:** If auto-installation fails (e.g., no pip, no internet, permission issues), the agent will provide clear instructions for manual installation.

### 10.2 Basic Usage

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

### 10.3 Supported URL Formats

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

### 10.4 Session Continuation

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

### 10.5 Debugging

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

## 11. Testing Strategy

### 11.1 Unit Tests

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

### 11.2 Integration Tests (Mock Provider)

```bash
# Test URL flow with mock (no API key, no yt-dlp)
looplia kit --url "https://youtube.com/watch?v=test" --mock

# Should create session and return mock WritingKit
```

### 11.3 E2E Tests

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

### 11.4 Error Cases

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

### 11.5 CI Pipeline Addition

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
| 0.3.4.1 | 2025-12-09 | Added: yt-dlp auto-detection and installation capability in skill |
| 0.3.4.1 | 2025-12-09 | Refactored: Script-based architecture for token efficiency (~350 tokens saved/operation) |
| 0.3.4.1 | 2025-12-09 | Added: Whisper skill for audio transcription (Groq API + local WhisperKit) |
| 0.3.4.1 | 2025-12-09 | Added: Multi-source support with source type detection (YouTube, podcasts, TED, etc.) |
| 0.3.4.1 | 2025-12-09 | Added: Complete skill chain: yt-dlp (subs/audio) → whisper (transcription) |
