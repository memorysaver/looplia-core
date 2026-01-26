# Proposal: Add Validation System Documentation

## Summary

Add a comprehensive documentation page to `apps/docs` explaining how the looplia validation system works - the mechanism that ensures workflows complete all steps before stopping.

## Problem Statement

Current documentation gaps:

1. **understanding-workflows.mdx** - Briefly mentions `validate` field but doesn't explain how validation works
2. **custom-workflows.mdx** - Shows validation examples without explaining the lifecycle
3. **sandbox.mdx** - Shows `validation.json` structure but doesn't explain the enforcement mechanism

Users don't understand:
- What happens when validation fails
- How the stop-guard prevents premature completion
- All available validation criteria types
- How validation.json tracks state

## Proposed Solution

Create a new documentation page `apps/docs/src/content/docs/reference/validation.mdx` that covers:

1. **Validation System Overview** - How hooks enforce workflow completion
2. **Validation Criteria Reference** - All supported criteria with examples
3. **Lifecycle Diagram** - Visual flow of validation process
4. **validation.json Structure** - State tracking explained
5. **Troubleshooting** - Common validation issues and fixes

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| New documentation page | Code changes to validation system |
| Update sidebar navigation | New validation criteria types |
| Cross-reference from existing pages | API documentation |

## Success Criteria

- New page accessible at `/reference/validation/`
- All 5 validation criteria types documented with examples
- Lifecycle diagram shows hook flow
- Cross-links from understanding-workflows.mdx and sandbox.mdx
