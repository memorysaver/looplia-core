---
title: Quick Start
description: Run your first Looplia workflow in 5 minutes.
---

import { Aside, Steps, Code } from '@astrojs/starlight/components';

This guide walks you through running your first AI workflow with Looplia.

## Before You Begin

Make sure you've completed the [installation](/getting-started/installation/) and have your API key configured.

## Run the Writing Kit Workflow

The **writing-kit** workflow transforms any content into a structured writing kit with:
- Content summary and key themes
- Creative hooks and angles
- Writing ideas and questions
- Structured outline

<Steps>

1. **Create a content file**

   Create a markdown file with the content you want to analyze:

   ```bash
   cat > my-article.md << 'EOF'
   # The Future of AI in Healthcare

   Artificial intelligence is revolutionizing healthcare delivery.
   Machine learning algorithms can now detect diseases earlier than
   human doctors, with some studies showing 94% accuracy in detecting
   certain cancers from medical imaging.

   Key developments include:
   - Predictive diagnostics using patient data patterns
   - AI-assisted surgery with robotic precision
   - Drug discovery acceleration through molecular simulation
   - Personalized treatment plans based on genetic profiles

   "We're seeing a fundamental shift in how medicine is practiced,"
   says Dr. Sarah Chen, Chief AI Officer at Stanford Medical Center.
   EOF
   ```

2. **Run the workflow**

   Execute the writing-kit workflow on your content:

   ```bash
   looplia run writing-kit --file my-article.md
   ```

3. **Watch the progress**

   You'll see a streaming TUI showing each step:

   ```
   ┌─────────────────────────────────────────────────────┐
   │  Looplia · writing-kit                              │
   │  Sandbox: my-article-2025-12-28-x7km                │
   └─────────────────────────────────────────────────────┘

   ▶ Step 1/3: media-reviewer
     Analyzing content structure and themes...
     ✓ Extracted 5 key points
     ✓ Found 3 verbatim quotes
     → outputs/summary.json

   ▶ Step 2/3: idea-synthesis
     Generating creative hooks and angles...
   ```

4. **View the results**

   Once complete, find your outputs in the sandbox:

   ```bash
   # View the final writing kit
   cat ~/.looplia/sandbox/my-article-2025-12-28-x7km/outputs/writing-kit.json
   ```

</Steps>

## Understanding the Output

The writing-kit workflow produces three artifacts:

| File | Description |
|------|-------------|
| `summary.json` | Content analysis with key themes, quotes, and structure |
| `ideas.json` | Creative hooks, angles, questions, and writing prompts |
| `writing-kit.json` | Combined output with structured outline |

### Sample Output Structure

```json
{
  "contentId": "my-article-2025-12-28-x7km",
  "headline": "AI Healthcare Revolution",
  "keyThemes": ["predictive diagnostics", "personalized medicine", "AI surgery"],
  "hooks": [
    "What if your doctor could predict disease before symptoms appear?",
    "The algorithm that outperforms human radiologists"
  ],
  "outline": {
    "sections": [
      { "title": "The Diagnostic Revolution", "points": [...] },
      { "title": "From Lab to Bedside", "points": [...] }
    ]
  }
}
```

## Resume a Workflow

If a workflow is interrupted, resume from where you left off:

```bash
# List recent sandboxes
ls ~/.looplia/sandbox/

# Resume using sandbox ID
looplia run writing-kit --sandbox-id my-article-2025-12-28-x7km
```

Looplia tracks validation state and skips already-completed steps.

## Try Other Options

```bash
# Run without streaming (batch mode)
looplia run writing-kit --file article.md --no-streaming

# Run in mock mode (no API calls, for testing)
looplia run writing-kit --file article.md --mock
```

## What's Next?

- [Core Concepts](/getting-started/concepts/) — Understand skills, workflows, and sandboxes
- [Build Command](/cli/build/) — Create custom workflows with natural language
- [Understanding Workflows](/workflows/understanding-workflows/) — Learn the workflow schema
