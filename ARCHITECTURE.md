# FAGLA AI Architecture

## Milestone 0 — Foundation

This milestone establishes boundaries for an agent platform without replacing the existing video editor.

### Runtime lifecycle

REQUEST → PLAN → EXECUTE → OBSERVE → VALIDATE → APPROVAL → COMPLETE

The runtime has a simple plan boundary. It does not implement autonomous planning, model routing, long-running workflows, or automatic merging.

### Boundaries

- agents/ — agent contracts and future implementations.
- runtime/ — execution context and controlled lifecycle.
- tools/ — tool definitions, registry, and execution boundary.
- permissions/ — policy decisions independent from model instructions.
- projects/ — project/workspace isolation rules.
- tasks/ — task state model.
- approvals/ — explicit human approval state.
- memory/ — separated user/project/task memory boundary.
- logging/ — structured audit events.
- errors/ — typed error taxonomy.
- services/ — composition and existing domain services.

### Coding-agent safety boundary

Future coding execution must follow:

User Request → Project Workspace → Agent Changes → Tests → QA → Approval → Merge

The foundation protects main and production as merge targets. A future Coding Agent must operate in an isolated workspace/branch and may not directly write protected targets.

### Persistence

Milestone 0 uses in-memory stores only. No database is required to establish these contracts. A PostgreSQL-backed implementation can replace these stores later without changing agent/runtime contracts.

### TypeScript migration

The foundation is JavaScript-first and contract-oriented. Modules use explicit objects, classes, validation, and stable boundaries so individual modules can migrate to TypeScript later without converting the repository in one step.

### Existing Video Editor

The current frontend, upload route, FFmpeg service, and browser editing flow remain the existing video domain. They are not rewritten by Milestone 0.

### Not implemented

Autonomous planning, production Coding/Research/QA agents, LLM provider abstraction, PostgreSQL persistence, authentication/organizations, real workspace provisioning, branch/merge automation, production tool executors, social/design/video AI agents.
