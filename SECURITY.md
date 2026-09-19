# FAGLA AI Security Baseline

## Principles

1. Model output is untrusted input.
2. Permissions are enforced by runtime/tool policy, not prompts.
3. High-impact actions require explicit approval.
4. Coding changes are isolated from protected targets.
5. Secrets must not be placed in logs, prompts, source files, or tool inputs.
6. External files, URLs, and user-provided content are untrusted.
7. Failed actions must stop safely rather than retry indefinitely.

## Milestone 0 controls

- Every tool has an explicit risk level.
- Low-risk tools can execute automatically.
- Medium- and high-risk tools pause for human approval.
- Unknown tools are rejected by the registry.
- Protected workspace targets (main, production) are rejected for direct writes.
- Audit events record lifecycle activity without relying on model decisions.

## Future controls

Authentication/authorization, quotas, sandboxed command execution, filesystem allowlists, network egress controls, secret-manager integration, malware/file scanning, FFmpeg resource limits/cancellation, prompt-injection defenses, and PostgreSQL audit persistence are not implemented in this milestone.
