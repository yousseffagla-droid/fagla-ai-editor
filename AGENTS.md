# Agent Contracts

## Core Platform

Agents declare identity, purpose, capabilities, and permissions. The runtime owns tool lookup, authorization, approval, task transitions, and audit.

## Coding Agent V1

backend/agents/coding-agent.js implements the first real product agent.

Responsibilities:
- receive a structured AgentContext
- request a structured plan through a provider-neutral planner
- request only registered coding tools
- operate only through runtime-enforced permissions and workspace boundaries
- run the allowlisted test command
- return a structured AgentResult
- expose explicit Coding Agent state transitions

The Coding Agent does not directly execute shell commands, access arbitrary filesystem paths, merge Git branches, push to remote repositories, or deploy production.

## Planning contract

A Coding Plan contains:
- goal
- assumptions
- filesToInspect
- filesToChange
- actions
- tests
- risks

Plans are validated before execution.

## Provider boundary

LLMProvider is an abstraction. MockLLMProvider is used by V1 tests. No provider secret is stored in source control.

## Workspace rule

Every task receives a logical task workspace identity. File access is constrained to its resolved root. The real FAGLA repository is not a Coding Agent test fixture.

## Future scope

Autonomous multi-agent orchestration, unrestricted execution, external integrations, production deployment, GitHub push automation, and automatic merge are not implemented.
