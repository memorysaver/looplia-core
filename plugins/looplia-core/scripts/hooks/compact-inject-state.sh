#!/bin/bash
# Context Compact State Injection Hook
# Triggered: When context is compacted (SessionStart:compact)
# Action: Re-inject current sandbox progress into new context

set -euo pipefail

# Find active sandbox
SANDBOX_BASE="${HOME}/.looplia/sandbox"
if [[ ! -d "$SANDBOX_BASE" ]]; then
  exit 0
fi

SANDBOX_DIR=$(find "$SANDBOX_BASE" -maxdepth 1 -type d ! -name "sandbox" 2>/dev/null | head -1)
if [[ -z "$SANDBOX_DIR" ]]; then
  exit 0
fi

VALIDATION_JSON="$SANDBOX_DIR/validation.json"
SANDBOX_ID=$(basename "$SANDBOX_DIR")

if [[ ! -f "$VALIDATION_JSON" ]]; then
  exit 0
fi

WORKFLOW=$(jq -r '.workflow // "unknown"' "$VALIDATION_JSON")

# Build progress summary
echo "=== Active Sandbox: $SANDBOX_ID ==="
echo "Workflow: $WORKFLOW"
echo ""
echo "Progress:"
jq -r '.outputs | to_entries[] | "  - \(.key): \(if .value.validated then "✓ validated" else "⏳ pending" end)"' "$VALIDATION_JSON"
echo ""
echo "Next: Complete pending outputs in dependency order."
