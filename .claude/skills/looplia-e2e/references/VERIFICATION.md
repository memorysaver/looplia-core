# E2E Test Verification Guide

This document provides detailed verification steps for looplia E2E tests.

## Verification Categories

### 1. Workflow Output Verification

After running a workflow, verify these outputs exist in the sandbox:

```
~/.looplia/sandbox/<run-id>/
├── outputs/
│   ├── summary.json      # Stage 1: Content analysis
│   ├── ideas.json        # Stage 2: Idea generation
│   └── writing-kit.json  # Stage 3: Final output
├── validation.json       # Step validation state
└── logs/
    └── *.log             # Execution logs
```

#### summary.json (Stage 1)
```json
{
  "contentId": "string",
  "title": "string",
  "keyPoints": ["string"],
  "themes": ["string"],
  "targetAudience": "string"
}
```

#### ideas.json (Stage 2)
```json
{
  "hooks": [
    {
      "type": "question|statistic|story|contrast",
      "text": "string",
      "targetEmotion": "string"
    }
  ],
  "angles": ["string"],
  "keyMessages": ["string"]
}
```

#### writing-kit.json (Stage 3)
```json
{
  "contentId": "string",
  "summary": { /* from Stage 1 */ },
  "ideas": { /* from Stage 2 */ },
  "suggestedOutline": [
    {
      "section": "string",
      "purpose": "string",
      "keyPoints": ["string"]
    }
  ]
}
```

### 2. Validation State Verification

The `validation.json` file tracks step completion:

```json
{
  "workflowId": "writing-kit",
  "runId": "string",
  "steps": {
    "summary": {
      "validated": true,
      "timestamp": "ISO8601"
    },
    "ideas": {
      "validated": true,
      "timestamp": "ISO8601"
    },
    "writing-kit": {
      "validated": true,
      "timestamp": "ISO8601"
    }
  }
}
```

All three steps must have `validated: true`.

### 3. Subagent Usage Verification (v0.6.9+)

The v0.6.9 architecture uses `general-purpose` subagent for all workflow steps.

Check log files for:
```
"subagent_type": "general-purpose"
```

Should appear at least 3 times (once per workflow step).

**Legacy agents to verify are NOT used:**
- `content-analyzer`
- `idea-generator`
- `writing-kit-builder`
- `skill-executor`

### 4. v0.6.10 Command Init Verification

Verify unified command initialization works correctly:

1. **Mock mode without API key**: Should succeed
   ```bash
   unset ANTHROPIC_API_KEY
   unset ZENMUX_API_KEY
   looplia build --mock "test"  # Should not fail
   ```

2. **ZenMux API key mapping**: Should work with preset
   ```bash
   export ZENMUX_API_KEY=xxx
   looplia config provider preset ZENMUX_ZAI_GLM47
   looplia build --mock "test"  # Should use ZenMux
   ```

3. **Error messages**: Should list all options
   ```
   Error: API key required

   Options:
     1. Set ANTHROPIC_API_KEY environment variable
     2. Set ZENMUX_API_KEY with a ZenMux preset
     3. Configure via: looplia config provider preset <name>
     4. Use --mock flag for testing without API
   ```

### 5. Quality Metrics

Minimum thresholds for a passing test:

| Metric | Minimum | Description |
|--------|---------|-------------|
| Hook count | 2 | Number of hooks in ideas.json |
| Outline sections | 3 | Number of sections in writing-kit.json |
| Task tool invocations | 3 | Number of Task tool calls in logs |
| general-purpose count | 3 | Number of subagent invocations |

## Verification Commands

### Quick Verification
```bash
# Source common functions
source scripts/verify-workflow.sh

# Find latest sandbox
SANDBOX=$(find ~/.looplia/sandbox -maxdepth 1 -type d ! -name sandbox | head -1)

# Run all verifications
verify_outputs "$SANDBOX"
verify_validation_state "$SANDBOX"
verify_subagent_usage "$SANDBOX"
```

### Manual Checks
```bash
# Check outputs exist
ls -la ~/.looplia/sandbox/*/outputs/

# Validate JSON schema
jq '.contentId and .summary and .ideas and .suggestedOutline' \
  ~/.looplia/sandbox/*/outputs/writing-kit.json

# Count hooks
jq '.ideas.hooks | length' ~/.looplia/sandbox/*/outputs/writing-kit.json

# Check validation state
jq '.steps | to_entries | map(select(.value.validated == true)) | length' \
  ~/.looplia/sandbox/*/validation.json
```

## Success Criteria

A successful E2E test must:

- [ ] All three output files exist (summary.json, ideas.json, writing-kit.json)
- [ ] writing-kit.json passes schema validation
- [ ] All three workflow steps validated in validation.json
- [ ] At least 3 general-purpose subagent invocations
- [ ] No legacy agents used
- [ ] Hook count >= 2
- [ ] Outline sections >= 3
