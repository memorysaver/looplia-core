# Looplia-Core Documentation

> **Version:** 0.5.0
> **Last Updated:** December 2024

This directory contains the core documentation for Looplia-Core, a Claude Agent SDK-based writing assistant.

---

## Core Documents (Latest)

These are the current, authoritative documents for the v0.5.0 architecture:

| Document | Purpose | Audience |
|----------|---------|----------|
| [DESIGN-0.5.0.md](./DESIGN-0.5.0.md) | v0.5.0 improvements: Session Manifest, Validation, DisplayConfig decoupling | Developers, Architects |
| [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) | Base architecture: folder structure, command framework, streaming events | Developers, Architects |
| [AGENTIC_CONCEPT-0.2.md](./AGENTIC_CONCEPT-0.2.md) | Claude Agent SDK conceptual design, execution cycle, call stack, Skills | Architects, System Designers |
| [GLOSSARY.md](./GLOSSARY.md) | Ubiquitous language reference (domain terms + TypeScript types) | All team members |
| [AGENT-SKILLS.md](./AGENT-SKILLS.md) | Anthropic official Agent Skills documentation (reference) | Developers |
| [TEST_PLAN-0.2.md](./TEST_PLAN-0.2.md) | Test architecture, Husky workflow, CI/CD, LLM-as-Judge | QA, Developers |

---

## Document Overview

### DESIGN-0.5.0.md

The v0.5.0 architecture improvements document covering:

- **Problem Analysis** - Friction points from v0.4.0 (continuation fragility, missing validation, architecture leak)
- **Session Manifest System** - `session.json` for reliable state tracking with content hashes
- **Intermediate Artifact Validation** - Zod validation after each artifact write with retry hints
- **DisplayConfig Decoupling** - Moving presentation config from core to CLI layer
- **Updated Architecture Overview** - New files and layer responsibilities
- **Migration Strategy** - Legacy session migration and breaking change handling
- **Implementation Plan** - Phased approach with file-level details

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

### AGENTIC_CONCEPT-0.2.md

Conceptual design document focused on the Claude Agent SDK runtime model:

1. **Introduction** - SDK-based agent runtime vs traditional API
2. **Workspace** - File-based runtime environment (`~/.looplia/`)
3. **Execution Cycle** - 7-layer flow (CLI → Provider → Main Agent → Subagent → Skill → Return → CLI)
4. **Call Stack Concept** - Hierarchical execution with 4 stack frames
5. **Skills** - Filesystem-based capabilities (SKILL.md artifacts)
6. **Agent-to-Agent Communication** - File-based communication patterns
7. **Smart Continuation** - Agent-controlled flow with state checking
8. **Reference** - Anthropic official documentation summary

### GLOSSARY.md

Ubiquitous language reference organized into 10 categories:

1. Core Domain Concepts (ContentItem, WritingKit, etc.)
2. Architecture Layers (CLI, Core, Provider)
3. Command Framework (CommandDefinition, PromptContext, etc.)
4. Agent System (Main Agent, Subagent, Skill, Plugin)
5. Streaming Events (12 event types)
6. Runtime Concepts (Workspace, Session, CLAUDE.md)
7. Provider Concepts (AgentExecutor, SDK Config)
8. Workspace & Session (contentItem folder, Smart Continuation)
9. Result Patterns (CommandResult, Success/Error)
10. Writing Domain (WritingIdeas, OutlineSection, etc.)

### AGENT-SKILLS.md

Reference document containing the official Anthropic documentation for Agent Skills:

- Why use Skills (benefits, use cases)
- How Skills work (progressive disclosure, three-level loading)
- Skill structure (SKILL.md format, YAML frontmatter)
- SDK integration (TypeScript and Python examples)
- Skill locations and discovery
- Security considerations
- Troubleshooting guide

### TEST_PLAN-0.2.md

Comprehensive test strategy document aligned with v0.4.0 architecture:

1. **Test Architecture Overview** - Test pyramid, layer mapping
2. **Test Inventory** - All 20 test files documented
3. **Local Development & Husky** - Pre-commit workflow, running tests
4. **CI/CD Pipeline** - GitHub Actions workflows (ci.yml, docker-e2e.yml)
5. **Docker E2E Testing** - Container setup, validation levels
6. **LLM-as-Judge Evaluation** - Semantic evaluation with Claude
7. **Test Patterns** - Mock patterns, StreamingEvent testing, security tests
8. **Troubleshooting** - Common issues and solutions

---

## Historical Documents

Previous versions are preserved for reference:

| Document | Version | Notes |
|----------|---------|-------|
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
3. Read [DESIGN-0.5.0.md](./DESIGN-0.5.0.md) for latest improvements
4. Review [AGENTIC_CONCEPT-0.2.md](./AGENTIC_CONCEPT-0.2.md) for the agent system design

### For Developers

- Adding a new command? See [DESIGN-0.4.0.md § Adding a New Command](./DESIGN-0.4.0.md#9-adding-a-new-command-step-by-step)
- Understanding Session Manifest? See [DESIGN-0.5.0.md § Session Manifest](./DESIGN-0.5.0.md#3-session-manifest-system)
- Understanding Skills? See [AGENT-SKILLS.md](./AGENT-SKILLS.md)
- Running tests? See [TEST_PLAN-0.2.md](./TEST_PLAN-0.2.md)

### For Architects

- Session state management: [DESIGN-0.5.0.md § Session Manifest](./DESIGN-0.5.0.md#3-session-manifest-system)
- Artifact validation: [DESIGN-0.5.0.md § Intermediate Validation](./DESIGN-0.5.0.md#4-intermediate-artifact-validation)
- Execution cycle: [AGENTIC_CONCEPT-0.2.md § The Execution Cycle](./AGENTIC_CONCEPT-0.2.md#3-the-execution-cycle)
- Call stack concept: [AGENTIC_CONCEPT-0.2.md § The Call Stack Concept](./AGENTIC_CONCEPT-0.2.md#4-the-call-stack-concept)
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
    │ DESIGN-0.5.0.md │    │ AGENTIC_        │    │TEST_PLAN-0.2 │
    │ (Improvements)  │    │ CONCEPT-0.2     │    │  (Testing)   │
    └────────┬────────┘    │ (Agent Design)  │    └──────────────┘
             │             └────────┬────────┘
             │                      │
             ▼                      │
    ┌─────────────────┐             │
    │ DESIGN-0.4.0.md │             │
    │ (Architecture)  │◄────────────┘
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ AGENT-SKILLS.md │
    │ (SDK Reference) │
    └─────────────────┘
```

- **GLOSSARY.md** defines terms used across all documents
- **DESIGN-0.5.0.md** documents v0.5.0 improvements (builds on v0.4.0)
- **DESIGN-0.4.0.md** documents the base implementation architecture
- **AGENTIC_CONCEPT-0.2.md** documents the conceptual agent design
- **AGENT-SKILLS.md** provides the Anthropic SDK reference
- **TEST_PLAN-0.2.md** covers testing strategy

---

*This README provides navigation for Looplia-Core v0.5.0 documentation.*
