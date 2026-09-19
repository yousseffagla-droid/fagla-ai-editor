# Agent Contracts

## Agent

An agent declares name, purpose, capabilities, permissions, and an execution contract.

Agents receive an AgentContext containing request, task, project, execution context, and intentionally scoped memory.

Agents return an AgentResult with an explicit status: COMPLETED, WAITING_FOR_APPROVAL, or FAILED.

## Runtime rule

Agents do not decide whether a tool is safe. The runtime resolves the tool through the central registry and applies the permission policy before execution.

## Current implementation

Milestone 0 provides the base contract and runtime boundary only. No production Coding, Research, QA, or Main Orchestrator agent is claimed as implemented.

## Future Coding Agent

A Coding Agent must operate in an isolated project workspace and follow: inspect → plan → modify workspace → test → QA → approval → merge.

It must never directly modify main or production.
