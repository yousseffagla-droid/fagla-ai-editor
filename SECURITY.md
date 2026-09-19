# FAGLA AI Security Baseline

## Milestone 3 controls

- The LLM is an untrusted reasoning component, not an execution authority.
- Every model decision is schema-validated before use.
- Every tool call must exist in the central ToolRegistry.
- PermissionPolicy is evaluated by the runtime before execution.
- Workspace path resolution remains authoritative.
- Absolute paths and traversal are rejected.
- Sensitive configuration files are unavailable to Coding Agent file tools.
- Test execution remains limited to the existing exact `npm test` allowlist.
- No generic shell or arbitrary process tool exists.
- Git commit and push remain approval-gated.
- Git merge remains denied.
- Provider credentials are environment-only and are never placed in task/execution context or audit payloads.
- Audit logging recursively redacts secret-like keys.
- Context size, tool count, iteration count, and repeated test failures are bounded.
- Provider retries are limited to transient failures only.

## LLM data boundary

The Context Builder sends only bounded, task-relevant information. It filters secret-like keys and sensitive configuration paths. Tool results are sanitized and file content is truncated before being returned to the model.

The OpenAI adapter sends the task context as model input, but does not include the API key in that input. The API key is used only in the outbound HTTP Authorization header.

## Failure handling

Provider timeout, provider unavailability, malformed structured output, and transient HTTP failures become controlled Fagla errors. Permission, approval, workspace, and validation boundaries remain runtime-owned.

## Remaining security limitations

Milestone 3 still does not provide OS/container sandboxing, malware scanning, resource quotas beyond agent-loop limits, network egress controls for tools, prompt-injection defenses, a dedicated secret manager, or autonomous deployment. Real-provider use should therefore remain limited to isolated task workspaces until those controls are added.
