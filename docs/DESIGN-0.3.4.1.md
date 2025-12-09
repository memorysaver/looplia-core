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
| **Auto-Install yt-dlp** | Skill detects missing yt-dlp and installs it automatically |
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
      // Continue to next method
    }
  }

  if (await hasCommand("pip")) {
    try {
      await $`pip install --user yt-dlp`.quiet();
      return { success: true, method: "pip", error: null };
    } catch (e) {
      // Continue to next method
    }
  }

  // Try brew on macOS
  if (os === "darwin" && await hasCommand("brew")) {
    try {
      await $`brew install yt-dlp`.quiet();
      return { success: true, method: "brew", error: null };
    } catch (e) {
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

function extractVideoId(url: string): string | null {
  // YouTube patterns
  const patterns = [
    /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:embed\/|v\/|shorts\/)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Fallback: generate ID from URL hash
  const hash = url.split("").reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return `url-${Math.abs(hash).toString(36)}`;
}

async function extractSubtitles(url: string, outputDir: string, videoId: string): Promise<boolean> {
  try {
    await $`yt-dlp --write-auto-sub --write-sub --sub-lang en,en-US,en-GB --sub-format vtt --skip-download -o ${join(outputDir, videoId)} ${url}`.quiet();

    // Check if any subtitle file was created
    const files = readdirSync(outputDir);
    return files.some(f => f.includes(videoId) && (f.endsWith(".vtt") || f.endsWith(".srt")));
  } catch {
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
  const videoId = extractVideoId(url);

  const result: ExtractionResult = {
    success: false,
    data: null,
    error: null
  };

  // Ensure output directory exists
  await $`mkdir -p ${outputDir}`.quiet();

  // Strategy 1: Try subtitles first
  const subtitlesExtracted = await extractSubtitles(url, outputDir, videoId!);

  if (subtitlesExtracted) {
    // Also get metadata
    await extractInfoJson(url, outputDir, videoId!);

    const transcriptFile = findTranscriptFile(outputDir, videoId!);
    const metadataFile = findMetadataFile(outputDir, videoId!);
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
  const infoExtracted = await extractInfoJson(url, outputDir, videoId!);

  if (infoExtracted) {
    const metadataFile = findMetadataFile(outputDir, videoId!);
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
| `plugins/looplia-writer/skills/yt-dlp/SKILL.md` | yt-dlp skill (concise, references scripts) |
| `plugins/looplia-writer/skills/yt-dlp/scripts/detect-ytdlp.ts` | Detection + auto-install script |
| `plugins/looplia-writer/skills/yt-dlp/scripts/extract-transcript.ts` | Transcript extraction script |
| `plugins/looplia-writer/skills/yt-dlp/scripts/extract-metadata.ts` | Metadata extraction script |
| `plugins/looplia-writer/skills/yt-dlp/references/supported-platforms.md` | Platform list (on-demand) |
| `plugins/looplia-writer/skills/yt-dlp/references/troubleshooting.md` | Error solutions (on-demand) |
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
│       └── yt-dlp/                   # NEW: Script-based skill
│           ├── SKILL.md              # Concise instructions
│           ├── scripts/
│           │   ├── detect-ytdlp.ts   # Detection + auto-install
│           │   ├── extract-transcript.ts
│           │   └── extract-metadata.ts
│           └── references/
│               ├── supported-platforms.md
│               └── troubleshooting.md
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
| 0.3.4.1 | 2025-12-09 | Added: yt-dlp auto-detection and installation capability in skill |
| 0.3.4.1 | 2025-12-09 | Refactored: Script-based architecture for token efficiency (~350 tokens saved/operation) |
