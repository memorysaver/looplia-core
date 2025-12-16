# Looplia-Core Documentation

> **Version:** 0.5.0
> **Last Updated:** December 2024

This directory contains the core documentation for Looplia-Core, a Claude Agent SDK-based writing assistant.

---

## Core Documents (Latest)

These are the current, authoritative documents for the v0.5.0 architecture:

| Document | Purpose | Audience |
|----------|---------|----------|
| [AGENTIC_CONCEPT-0.3.md](./AGENTIC_CONCEPT-0.3.md) | Claude Agent SDK design, Pipeline-as-Configuration, Session Manifest | Architects, System Designers |
| [TEST_PLAN-0.3.md](./TEST_PLAN-0.3.md) | Test architecture, Husky workflow, CI/CD, LLM-as-Judge | QA, Developers |
| [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) | Base architecture: folder structure, command framework, streaming events | Developers, Architects |
| [GLOSSARY.md](./GLOSSARY.md) | Ubiquitous language reference (domain terms + TypeScript types) | All team members |
| [AGENT-SKILLS.md](./AGENT-SKILLS.md) | Anthropic official Agent Skills documentation (reference) | Developers |

---

## Document Overview

### AGENTIC_CONCEPT-0.3.md

The v0.5.0 agent system design document covering:

- **Pipeline-as-Configuration** - Declarative YAML workflow definitions
- **Session Manifest** - `session.json` for manifest-based state tracking
- **Execution Cycle** - 7-layer flow with pipeline awareness
- **Call Stack Concept** - Hierarchical execution with 4 stack frames
- **Skills** - Filesystem-based capabilities (SDK convention: `.claude/skills/`)
- **Smart Continuation** - Manifest-based state tracking with dual verification

### TEST_PLAN-0.3.md

The v0.5.0 test strategy document covering:

- **Test Architecture** - Test pyramid aligned with Clean Architecture
- **Test Inventory** - 18 test files across CLI, Core, Provider packages
- **CLI Commands** - Updated for `init`, `run`, `config` commands
- **Docker E2E** - Container testing with real API calls
- **LLM-as-Judge** - Semantic evaluation with Claude

### DESIGN-0.4.0.md

The base architecture document covering:

- **Executive Summary** - Clean Architecture redesign overview
- **Architecture Overview** - Layer diagram and data flow
- **CLI Package Structure** - File-level documentation of `apps/cli/src/`
- **Core Package Structure** - File-level documentation of `packages/core/src/`
- **Provider Package Structure** - File-level documentation of `packages/provider/src/`
- **Command Framework** - CommandDefinition, AgentExecutor, StreamingEvent
- **Streaming Event System** - 12 event types for real-time TUI
- **Adding a New Command** - Step-by-step guide

### GLOSSARY.md

Ubiquitous language reference organized into 10 categories covering domain concepts, architecture layers, command framework, agent system, streaming events, and more.

### AGENT-SKILLS.md

Reference document containing the official Anthropic documentation for Agent Skills, including skill structure, SDK integration, and discovery mechanisms.

---

## Historical Documents

Previous versions are preserved for reference:

