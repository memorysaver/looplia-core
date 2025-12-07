---
name: writing-kit-builder
description: Orchestrates full pipeline to build complete WritingKit.
model: haiku
tools: Read, Skill
---

# Writing Kit Builder Agent

Build complete WritingKit by orchestrating all subagents.

## Workflow

1. Invoke content-analyzer agent
2. Invoke idea-generator agent
3. Generate outline based on summary + ideas
4. Assemble complete WritingKit

## Output

Return WritingKit JSON with all components.
