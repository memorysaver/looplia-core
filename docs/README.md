# Looplia-Core Documentation

> **Version:** 0.5.1
> **Last Updated:** December 2025

This directory contains the core documentation for Looplia-Core, a Claude Agent SDK-based agentic workflow platform.

---

## Core Documents (Latest)

These are the current, authoritative documents for the v0.5 architecture:

| Document | Purpose | Audience |
|----------|---------|----------|
| [AGENTIC_CONCEPT-0.4.md](./AGENTIC_CONCEPT-0.4.md) | Agent system design: Workflow-as-Markdown, Custom Subagents, Skills Auto-Loading, Validation-Driven | Architects, System Designers |
| [TEST_PLAN-0.5.md](./TEST_PLAN-0.5.md) | Test architecture with real API testing, log verification, bun link workflow | QA, Developers |
| [DESIGN-0.5.1.md](./DESIGN-0.5.1.md) | Workflow-as-Markdown architecture, validation skill system | Developers, Architects |
| [GLOSSARY.md](./GLOSSARY.md) | Ubiquitous language reference (domain terms + TypeScript types) | All team members |
| [SUBAGENTS.md](./SUBAGENTS.md) | Anthropic official Subagents documentation (reference) | Developers |
| [AGENT-SKILLS.md](./AGENT-SKILLS.md) | Anthropic official Agent Skills documentation (reference) | Developers |

---

## Document Overview

### AGENTIC_CONCEPT-0.4.md

The v0.5 agent system design document covering:

- **Workflow-as-Markdown** - YAML frontmatter + markdown instructions in single file
- **Custom Subagents** - Task tool with custom `subagent_type` (content-analyzer, idea-generator, writing-kit-builder)
- **Skills Auto-Loading** - `skills:` frontmatter field in agent definitions
- **Validation-Driven Completion** - `validation.json` with deterministic script validation
- **Execution Cycle** - 3-stage pipeline with validation after each stage
- **Call Stack Concept** - Hierarchical execution with auto-loaded skills
- **Smart Continuation** - Resume via validation state (validated: true + artifact exists)

### TEST_PLAN-0.5.md

The v0.5 test strategy document covering:

- **Test Architecture** - Test pyramid aligned with Clean Architecture
- **Test Inventory** - 19 test files across CLI, Core, Provider packages
- **Real API Testing** - `bun link`, env injection, `looplia init` and `run`
- **Log Verification** - Patterns for subagent_type, Task tool, Skill tool
- **verify-workflow-log.sh** - Automated log verification script
- **Docker E2E** - Container testing with real API calls
- **LLM-as-Judge** - Semantic evaluation (12-point rubric)

### DESIGN-0.5.1.md

The workflow-as-markdown architecture document covering:

- **Workflow.md Format** - YAML frontmatter structure with outputs, agents, validation criteria
- **Validation Skill System** - workflow-validator skill with deterministic scripts
- **Generic Workflow Interpreter** - CLAUDE.md that executes ANY workflow
- **CLI Command Updates** - `looplia run <workflow-id> --file <path>`
- **Migration from v0.5.0** - Breaking changes and file structure updates

### GLOSSARY.md

Ubiquitous language reference organized into categories covering domain concepts, architecture layers, command framework, agent system, streaming events, and more.

### SUBAGENTS.md

Reference document containing the official Anthropic documentation for Subagents, including subagent structure, Task tool integration, and custom `subagent_type` configuration.

### AGENT-SKILLS.md

Reference document containing the official Anthropic documentation for Agent Skills, including skill structure, SDK integration, and discovery mechanisms.

---

## Historical Documents

Previous versions are preserved for reference:

| Document | Version | Notes |
|----------|---------|-------|
| [AGENTIC_CONCEPT-0.3.md](./AGENTIC_CONCEPT-0.3.md) | v0.3 | Pipeline-as-Configuration (YAML), session.json |
| [TEST_PLAN-0.4.md](./TEST_PLAN-0.4.md) | v0.4 | Pre-real-API-testing plan |
| [DESIGN-0.4.0.md](./DESIGN-0.4.0.md) | v0.4.0 | CommandDefinition abstraction, Clean Architecture |
| [AGENTIC_CONCEPT-0.2.md](./AGENTIC_CONCEPT-0.2.md) | v0.2 | Pre-pipeline agent design |
| [TEST_PLAN-0.3.md](./TEST_PLAN-0.3.md) | v0.3 | Pre-v0.5.0 test plan |
| [TEST_PLAN-0.2.md](./TEST_PLAN-0.2.md) | v0.2 | Earlier test plan |
| [TEST_PLAN-0.1.md](./TEST_PLAN-0.1.md) | v0.1 | Original test plan |

