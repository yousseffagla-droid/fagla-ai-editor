# Agent Contracts

## Core Platform contract

An agent declares identity, purpose, capabilities, and declared permissions. The runtime supplies an AgentContext containing request, task, project, workspace, execution context, and scoped memory.

Agents return an AgentResult with COMPLETED, WAITING_FOR_APPROVAL, or FAILED.

Agents do not authorize their own tool use. The runtime resolves tools, evaluates PermissionPolicy, creates approvals when required, and controls execution.

## Task lifecycle

Agents participate in the core task lifecycle but do not mutate task status directly. task.js owns legal transitions.

## Future Agents

Coding Agent, Research Agent, QA Agent, and any main orchestrator are future features. They are not implemented in Milestone 1. Future Coding Agent execution must use an isolated workspace and must never directly modify main or production.
