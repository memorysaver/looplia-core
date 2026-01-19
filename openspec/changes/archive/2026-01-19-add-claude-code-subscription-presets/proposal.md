# Proposal: Add Claude Code Subscription Presets

## Summary

Add three new provider presets that leverage Claude Code's OAuth token stored in macOS Keychain, enabling users to use their existing Claude subscription instead of paying for separate API credits.

**New Presets:**
- `CLAUDE_CODE_SUBSCRIPTION_HAIKU` - All models point to latest Haiku
- `CLAUDE_CODE_SUBSCRIPTION_SONNET` - All models point to latest Sonnet
- `CLAUDE_CODE_SUBSCRIPTION_OPUS` - All models point to latest Opus

## Motivation

Users who have a Claude subscription via Claude Code already have valid OAuth credentials stored in macOS Keychain. Currently, looplia requires users to set up separate API keys (via `ANTHROPIC_API_KEY` or `ZENMUX_API_KEY`), which means paying for API usage on top of their existing subscription.

This feature allows subscription-based authentication as a first-class option, reducing friction and cost for Claude Code users.

## User Flow

```bash
# Use subscription with Haiku (cost-effective)
looplia config provider preset CLAUDE_CODE_SUBSCRIPTION_HAIKU

# Use subscription with Opus (highest capability)
looplia config provider preset CLAUDE_CODE_SUBSCRIPTION_OPUS

# Check status - shows auth source
looplia config provider show
# Output includes: Auth Source: macOS Keychain (Claude Code)
```

## Scope

### In Scope
- New `authTokenSource` field in preset and settings types
- Three new subscription presets reading from macOS Keychain
- `readKeychainToken()` function using `security` CLI
- Updated CLI help text and provider status display
- Error handling for non-macOS and missing credentials

### Out of Scope
- Windows/Linux Keychain support (future enhancement)
- OAuth token refresh logic (handled by Claude Code)
- Subscription tier validation

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| macOS-only feature | Clear error message suggesting manual `CLAUDE_CODE_OAUTH_TOKEN` |
| Keychain access failures | Graceful degradation with warning; user can still use API keys |
| Token expiration | SDK returns auth error; user re-authenticates in Claude Code |

## Dependencies

- Claude Code must be installed and authenticated
- macOS Keychain must be accessible
- `security` CLI (bundled with macOS)
