# Writing-Kit Workflow: Model Performance Report

**Date:** 2025-12-27
**Workflow:** `writing-kit` v1.1.0
**Test Content:** `examples/ai-healthcare.md`
**Looplia Version:** v0.6.6

---

## Executive Summary

This report compares two ZenMux models for the writing-kit workflow:

| Model | Provider | Recommendation |
|-------|----------|----------------|
| **GLM-4.7** (`z-ai/glm-4.7`) | ZenMux | **Recommended for production** |
| MiniMax M2.1 (`minimax/minimax-m2.1`) | ZenMux | Suitable for quick summaries only |

**Key Finding:** GLM-4.7 achieved 100% instruction compliance with 9x more content output, while MiniMax M2.1 achieved only 35% compliance with significant missing fields.

---

## Test Configuration

```bash
# GLM-4.7 Test
looplia config provider preset ZENMUX_ZAI_GLM47
looplia run writing-kit --file examples/ai-healthcare.md

# MiniMax M2.1 Test
looplia config provider preset ZENMUX_MINIMAX_M21
looplia run writing-kit --file examples/ai-healthcare.md
```

**Environment:**
- API Provider: ZenMux (`https://zenmux.ai/api/anthropic`)
- Both main and executor agents used the same model
- Same input content for fair comparison

---

## Output Quality Comparison

### Content Volume

| Metric | GLM-4.7 | MiniMax M2.1 | Difference |
|--------|---------|--------------|------------|
| Total Output Size | 27 KB | ~3 KB | **9x more** |
| Output Files | 3 (summary, ideas, writing-kit) | 1 (combined) | - |
| Quotes Extracted | 7 | 3 | 2.3x more |
| Hooks Generated | 5 | 3 | 1.7x more |
| Angles Created | 4+ | 5 | Similar |
| Related Concepts | 15 | 0 | - |

### Content Richness

**GLM-4.7 Provided:**
- Multi-paragraph `detailedAnalysis` with narrative breakdown
- `narrativeFlow` analysis describing content arc
- `coreIdeas` with concept, explanation, and examples
- `context` explaining assumed reader knowledge
- `relatedConcepts` for further exploration
- Relevance scores (0.78-0.92) on angles
- All 5 hook types (emotional, curiosity, controversy, statistic, story)

**MiniMax M2.1 Provided:**
- Basic `tldr` summary
- `keyThemes` list
- 3 quotes with minimal context
- 3 hook types (missing emotional, controversy)
- Angles without relevance scores
- `suggestedOutline` with word estimates (unique strength)

---

## Instruction Following Analysis

The writing-kit workflow specifies explicit requirements in `writing-kit.md`:

### Step 1: Summary (media-reviewer)

**Required Fields:** `contentId, headline, tldr, bullets, tags, sentiment, category, overview, keyThemes, detailedAnalysis, narrativeFlow, coreIdeas, importantQuotes, context, relatedConcepts`

| Field | GLM-4.7 | MiniMax M2.1 |
|-------|---------|--------------|
| contentId | ✅ | ✅ |
| headline | ✅ | ✅ |
| tldr | ✅ | ✅ |
| bullets | ✅ (7 items) | ❌ Missing |
| tags | ✅ (9 items) | ❌ Missing |
| sentiment | ✅ "positive" | ❌ Missing |
| category | ✅ "article" | ❌ Missing |
| overview | ✅ | ❌ Missing |
| keyThemes | ✅ (5 themes) | ✅ |
| detailedAnalysis | ✅ (multi-paragraph) | ❌ Missing |
| narrativeFlow | ✅ | ❌ Missing |
| coreIdeas | ✅ (4 with examples) | ❌ Missing |
| importantQuotes | ✅ (7 quotes) | ✅ (3 quotes) |
| context | ✅ | ❌ Missing |
| relatedConcepts | ✅ (15 items) | ❌ Missing |

