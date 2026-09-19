# Changelog

## Unreleased — Milestone 1

### Added
- Explicit Core Domain contracts and boundaries.
- Task state machine with valid and invalid transition enforcement.
- Hardened ExecutionContext with task/project/agent/workspace/execution identifiers and scoped permissions.
- ToolExecution contract plus separate ToolRegistry and ToolExecutor boundaries.
- Runtime permission denial and approval gates.
- Typed core error hierarchy.
- Replaceable TaskStore, ApprovalStore, MemoryStore, and AuditLogStore boundaries with in-memory implementations.
- Structured audit events and sensitive-field redaction.
- Core Platform regression and lifecycle tests.

### Preserved
- Existing Arabic-first Video Editor frontend.
- Existing upload and FFmpeg audio extraction pipeline.

### Not included
- LLM integration or provider APIs.
- Coding, Research, or QA agents.
- Autonomous planning.
- Shell/filesystem tools or real sandboxing.
- Git merge automation.
- PostgreSQL or external integrations.
