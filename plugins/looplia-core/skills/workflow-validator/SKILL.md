---
name: workflow-validator
description: Validate workflow outputs against criteria defined in validation.json.
  Use after each step completes to verify output meets requirements.
---

# Workflow Validator Skill

Validates JSON artifacts against validation criteria using deterministic script execution.

## What This Skill Does

- Reads validation criteria from `sandbox/{id}/validation.json`
- Runs deterministic validation script (no LLM tokens consumed)
- Returns pass/fail status with detailed check results
- Enables workflow completion verification

## When to Use

Use this skill **after each workflow step** produces an artifact:
1. Subagent writes artifact (e.g., `summary.json`)
2. Invoke workflow-validator skill to validate
3. Check results and retry if validation fails
4. Continue to next step only when validation passes

## Validation Process

### Step 1: Read Validation Criteria

Read the validation manifest at `sandbox/{id}/validation.json`:

```json
{
  "workflow": "writing-kit",
  "outputs": {
    "summary": {
      "artifact": "summary.json",
      "criteria": {
        "required_fields": ["contentId", "headline", "tldr", "keyThemes"],
        "min_quotes": 3,
        "min_key_points": 5
      },
      "validated": false
    }
  }
}
```

### Step 2: Run Validation Script

Execute the validation script with artifact path and criteria:

```bash
bun scripts/validate.ts <artifact-path> '<criteria-json>'
```

Example:
```bash
bun scripts/validate.ts sandbox/podcast-2024-12-08-ai/outputs/summary.json '{"required_fields":["contentId","headline"],"min_quotes":3}'
```

### Step 3: Parse Results

The script returns JSON with pass/fail and individual checks:

```json
{
  "passed": true,
  "checks": [
    { "name": "has_contentId", "passed": true, "message": "OK" },
    { "name": "has_headline", "passed": true, "message": "OK" },
    { "name": "min_quotes", "passed": true, "message": "Found 5 quotes (min: 3)" }
  ]
}
```

### Step 4: Handle Results

**If validation passes:**
- Update `validation.json` to set `validated: true` for this output
- Continue to next workflow step

**If validation fails:**
- Review failed checks
- Either retry the subagent with feedback
- Or report the issue to the user

## Validation Criteria Reference

### required_fields
Array of field names that must exist in the artifact:
```json
"required_fields": ["contentId", "headline", "tldr"]
```

### min_quotes
Minimum number of items in `importantQuotes` array:
```json
"min_quotes": 3
```

### min_key_points
Minimum number of items in `bullets` or key points array:
```json
"min_key_points": 5
```

### min_outline_sections
Minimum number of outline sections:
```json
"min_outline_sections": 4
```

### has_hooks
Requires `hooks` array with at least one item:
```json
"has_hooks": true
```

## Output Format

The validation script returns:

```json
{
  "passed": boolean,
  "checks": [
    {
      "name": "check_name",
      "passed": boolean,
      "message": "Human-readable result"
    }
  ]
}
```

## Important Rules

- **Always run after artifact creation** - Never skip validation
- **Script is deterministic** - No LLM context consumed
- **Update validation.json** - Mark outputs validated when passed
- **Retry on failure** - Give subagent feedback on what failed
- **Check dependencies** - Ensure required outputs are validated before dependent steps
- **Use exact paths** - Artifact paths are relative to workspace root

## Script Location

The validation script is at:
```
.claude/skills/workflow-validator/scripts/validate.ts
```

Run with Bun for TypeScript execution:
```bash
bun .claude/skills/workflow-validator/scripts/validate.ts <artifact> '<criteria>'
```
