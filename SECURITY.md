# FAGLA AI Security Baseline

## Milestone 1 controls

- Runtime resolves every requested tool through the central registry before execution.
- Unknown tool names fail closed with InvalidToolInvocationError.
- Permission evaluation occurs in the runtime, not in agent instructions.
- Missing required tool permissions produce PermissionDeniedError and the tool handler is not called.
- Medium/high-risk tools create a pending approval and do not execute until a later approved workflow explicitly resumes them.
- ExecutionContext contains identifiers, scoped permissions, and metadata only; secrets/API keys are intentionally excluded.
- Audit entries recursively redact common secret-bearing keys such as token, password, credential, authorization, and API key.
- Workspace policy rejects direct writes to main and production.
- Task transitions are validated centrally and terminal states cannot be reopened.

## Error handling

Typed core errors include invalid task transitions, invalid tool invocation, permission denial, approval requirements, agent execution errors, validation errors, and tool execution errors. Existing media/upload error behavior is not changed.

## Not implemented

Authentication/authorization infrastructure, quotas, sandboxed commands, arbitrary filesystem/network access, secret manager integration, malware scanning, FFmpeg resource limits, prompt-injection defenses, PostgreSQL persistence, LLM integrations, and production agents remain outside Milestone 1.
