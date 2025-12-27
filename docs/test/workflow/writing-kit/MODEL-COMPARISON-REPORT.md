# Writing-Kit Workflow: Model Performance Report

**Date:** 2025-12-28
**Workflow:** `writing-kit` v1.1.0
**Test Content:** `examples/ai-healthcare.md`
**Looplia Version:** v0.6.6

---

## Executive Summary

This report compares ten ZenMux models for the writing-kit workflow:

| Model | Provider | Compliance | Recommendation |
|-------|----------|------------|----------------|
| **GLM-4.7** (`z-ai/glm-4.7`) | ZenMux | 100% | **Production Ready** |
| **Gemini 3 Flash** (`google/gemini-3-flash-preview`) | ZenMux | 100% | **Production Ready** |
| **Grok 4.1 Fast** (`x-ai/grok-4.1-fast`) | ZenMux | 100% | **Production Ready** |
| **DeepSeek Reasoner** (`deepseek/deepseek-reasoner`) | ZenMux | ~95% | **Production Ready** |
| MiMo v2 Flash (`xiaomi/mimo-v2-flash`) | ZenMux | ~82% | Good for summaries |
| GPT-5.1 Codex Mini (`openai/gpt-5.1-codex-mini`) | ZenMux | ~65% | Partial (hallucinated Step 3) |
| Doubao-Seed (`volcengine/doubao-seed-1.8`) | ZenMux | ~50% | Summary only |
| MiniMax M2.1 (`minimax/minimax-m2.1`) | ZenMux | ~35% | Quick summaries only |
| GLM-4.6v (`z-ai/glm-4.6v`) | ZenMux | ~25% | **Not Recommended** (cross-contamination bug) |
| DeepSeek v3.2 (`deepseek/deepseek-v3.2`) | ZenMux | 0% | **Not Recommended** |

**Key Findings:**
- **GLM-4.7**, **Gemini 3 Flash**, and **Grok 4.1 Fast** tied at 100% compliance - all production-ready
- **DeepSeek Reasoner** achieves ~95% with only `context` field missing in summary
- **MiMo v2 Flash** excels at summary generation (100%) but creative hook types diverge from spec (43%)
- **GPT-5.1 Codex Mini** completes Steps 1-2 but hallucinated Step 3 - claimed success without writing file
- **Doubao-Seed** generates summary only (no ideas) - ~50% compliance
- **GLM-4.6v** has critical cross-contamination bug - hallucinated file writes, reads from wrong sandbox
- **DeepSeek v3.2** failed to execute - model describes but doesn't invoke skills

---

## Test Configuration

```bash
# GLM-4.7 Test
looplia config provider preset ZENMUX_ZAI_GLM47
looplia run writing-kit --file examples/ai-healthcare.md

# Gemini 3 Flash Test
looplia config provider preset ZENMUX_GOOGLE_GEMINI3FLASH
looplia run writing-kit --file examples/ai-healthcare.md

# MiMo v2 Flash Test
looplia config provider preset ZENMUX_XIAOMI_MIMOV2FLASH
looplia run writing-kit --file examples/ai-healthcare.md

# MiniMax M2.1 Test
looplia config provider preset ZENMUX_MINIMAX_M21
looplia run writing-kit --file examples/ai-healthcare.md

# DeepSeek v3.2 Test
looplia config provider preset ZENMUX_DEEPSEEK_V32
looplia run writing-kit --file examples/ai-healthcare.md

# Grok 4.1 Fast Test
looplia config provider preset ZENMUX_XAI_GROK41FAST
looplia run writing-kit --file examples/ai-healthcare.md

# DeepSeek Reasoner Test
looplia config provider preset ZENMUX_DEEPSEEK_REASONER
looplia run writing-kit --file examples/ai-healthcare.md

# GLM-4.6v Test
looplia config provider preset ZENMUX_ZAI_GLM46V
looplia run writing-kit --file examples/ai-healthcare.md

# GPT-5.1 Codex Mini Test
looplia config provider preset ZENMUX_OPENAI_GPT51CODEXMINI
looplia run writing-kit --file examples/ai-healthcare.md
```

