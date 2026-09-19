# FAGLA AI Architecture

## Milestone 1 — Core Domain + Runtime Hardening

Milestone 1 turns the Milestone 0 foundation into a stable core platform. It does not implement product agents or model integrations.

### Core boundaries

- Task owns task identity, state, and legal lifecycle transitions.
- Agent / AgentContext / AgentResult define the agent contract and exchange boundary.
- ToolDefinition / ToolRegistry / ToolExecutor / ToolExecution separate registration, lookup, and execution of tools.
- ExecutionContext carries scoped execution identifiers, permissions, and non-secret metadata.
- PermissionPolicy makes the runtime authorization decision; agents cannot override it.
- Approval represents an explicit human gate for higher-risk actions.
- AuditLogStore / AuditLogger provide the append/list persistence boundary and sanitize sensitive keys.
- TaskStore / ApprovalStore / MemoryStore keep persistence behind replaceable boundaries. Current implementations are in-memory.
- Project Workspace defines the project/workspace identity and protects main and production from direct writes.

### Task lifecycle

CREATED → PLANNED → RUNNING → WAITING_APPROVAL → RUNNING → VALIDATING → COMPLETED

Terminal failure states are FAILED and CANCELLED. Invalid transitions throw InvalidTaskTransition; terminal states cannot be reopened.

### Runtime flow

TASK START → AGENT EXECUTION → TOOL REQUEST → PERMISSION EVALUATION → APPROVAL GATE when required → TOOL EXECUTION → VALIDATION → TASK COMPLETE

Unknown tools are rejected by the registry. Permission decisions are made by the runtime policy before execution. Approval pauses execution; approval resolution is recorded, while full workflow resumption remains a later orchestration concern.

### Persistence boundary

Milestone 1 intentionally remains in-memory. TaskStore, ApprovalStore, MemoryStore, and AuditLogStore define stable interfaces so a future PostgreSQL adapter can replace storage without changing the runtime contract.

### Security boundary

Secrets and credentials are not part of ExecutionContext by design. Audit logging removes common secret-bearing keys recursively. Runtime errors are typed and unexpected agent/tool failures are normalized without exposing credentials.

### Core Platform vs Future Agents

Core Platform: contracts, lifecycle/state machine, runtime, registry, permission policy, approval boundary, workspace boundary, persistence interfaces, audit logging, and tests.

Future Agents: Coding Agent, Research Agent, QA Agent, orchestrator behavior, LLM provider integration, autonomous planning, shell/filesystem tools, sandboxing, and external integrations. None are implemented in Milestone 1.

### Existing Video Editor

The existing frontend, upload endpoint, and FFmpeg media service remain outside the Core Platform changes. Milestone 1 does not modify the Video Editor domain.
