# Agent Contracts

## Core Platform

Agents declare identity, purpose, capabilities, and permissions. The runtime owns tool lookup, authorization, approval, task transitions, validation, and audit.

## Coding Agent V1

The Coding Agent uses a provider-neutral planner and a bounded reasoning loop. It consumes structured model decisions and never executes model output directly.

Responsibilities:

- receive a structured AgentContext
- build bounded model context
- request structured LLM decisions
- validate plans and tool calls
- request only registered coding tools
- operate only through runtime-enforced permissions and workspace boundaries
- run the allowlisted test command
- return a structured AgentResult
- preserve the established Coding Agent state machine

The Coding Agent does not directly execute shell commands, access arbitrary filesystem paths, merge Git branches, push to remote repositories, or deploy production.

## Model decision contract

A decision contains the existing CodingPlan fields plus a `type`:

- `plan`
- `tool_call`
- `final`

All decisions are validated before runtime action.

## Provider boundary

`LLMProvider` is provider-neutral. `MockLLMProvider` is used by normal CI. `OpenAIProvider` is an optional real provider configured by environment variables.

## Workspace rule

Every task receives a logical task workspace identity. File access is constrained to its resolved root.

## Future scope

Autonomous multi-agent orchestration, unrestricted execution, external integrations, production deployment, GitHub push automation, and automatic merge are not implemented.

## Milestone 4 — Real Project Coding

The Coding Agent performs a bounded engineering loop: inspect → plan → implement → test → analyze failure → correct → retest → validate.

Project inspection is structured and relevant-file discovery is bounded. Test results are structured and bounded. A correction is allowed only through existing registered coding tools and the same permission/workspace/approval pipeline.

The agent stops after three correction attempts or repeated identical failures. Security violations are terminal for the current execution; the model is never asked to work around a security boundary.

Engineering results include progress and correction history. No automatic dependency installation, deployment, commit, push, or merge is performed.