| Document | Version | Notes |
|----------|---------|-------|
| [AGENTIC_CONCEPT-0.2.md](./AGENTIC_CONCEPT-0.2.md) | v0.2 | Pre-pipeline agent design |
| [TEST_PLAN-0.2.md](./TEST_PLAN-0.2.md) | v0.2 | Pre-v0.5.0 test plan |
| [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) | v0.4.0 | CommandDefinition abstraction, Clean Architecture |
| [TEST_PLAN-0.1.md](./TEST_PLAN-0.1.md) | v0.1 | Original test plan (pre-v0.4.0) |
| [AGENTIC_CONCEPT-0.1.md](./AGENTIC_CONCEPT-0.1.md) | v0.1 | Original agentic architecture concept |
| [DESIGN-0.3.4.1.md](./DESIGN-0.3.4.1.md) | v0.3.4.1 | Pre-refactor streaming design |
| [DESIGN-0.3.4.0.md](./DESIGN-0.3.4.0.md) | v0.3.4.0 | SDK integration design |
| [DESIGN-0.3.3.md](./DESIGN-0.3.3.md) | v0.3.3 | Test plan integration |
| [DESIGN-0.3.2.md](./DESIGN-0.3.2.md) | v0.3.2 | Plugin system design |
| [DESIGN-0.3.1.md](./DESIGN-0.3.1.md) | v0.3.1 | TUI streaming design |
| [DESIGN-0.3.0.md](./DESIGN-0.3.0.md) | v0.3.0 | Clean Architecture migration |
| [DESIGN-0.2.md](./DESIGN-0.2.md) | v0.2 | Domain model refinement |
| [DESIGN-0.1.md](./DESIGN-0.1.md) | v0.1 | Initial architecture |

---

## Quick Links

### For New Contributors

1. Start with [GLOSSARY.md](./GLOSSARY.md) to understand the terminology
2. Read [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) for base architecture overview
3. Review [AGENTIC_CONCEPT-0.3.md](./AGENTIC_CONCEPT-0.3.md) for the agent system design

### For Developers

- Adding a new command? See [DESIGN-0.4.0.md § Adding a New Command](./DESIGN-0.4.0.md#9-adding-a-new-command-step-by-step)
- Understanding Pipeline-as-Configuration? See [AGENTIC_CONCEPT-0.3.md § Pipeline-as-Configuration](./AGENTIC_CONCEPT-0.3.md#3-pipeline-as-configuration)
- Understanding Skills? See [AGENT-SKILLS.md](./AGENT-SKILLS.md)
- Running tests? See [TEST_PLAN-0.3.md](./TEST_PLAN-0.3.md)

### For Architects

- Pipeline-as-Configuration: [AGENTIC_CONCEPT-0.3.md § Pipeline-as-Configuration](./AGENTIC_CONCEPT-0.3.md#3-pipeline-as-configuration)
- Session state management: [AGENTIC_CONCEPT-0.3.md § Smart Continuation](./AGENTIC_CONCEPT-0.3.md#8-smart-continuation-manifest-based-state-tracking)
- Execution cycle: [AGENTIC_CONCEPT-0.3.md § The Execution Cycle](./AGENTIC_CONCEPT-0.3.md#4-the-execution-cycle)
- Call stack concept: [AGENTIC_CONCEPT-0.3.md § The Call Stack Concept](./AGENTIC_CONCEPT-0.3.md#5-the-call-stack-concept)
- Clean Architecture mapping: [DESIGN-0.4.0.md § Clean Architecture Mapping](./DESIGN-0.4.0.md#8-clean-architecture-mapping)

---

## Document Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT RELATIONSHIPS                               │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │  GLOSSARY.md │
                              │  (Terms)     │
                              └──────┬───────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌───────────────┐
    │ AGENTIC_        │    │ DESIGN-0.4.0.md │    │TEST_PLAN-0.3 │
    │ CONCEPT-0.3     │    │ (Architecture)  │    │  (Testing)   │
    │ (Agent Design)  │    └────────┬────────┘    └──────────────┘
    └────────┬────────┘             │
             │                      │
             │                      ▼
             │             ┌─────────────────┐
             └────────────►│ AGENT-SKILLS.md │
                           │ (SDK Reference) │
                           └─────────────────┘
```

- **GLOSSARY.md** defines terms used across all documents
- **AGENTIC_CONCEPT-0.3.md** documents the agent design with Pipeline-as-Configuration
- **DESIGN-0.4.0.md** documents the base implementation architecture
- **AGENT-SKILLS.md** provides the Anthropic SDK reference
- **TEST_PLAN-0.3.md** covers testing strategy for v0.5.0

---

*This README provides navigation for Looplia-Core v0.5.0 documentation.*