**Environment:**
- API Provider: ZenMux (`https://zenmux.ai/api/anthropic`)
- Both main and executor agents used the same model
- Same input content for fair comparison

---

## Output Quality Comparison

### Content Volume

| Metric | GLM-4.7 | Gemini 3 | Grok 4.1 | Reasoner | MiMo v2 | GPT-5.1 | Doubao | M2.1 | GLM-4.6v | DeepSeek v3 |
|--------|---------|----------|----------|----------|---------|---------|--------|------|----------|-------------|
| Total Output Size | 27 KB | ~13 KB | ~15 KB | ~14 KB | ~25 KB | ~5 KB | ~5 KB | ~3 KB | ~5 KB | 0 KB |
| Output Files | 3 | 3 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | 0 |
| Quotes Extracted | 7 | 3 | 4 | 4 | 7 | 3 | 4 | 3 | - | - |
| Hooks Generated | 5 | 5 | 5 | 5 | 5 | 5 | - | 3 | 5 | - |
| Angles Created | 4+ | 3 | 5 | 5 | 5 | 4 | - | 5 | 5 | - |
| Related Concepts | 15 | 5 | 5 | 5 | 10 | 4 | 5 | 0 | - | - |

### Content Richness

**GLM-4.7 Provided:**
- Multi-paragraph `detailedAnalysis` with narrative breakdown
- `narrativeFlow` analysis describing content arc
- `coreIdeas` with concept, explanation, and examples
- `context` explaining assumed reader knowledge
- `relatedConcepts` for further exploration
- Relevance scores (0.78-0.92) on angles
- All 5 hook types (emotional, curiosity, controversy, statistic, story)

**Gemini 3 Flash Provided:**
- Complete `detailedAnalysis` with balanced perspective
- `narrativeFlow` describing problem-solution structure
- `coreIdeas` as string list (simpler format)
- All 5 hook types with distinct emotional approaches
- Relevance scores (0.82-0.95) on angles
- Good question categorization (analytical, practical, philosophical, comparative)

**MiMo v2 Flash Provided:**
- Very comprehensive `detailedAnalysis` and `overview`
- Rich `coreIdeas` with concept/explanation/examples structure
- 7 quotes with full context
- 10 related concepts
- Creative hook types (question, contrast, bold statement) - **diverges from spec**
- No relevance scores on angles

**MiniMax M2.1 Provided:**
- Basic `tldr` summary
- `keyThemes` list
- 3 quotes with minimal context
- 3 hook types (missing emotional, controversy)
- Angles without relevance scores
- `suggestedOutline` with word estimates (unique strength)

**Grok 4.1 Fast Provided:**
- Complete `detailedAnalysis` with comprehensive narrative breakdown
- `narrativeFlow` describing content structure
- All 5 hook types in object format (emotional, curiosity, controversy, statistic, story)
- Relevance scores (6-9 scale) on angles for prioritization
- Good question categorization (analytical, practical, philosophical, comparative)
- 4 quotes with context, 5 related concepts

**DeepSeek Reasoner Provided:**
- Rich `detailedAnalysis` with analytical breakdown
- `narrativeFlow` describing article progression
- All 5 hook types with distinct approaches
- Relevance scores (0.6-0.9) on angles
- Question categorization by depth and type
- 4 quotes with detailed context
- Missing: `context` field (only missing field)

**Doubao-Seed Provided:**
- 15/15 summary fields with good detail
- 4 quotes with context
- 5 related concepts
- No ideas.json generated (workflow incomplete after Step 1)

**GLM-4.6v Provided:**
- No summary.json (see failure analysis below)
- 5 hooks with non-standard types (question, contrast, bold_statement)
- 5 angles with relevance scores (7-9)
- 7 questions with depth and type categorization
- Only ideas.json generated