**Score:** GLM-4.7: 15/15 (100%) | MiniMax M2.1: 5/15 (33%)

### Step 2: Ideas (idea-synthesis)

**Required:** 5 hook types, angles with relevance scores, questions by depth

| Requirement | GLM-4.7 | MiniMax M2.1 |
|-------------|---------|--------------|
| Hook: emotional | ✅ | ❌ Missing |
| Hook: curiosity | ✅ | ✅ |
| Hook: controversy | ✅ | ❌ Missing |
| Hook: statistic | ✅ | ✅ |
| Hook: story | ✅ | ✅ |
| Relevance scores | ✅ (0.78-0.92) | ❌ Missing |
| Question categories | ✅ | ✅ |

**Score:** GLM-4.7: 7/7 (100%) | MiniMax M2.1: 4/7 (57%)

### Step 3: Writing-Kit (assembler)

**Required:** Combined output with outline and meta

| Requirement | GLM-4.7 | MiniMax M2.1 |
|-------------|---------|--------------|
| Combined output | ✅ | ✅ |
| Suggested outline | ✅ | ✅ |
| Word estimates | ❌ | ✅ (unique strength) |
| Meta information | ✅ | ✅ |

**Score:** Both models performed adequately on assembly.

---

## Detailed Analysis

### GLM-4.7 Strengths

1. **Complete Compliance:** Followed all workflow instructions precisely
2. **Rich Analysis:** Multi-paragraph breakdowns with narrative insights
3. **Creative Variety:** All 5 hook types with distinct emotional approaches
4. **Quantified Relevance:** Scores help prioritize content angles
5. **Exploration Support:** Related concepts enable research expansion

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

### MiniMax M2.1 tldr (complete)
```
"AI-powered diagnostic imaging now achieves 95%+ accuracy in cancer
detection, processing images in seconds rather than minutes. Drug
discovery timelines are shrinking from 15 years to months through
machine learning..."
```

---

## Recommendation

### For Production Writing Workflows

**Use GLM-4.7** (`ZENMUX_ZAI_GLM47` preset)

- Complete instruction following ensures workflow validation passes
- Rich output provides comprehensive writing material
- All hook types enable diverse content approaches
- Relevance scores help prioritize for user interests

### For Quick Summaries Only

**MiniMax M2.1** can be used when:
- Only basic summary is needed
- Output validation is disabled
- Speed is prioritized over completeness
- Structured outlines with word counts are valued

---

## Configuration Commands

```bash
# Set GLM-4.7 (Recommended)
looplia config provider preset ZENMUX_ZAI_GLM47

# Set MiniMax M2.1 (Quick summaries)
looplia config provider preset ZENMUX_MINIMAX_M21

# Verify configuration
looplia config provider show
```

---

## Appendix: Complete Compliance Matrix

| Workflow Requirement | GLM-4.7 | M2.1 |
|---------------------|---------|------|
| contentId | ✅ | ✅ |
| headline | ✅ | ✅ |
| tldr | ✅ | ✅ |
| bullets (5+) | ✅ 7 | ❌ |
| tags | ✅ 9 | ❌ |
| sentiment | ✅ | ❌ |
| category | ✅ | ❌ |
| overview | ✅ | ❌ |
| keyThemes | ✅ 5 | ✅ |
| detailedAnalysis | ✅ | ❌ |
| narrativeFlow | ✅ | ❌ |
| coreIdeas | ✅ 4 | ❌ |
| importantQuotes (3+) | ✅ 7 | ✅ 3 |
| context | ✅ | ❌ |
| relatedConcepts | ✅ 15 | ❌ |
| hooks (5 types) | ✅ 5/5 | ❌ 3/5 |
| angles with scores | ✅ | ❌ |
| questions by type | ✅ | ✅ |
| suggestedOutline | ✅ | ✅ |
| **Total Compliance** | **100%** | **~35%** |