---

## Quick Links

### For New Contributors

1. Start with [GLOSSARY.md](./GLOSSARY.md) to understand the terminology
2. Read [AGENTIC_CONCEPT-0.4.md](./AGENTIC_CONCEPT-0.4.md) for the agent system design
3. Review [DESIGN-0.5.1.md](./DESIGN-0.5.1.md) for workflow architecture

### For Developers

- Adding a workflow? See [DESIGN-0.5.1.md § Workflow-as-Markdown](./DESIGN-0.5.1.md#4-workflow-as-markdown-architecture)
- Understanding custom subagents? See [AGENTIC_CONCEPT-0.4.md § Custom Subagents](./AGENTIC_CONCEPT-0.4.md#4-custom-subagents)
- Understanding skills auto-loading? See [AGENTIC_CONCEPT-0.4.md § Skills Auto-Loading](./AGENTIC_CONCEPT-0.4.md#5-skills-auto-loading)
- Running tests? See [TEST_PLAN-0.5.md](./TEST_PLAN-0.5.md)
- Real API testing? See [TEST_PLAN-0.5.md § Real API Testing with bun link](./TEST_PLAN-0.5.md#4-real-api-testing-with-bun-link)

### For Architects

- Workflow-as-Markdown: [AGENTIC_CONCEPT-0.4.md § Workflow-as-Markdown](./AGENTIC_CONCEPT-0.4.md#3-workflow-as-markdown)
- Validation-driven completion: [AGENTIC_CONCEPT-0.4.md § Validation-Driven Completion](./AGENTIC_CONCEPT-0.4.md#6-validation-driven-completion)
- Execution cycle: [AGENTIC_CONCEPT-0.4.md § The Execution Cycle](./AGENTIC_CONCEPT-0.4.md#7-the-execution-cycle)
- Call stack concept: [AGENTIC_CONCEPT-0.4.md § The Call Stack Concept](./AGENTIC_CONCEPT-0.4.md#8-the-call-stack-concept)

---

## Document Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT RELATIONSHIPS (v0.5)                         │
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
    │ AGENTIC_        │    │ DESIGN-0.5.1.md │    │TEST_PLAN-0.5 │
    │ CONCEPT-0.4     │    │ (Architecture)  │    │  (Testing)   │
    │ (Agent Design)  │    └────────┬────────┘    └──────────────┘
    └────────┬────────┘             │
             │                      │
             │                      ▼
             │             ┌─────────────────────────────────┐
             └────────────►│ SUBAGENTS.md │ AGENT-SKILLS.md │
                           │       (SDK Reference)          │
                           └─────────────────────────────────┘
```

- **GLOSSARY.md** defines terms used across all documents
- **AGENTIC_CONCEPT-0.4.md** documents the agent design with Workflow-as-Markdown
- **DESIGN-0.5.1.md** documents the workflow architecture implementation
- **SUBAGENTS.md** provides the Anthropic SDK subagents reference
- **AGENT-SKILLS.md** provides the Anthropic SDK skills reference
- **TEST_PLAN-0.5.md** covers testing strategy including real API testing

---

## Key v0.5 Concepts

### Workflow-as-Markdown

Workflows are defined in `workflows/*.md` with YAML frontmatter:

```yaml
---
name: writing-kit
outputs:
  summary:
    artifact: summary.json
    agent: content-analyzer
    validate:
      required_fields: [contentId, headline, ...]
  ideas:
    artifact: ideas.json
    agent: idea-generator
    requires: [summary]
  writing-kit:
    artifact: writing-kit.json
    agent: writing-kit-builder
    requires: [summary, ideas]
    final: true
---
```

### Custom Subagents

Agents are defined in `.claude/agents/*.md` with `skills:` auto-loading:

```yaml
---
name: content-analyzer
tools: Read, Write, Skill
skills: media-reviewer, content-documenter
---
```

### Validation-Driven Completion

Steps complete when `validation.json` shows `validated: true`:

```json
{
  "outputs": {
    "summary": { "validated": true },
    "ideas": { "validated": true },
    "writing-kit": { "validated": false }
  }
}
```

---

*This README provides navigation for Looplia-Core v0.5 documentation.*
