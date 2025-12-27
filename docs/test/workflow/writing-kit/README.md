# Writing-Kit Workflow Test Results

**Test Date:** 2025-12-27/28
**Workflow:** `writing-kit` v1.1.0
**Test Content:** `examples/ai-healthcare.md`
**Looplia Version:** v0.6.6

## Test Summary

| Model | Preset | Summary | Ideas | Overall | Status |
|-------|--------|---------|-------|---------|--------|
| z-ai/glm-4.7 | ZENMUX_ZAI_GLM47 | 15/15 | 7/7 | 100% | PASSED |
| google/gemini-3-flash-preview | ZENMUX_GOOGLE_GEMINI3FLASH | 15/15 | 7/7 | 100% | PASSED |
| x-ai/grok-4.1-fast | ZENMUX_XAI_GROK41FAST | 15/15 | 7/7 | 100% | PASSED |
| deepseek/deepseek-reasoner | ZENMUX_DEEPSEEK_REASONER | 14/15 | 7/7 | ~95% | PASSED |
| xiaomi/mimo-v2-flash | ZENMUX_XIAOMI_MIMOV2FLASH | 15/15 | 3/7 | ~82% | PASSED |
| volcengine/doubao-seed-1.8 | ZENMUX_VOLCENGINE_DOUBAO_SEED | 15/15 | 0/7 | ~50% | PARTIAL |
| openai/gpt-5.1-codex-mini | ZENMUX_OPENAI_GPT51CODEXMINI | 15/15 | 3/7 | ~65% | PARTIAL |
| deepseek/deepseek-v3.2 | ZENMUX_DEEPSEEK_V32 | 0/15 | 0/7 | 0% | FAILED |
| z-ai/glm-4.6v | ZENMUX_ZAI_GLM46V | 0/15 | 4/7* | ~25% | **NOT RECOMMENDED** |

## Folder Structure

Each model folder contains:
- `summary.json` - Media reviewer output
- `ideas.json` - Idea synthesis output
- `writing-kit.json` - Combined workflow output
- `query-*.json` - Agent SDK execution log

## Model Notes

### Tier 1: Production Ready (95-100%)

#### z-ai/glm-4.7
- All 15 summary fields with rich structured objects
- All 5 hook types (emotional, curiosity, controversy, statistic, story)
- Relevance scores on angles
- Very detailed analysis with quotes

#### google/gemini-3-flash-preview
- Complete compliance with all fields
- Standard hook types
- Good relevance scoring (0.82-0.95)

#### x-ai/grok-4.1-fast
- Full compliance with all fields
- All hook types in object format
- Relevance scores (6-9 scale)

#### deepseek/deepseek-reasoner
- 14/15 summary fields (missing `context`)
- All 5 hook types present
- Relevance scores (0.6-0.9)

### Tier 2: Good for Summaries (~82%)

#### xiaomi/mimo-v2-flash
- 15/15 summary fields with rich detail
- Creative hook types (question, contrast, bold statement) - differs from spec
- No relevance scores on angles

### Tier 3: Partial (~50-65%)

#### openai/gpt-5.1-codex-mini (~65%)
- 15/15 summary fields (all present)
- 5 hooks but non-standard types (question, contrast, bold_statement)
- No relevance scores on angles
- **Missing writing-kit.json** - hallucinated completion bug:
  - Invoked writing-kit-assembler skill
  - Never called Write tool for writing-kit.json
  - Claimed "The final writing kit JSON is available" but file never written
  - Returned StructuredOutput with status: "success" despite incomplete
- Uses inline execution correctly (no Task subagents)

#### volcengine/doubao-seed-1.8 (~50%)
- 15/15 summary fields
- No ideas.json generated (workflow incomplete)
- Only Step 1 (media-reviewer) executed

### Not Recommended

#### z-ai/glm-4.6v (~25%) - **CRITICAL BUG**
- **Hallucinated file writes:** Model claimed to complete summary step but file never written
- **Cross-contamination:** When file not found, searched OTHER sandboxes
- **Wrong data used:** Read DeepSeek Reasoner's output from sandbox ac0a instead
- Ideas output may contain data from other model runs
- Non-standard hook types (question, contrast, bold_statement)
- *Asterisk in table: Ideas based on wrong model's summary

#### deepseek/deepseek-v3.2 (0%)
- No outputs generated
- Model describes workflow but doesn't execute skills
- Empty outputs folder

## How to View Results

```bash
# View summary for a model
cat docs/test/workflow/writing-kit/{model-id}/summary.json | jq

# View ideas for a model
cat docs/test/workflow/writing-kit/{model-id}/ideas.json | jq

# View execution log
cat docs/test/workflow/writing-kit/{model-id}/query-*.json
```

## Related Documentation

- [MODEL-COMPARISON-REPORT.md](./MODEL-COMPARISON-REPORT.md) - Detailed analysis and recommendations
