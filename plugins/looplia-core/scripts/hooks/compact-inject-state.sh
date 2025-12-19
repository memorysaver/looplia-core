#!/bin/bash
# Context Compact State Injection Hook (v0.6.0)
# Triggered: When context is compacted (SessionStart:compact)
# Action: Re-inject current sandbox progress into new context

set -euo pipefail

# Find active sandbox
SANDBOX_BASE="${HOME}/.looplia/sandbox"
if [[ ! -d "$SANDBOX_BASE" ]]; then
  exit 0
fi

# Sort by modification time (newest first) to get most recent sandbox
SANDBOX_DIR=$(ls -td "$SANDBOX_BASE"/*/ 2>/dev/null | head -1 | sed 's:/$::')
if [[ -z "$SANDBOX_DIR" ]]; then
  exit 0
fi

VALIDATION_JSON="$SANDBOX_DIR/validation.json"
SANDBOX_ID=$(basename "$SANDBOX_DIR")

if [[ ! -f "$VALIDATION_JSON" ]]; then
  exit 0
fi

WORKFLOW=$(jq -r '.workflow // "unknown"' "$VALIDATION_JSON")

# Build progress summary (v0.6.0 uses "steps" not "outputs")
echo "=== Active Sandbox: $SANDBOX_ID ==="
echo "Workflow: $WORKFLOW"
echo ""
echo "Progress:"
jq -r '.steps | to_entries[] | "  - \(.key): \(if .value.validated then "✓ validated" else "⏳ pending" end)"' "$VALIDATION_JSON"
echo ""
echo "Next: Complete pending steps in dependency order."
