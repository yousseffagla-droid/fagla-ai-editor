# FAGLA AI Security Baseline

## Milestone 2 Coding Agent controls

- Coding Agent tools must be registered in the central ToolRegistry.
- Runtime evaluates PermissionPolicy before every tool execution.
- File reads and writes resolve relative to an isolated task workspace and reject traversal and absolute paths.
- File writes are denied for non-isolated workspaces and protected targets.
- Test execution uses a closed allowlist: V1 permits only exact npm test with the test argument.
- Command execution uses direct process spawning with shell disabled; no arbitrary shell string is accepted.
- Git status and diff are read-only.
- Git commit and push require explicit approval.
- Git merge is denied by policy in V1.
- The Coding Agent never receives secrets or API keys through ExecutionContext.
- Audit entries record coding operations and inherit recursive sensitive-key redaction.

## Approval boundary

The agent can request a higher-risk Git operation but cannot authorize it. The runtime creates a pending Approval and stops before the tool handler runs. There is no automatic merge or push path in Milestone 2.

## Test isolation

The mock Coding Agent project is copied into a temporary directory before mutation. Tests never use the FAGLA repository as a writable agent workspace.

## Remaining security limitations

V1 does not provide OS-level sandboxing, container isolation, malware scanning, resource quotas, network egress controls, prompt-injection defenses, a secret manager, or a production deployment boundary. These remain required hardening areas before allowing broader or remote execution.