**GLM-4.6v Failure Analysis:**
Log analysis reveals the model did NOT skip the summary step - it hallucinated completing it:
1. Model executed media-reviewer skill and claimed success
2. "File does not exist" errors when reading summary.json from correct sandbox
3. Model searched OTHER sandboxes and found summary.json in wrong sandbox (DeepSeek Reasoner's results)
4. Read data from wrong sandbox's output files
5. **Root cause:** Model doesn't properly write files but claims success, then cross-contaminates with other runs

**GPT-5.1 Codex Mini Provided:**
- 15/15 summary fields (all present)
- 5 hooks with non-standard types (question, contrast, bold_statement, statistic, story)
- 4 angles without relevance scores
- 5 questions with depth categorization
- **Missing writing-kit.json** - hallucinated Step 3 completion

**GPT-5.1 Codex Mini Failure Analysis:**
1. Model executed summary step successfully (15/15 fields)
2. Model executed ideas step with non-standard hook types
3. Model invoked writing-kit-assembler skill
4. **Never called Write tool** for writing-kit.json
5. Claimed "The final writing kit JSON is available" but file never written
6. Returned StructuredOutput with `status: "success"` despite incomplete workflow
7. **Root cause:** Model skipped Write tool call for Step 3 output

**DeepSeek v3.2:**
- **FAILED** - No outputs generated
- Model returned "partial" status but did not execute skills

---

## Instruction Following Analysis

The writing-kit workflow specifies explicit requirements in `writing-kit.md`:

### Step 1: Summary (media-reviewer)

**Required Fields:** `contentId, headline, tldr, bullets, tags, sentiment, category, overview, keyThemes, detailedAnalysis, narrativeFlow, coreIdeas, importantQuotes, context, relatedConcepts`

| Field | GLM-4.7 | Gemini 3 | Grok 4.1 | Reasoner | MiMo v2 | GPT-5.1 | Doubao | M2.1 | GLM-4.6v | DeepSeek v3 |
|-------|---------|----------|----------|----------|---------|---------|--------|------|----------|-------------|
| contentId | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| headline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| tldr | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| bullets | ✅ 7 | ✅ 6 | ✅ 6 | ✅ 7 | ✅ 7 | ✅ 5 | ✅ 6 | ❌ | ❌ | ❌ |
| tags | ✅ 9 | ✅ 6 | ✅ 6 | ✅ 7 | ✅ 7 | ✅ 5 | ✅ 5 | ❌ | ❌ | ❌ |
| sentiment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| category | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| overview | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| keyThemes | ✅ 5 | ✅ 4 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ | ❌ | ❌ |
| detailedAnalysis | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| narrativeFlow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| coreIdeas | ✅ 4 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ❌ | ❌ | ❌ |
| importantQuotes | ✅ 7 | ✅ 3 | ✅ 4 | ✅ 4 | ✅ 7 | ✅ 3 | ✅ 4 | ✅ 3 | ❌ | ❌ |
| context | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| relatedConcepts | ✅ 15 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 10 | ✅ 4 | ✅ 5 | ❌ | ❌ | ❌ |

**Score:** GLM-4.7: 15/15 (100%) | Gemini 3: 15/15 (100%) | Grok 4.1: 15/15 (100%) | Reasoner: 14/15 (93%) | MiMo v2: 15/15 (100%) | GPT-5.1: 15/15 (100%) | Doubao: 15/15 (100%) | M2.1: 5/15 (33%) | GLM-4.6v: 0/15 (0%) | DeepSeek v3: 0/15 (0%)

### Step 2: Ideas (idea-synthesis)

**Required:** 5 hook types, angles with relevance scores, questions by depth

| Requirement | GLM-4.7 | Gemini 3 | Grok 4.1 | Reasoner | MiMo v2 | GPT-5.1 | Doubao | M2.1 | GLM-4.6v | DeepSeek v3 |
|-------------|---------|----------|----------|----------|---------|---------|--------|------|----------|-------------|
| Hook: emotional | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hook: curiosity | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Hook: controversy | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hook: statistic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Hook: story | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Relevance scores | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Question categories | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |

**Score:** GLM-4.7: 7/7 (100%) | Gemini 3: 7/7 (100%) | Grok 4.1: 7/7 (100%) | Reasoner: 7/7 (100%) | MiMo v2: 3/7 (43%) | GPT-5.1: 3/7 (43%) | Doubao: 0/7 (0%) | M2.1: 4/7 (57%) | GLM-4.6v: 4/7 (57%) | DeepSeek v3: 0/7 (0%)

### Step 3: Writing-Kit (assembler)

**Required:** Combined output with outline and meta

| Requirement | GLM-4.7 | Gemini 3 | Grok 4.1 | Reasoner | MiMo v2 | GPT-5.1 | Doubao | M2.1 | GLM-4.6v | DeepSeek v3 |
|-------------|---------|----------|----------|----------|---------|---------|--------|------|----------|-------------|
| Combined output | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Suggested outline | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Word estimates | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Meta information | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

**Score:** All passing models performed adequately on assembly. GPT-5.1 hallucinated completion (claimed success without writing file).

---

## Detailed Analysis

### GLM-4.7 Strengths

1. **Complete Compliance:** Followed all workflow instructions precisely
2. **Rich Analysis:** Multi-paragraph breakdowns with narrative insights
3. **Creative Variety:** All 5 hook types with distinct emotional approaches
4. **Quantified Relevance:** Scores help prioritize content angles
5. **Exploration Support:** Related concepts enable research expansion

### Gemini 3 Flash Strengths

1. **Complete Compliance:** Matched GLM-4.7 with 100% instruction following
2. **Balanced Analysis:** Good mix of technical detail and accessibility
3. **All Hook Types:** Complete coverage of required hook variety
4. **Strong Relevance Scores:** 0.82-0.95 range for prioritization
5. **Efficient Output:** Comprehensive yet more concise than GLM-4.7

### Grok 4.1 Fast Strengths

1. **Complete Compliance:** Full 100% instruction following
2. **All Hook Types:** All 5 required types in object format
3. **Relevance Scoring:** 6-9 scale provides clear prioritization
4. **Good Question Categorization:** All types (analytical, practical, philosophical, comparative)
5. **Efficient Execution:** Fast processing with complete outputs

### DeepSeek Reasoner Strengths

1. **Near-Complete Compliance:** Only missing one field (`context`)
2. **All Hook Types:** All 5 required types present with distinct approaches
3. **Strong Relevance Scores:** 0.6-0.9 range for angle prioritization
4. **Rich Analysis:** Comprehensive detailedAnalysis with narrative breakdown
5. **Question Depth Levels:** Uses depth alongside type for better categorization

### DeepSeek Reasoner Weaknesses

1. **Missing Context Field:** The only missing summary field (14/15)
2. **Otherwise Minor:** No significant issues with output quality

### MiMo v2 Flash Strengths

1. **Excellent Summary Generation:** 100% compliance on summary fields
2. **Rich Detail:** Comprehensive detailedAnalysis and overview
3. **Many Quotes:** 7 quotes with full context (tied with GLM-4.7)
4. **Creative Hooks:** Innovative types like "question", "contrast", "bold statement"
5. **Related Concepts:** 10 items for research expansion

### MiMo v2 Flash Weaknesses

1. **Non-Standard Hook Types:** Uses creative types not in spec (question, contrast, bold statement)
2. **No Relevance Scores:** Cannot prioritize angles quantitatively
3. **Question Format:** Uses "depth" instead of "type" for categorization

### MiniMax M2.1 Strengths

1. **Structured Outline:** Unique `suggestedOutline` with section word estimates
2. **Question Organization:** Categories (analytical, practical, philosophical, comparative)
3. **Concise Output:** Faster to scan for quick reference
4. **Workflow Meta:** Included version and completion status

### MiniMax M2.1 Weaknesses

1. **Missing Core Fields:** 10 of 15 summary fields absent
2. **Limited Hooks:** Only 3 of 5 required types
3. **No Relevance Scoring:** Cannot prioritize angles
4. **Shallow Analysis:** No detailed narrative breakdown
5. **No Context:** Missing reader assumption analysis

### GLM-4.6v Failure Analysis

1. **Hallucinated Completion:** Model claimed to execute summary step but file was never written
2. **Cross-Contamination:** When file not found, searched OTHER sandboxes and found DeepSeek Reasoner's output
3. **Wrong Data Used:** Ideas step was based on another model's summary (from sandbox ac0a)
4. **Root Cause:** Model doesn't properly write files to disk, then searches globally for expected files
5. **Critical Bug:** Output may contain cross-contaminated data from other workflow runs
6. **Not Suitable:** For production use due to unreliable file operations

### DeepSeek v3.2 Failure Analysis

1. **Model Behavior Issue:** Describes workflow execution but doesn't actually invoke Skill tool
2. **Status Returned:** "partial" - indicating incomplete execution
3. **No Outputs Generated:** Empty outputs directory
4. **Root Cause:** Model doesn't properly execute inline skill patterns
5. **Not Suitable:** For Looplia inline skill execution workflows

---

## Sample Output Comparison

### GLM-4.7 detailedAnalysis (excerpt)
```
"The article opens with a strong thesis about AI's fundamental
transformation of healthcare, then systematically explores four
key application areas. The Diagnostic Revolution section highlights
AI's superior speed and accuracy in imaging analysis, noting that
systems achieve 95%+ accuracy in detecting breast and lung cancers
while processing images in seconds versus 15 minutes for human
radiologists..."
```

### Gemini 3 Flash hook (emotional)
```json
{
  "text": "Imagine a world where 'I'm sorry, we caught it too late' is a phrase of the past.",
  "type": "emotional"
}
```

### Grok 4.1 Fast hook (emotional)
```json
{
  "text": "Imagine a world where your doctor knows your disease risk years before symptoms appear – that's the promise of AI in healthcare.",
  "type": "emotional"
}
```

### DeepSeek Reasoner hook (controversy)
```json
{
  "text": "AI isn't making medicine better - it's creating a healthcare system where machines make life-or-death decisions without human oversight.",
  "type": "controversy"
}
```

### MiMo v2 Flash hook (non-standard)
```json
{
  "text": "What if your next cancer diagnosis comes from an AI that sees what human doctors miss?",
  "type": "question"
}
```
Note: MiMo uses creative types like "question", "contrast", "bold statement" instead of the specified types.

### MiniMax M2.1 tldr (complete)
```
"AI-powered diagnostic imaging now achieves 95%+ accuracy in cancer
detection, processing images in seconds rather than minutes. Drug
discovery timelines are shrinking from 15 years to months through
machine learning..."
```

---

## Recommendation

### Tier 1: Production Ready (95-100% Compliance)

**Use any of these models:**
- **GLM-4.7** (`ZENMUX_ZAI_GLM47` preset) - 100%
- **Gemini 3 Flash** (`ZENMUX_GOOGLE_GEMINI3FLASH` preset) - 100%
- **Grok 4.1 Fast** (`ZENMUX_XAI_GROK41FAST` preset) - 100%
- **DeepSeek Reasoner** (`ZENMUX_DEEPSEEK_REASONER` preset) - ~95%

- Complete instruction following ensures workflow validation passes
- Rich output provides comprehensive writing material
- All hook types enable diverse content approaches
- Relevance scores help prioritize for user interests
- DeepSeek Reasoner only missing `context` field (minor)

### Tier 2: Good for Summaries (~82% Compliance)

**Use MiMo v2 Flash** (`ZENMUX_XIAOMI_MIMOV2FLASH` preset)

- Excellent summary generation with all 15 fields
- Rich detail and comprehensive analysis
- Creative hook types (may need post-processing for spec compliance)
- Good choice when summary quality is priority over strict hook types

### Tier 3: Quick Summaries Only (~35% Compliance)

**MiniMax M2.1** (`ZENMUX_MINIMAX_M21` preset) can be used when:
- Only basic summary is needed
- Output validation is disabled
- Speed is prioritized over completeness
- Structured outlines with word counts are valued

### Not Recommended

**GLM-4.6v** (`ZENMUX_ZAI_GLM46V` preset) - ~25% Compliance
- Critical cross-contamination bug: hallucinated file writes
- Model claims success but files never written to disk
- Searches other sandboxes and uses wrong model's outputs
- Ideas output may be based on another model's summary data
- Not suitable for any production use

**DeepSeek v3.2** (`ZENMUX_DEEPSEEK_V32` preset) - 0% Compliance
- Model does not properly execute inline skills
- Returns "partial" status without generating outputs
- Not suitable for Looplia workflow execution

---

## Configuration Commands

```bash
# Set GLM-4.7 (Production Ready - 100%)
looplia config provider preset ZENMUX_ZAI_GLM47

# Set Gemini 3 Flash (Production Ready - 100%)
looplia config provider preset ZENMUX_GOOGLE_GEMINI3FLASH

# Set Grok 4.1 Fast (Production Ready - 100%)
looplia config provider preset ZENMUX_XAI_GROK41FAST

# Set DeepSeek Reasoner (Production Ready - ~95%)
looplia config provider preset ZENMUX_DEEPSEEK_REASONER

# Set MiMo v2 Flash (Good for summaries)
looplia config provider preset ZENMUX_XIAOMI_MIMOV2FLASH

# Set MiniMax M2.1 (Quick summaries)
looplia config provider preset ZENMUX_MINIMAX_M21

# Verify configuration
looplia config provider show
```

---

## Appendix: Complete Compliance Matrix

| Workflow Requirement | GLM-4.7 | Gemini 3 | Grok 4.1 | Reasoner | MiMo v2 | GPT-5.1 | Doubao | M2.1 | GLM-4.6v | DeepSeek v3 |
|---------------------|---------|----------|----------|----------|---------|---------|--------|------|----------|-------------|
| contentId | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| headline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| tldr | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| bullets (5+) | ✅ 7 | ✅ 6 | ✅ 6 | ✅ 7 | ✅ 7 | ✅ 5 | ✅ 6 | ❌ | ❌ | ❌ |
| tags | ✅ 9 | ✅ 6 | ✅ 6 | ✅ 7 | ✅ 7 | ✅ 5 | ✅ 5 | ❌ | ❌ | ❌ |
| sentiment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| category | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| overview | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| keyThemes | ✅ 5 | ✅ 4 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ | ❌ | ❌ |
| detailedAnalysis | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| narrativeFlow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| coreIdeas | ✅ 4 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 5 | ❌ | ❌ | ❌ |
| importantQuotes (3+) | ✅ 7 | ✅ 3 | ✅ 4 | ✅ 4 | ✅ 7 | ✅ 3 | ✅ 4 | ✅ 3 | ❌ | ❌ |
| context | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| relatedConcepts | ✅ 15 | ✅ 5 | ✅ 5 | ✅ 5 | ✅ 10 | ✅ 4 | ✅ 5 | ❌ | ❌ | ❌ |
| hooks (5 types) | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | ❌ 2/5* | ❌ 2/5* | ❌ 0/5 | ❌ 3/5 | ❌ 2/5* | ❌ 0/5 |
| angles with scores | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| questions by type | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| suggestedOutline | ✅ | ✅ | ✅ | ✅ | ✅ | ❌** | ❌ | ✅ | ❌ | ❌ |
| **Summary Score** | **100%** | **100%** | **100%** | **93%** | **100%** | **100%** | **100%** | **33%** | **0%** | **0%** |
| **Ideas Score** | **100%** | **100%** | **100%** | **100%** | **43%** | **43%** | **0%** | **57%** | **57%** | **0%** |
| **Overall Score** | **100%** | **100%** | **100%** | **~95%** | **~82%** | **~65%** | **~50%** | **~35%** | **~25%** | **0%** |

*MiMo v2 Flash, GPT-5.1 Codex Mini, and GLM-4.6v have 5 hooks but use creative types (question, contrast, bold statement) instead of spec types (emotional, curiosity, controversy)
**GPT-5.1 Codex Mini hallucinated Step 3 completion - invoked assembler skill but never wrote writing-kit.json file
