# FAGLA AI Architecture

## Milestone 2 — First Real Coding Agent

Milestone 2 adds the first bounded Coding Agent on top of the Milestone 0/1 Core Platform. It is workspace-scoped, provider-neutral, approval-gated, and tested against an isolated mock project.

### Coding Agent architecture

USER REQUEST → TASK → STRUCTURED PLAN → TASK WORKSPACE → REGISTERED TOOL → PERMISSION POLICY → WORKSPACE BOUNDARY → TOOL EXECUTOR → TEST → VALIDATION → RESULT → APPROVAL BOUNDARY

The Coding Agent is split across:
- coding-agent.js: contract and state machine coordination.
- coding-plan.js: structured plan schema and validation.
- coding-planner.js: provider-neutral planning adapter.
- llm/provider.js: provider interface plus deterministic mock provider.
- coding-tools.js: registered file, project, test, and git-inspection tools.
- command-executor.js: closed command allowlist with shell disabled.

### Coding Agent state

IDLE → PLANNING → EXECUTING → TESTING → VALIDATING → COMPLETED

Approval pauses use WAITING_APPROVAL; failures use FAILED. Invalid transitions are rejected.

### Workspace isolation

Each task can create an independent workspace identity through createTaskWorkspace(projectId, taskId, root). File operations resolve paths relative to the workspace root and reject absolute paths and traversal outside that root. Writes require isolated mode. main and production are protected targets.

Milestone 2 does not perform Git merge, push, deployment, or production writes automatically. Git status and diff are read-only inspection tools.

### Tool permissions

| Tool class | Permission | V1 behavior |
|---|---|---|
| File/project reads | READ | Allow |
| File writes | WRITE | Allow only inside isolated workspace |
| Test command | EXECUTE | Allow only exact npm test |
| Git status/diff | GIT | Allow |
| Git commit/push | GIT | Requires approval |
| Git merge | GIT | Deny |

The runtime performs registry lookup and permission evaluation before tool execution. The agent cannot bypass the policy by calling an unregistered tool.

### LLM provider abstraction

LLMProvider is a provider-neutral interface. MockLLMProvider supplies deterministic structured plans for tests. No API key or provider credential is stored in the repository. A future real provider adapter can be added without changing Coding Agent contracts.

### Testing strategy

The mock project under tests/fixtures/coding-project is copied to a temporary workspace for mutation. The real FAGLA repository and its Video Editor are never used as the Coding Agent sandbox.

## Core Platform

Milestone 0/1 contracts, task lifecycle, runtime, registry, permissions, approvals, persistence interfaces, workspace boundary, and audit logging remain the foundation. Milestone 2 consumes these boundaries rather than replacing them.

## Existing Video Editor

The existing frontend, upload endpoint, and FFmpeg media service remain outside the Coding Agent fixture and are not used as its workspace.
