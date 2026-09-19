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

## Milestone 4 controls

- Real project coding operates only inside the existing isolated workspace abstraction.
- Project inspection and file discovery are bounded and exclude sensitive/build/vendor paths.
- File reads and writes continue through registered tools and workspace path validation.
- Test execution remains the exact `npm test` allowlist; no generic shell tool exists.
- Test failures are observations. Permission, traversal, protected-workspace, command-policy, and other security failures are not converted into correction prompts.
- Self-correction is limited to 3 attempts and repeated identical failures terminate the loop.
- Final validation inspects the resulting Git diff through the existing `coding.git_diff` tool.
- Git commit and push remain approval-gated; Git merge remains denied.
- Dependency installation and deployment are not implemented.
- No production workspace is exposed to the LLM.

### Remaining limitations

The platform still lacks OS/container sandboxing, malware scanning, dedicated secret management, unrestricted network egress controls, complete prompt-injection defenses, and autonomous deployment. Automatic cleanup is also not destructive in V1; task workspaces are lifecycle-tagged but the runtime does not delete user data.


## Milestone 5 — Orchestrator security boundary

The Orchestrator does not own permissions. A capability receives only the permissions already declared by its underlying agent/runtime contract. Unknown capabilities, unsupported task types, invalid dependency graphs, and orchestration-limit violations fail safely.

Approval-required operations remain approval-required under AgentRuntime. The Orchestrator never auto-approves. No arbitrary shell, unrestricted filesystem/network access, dependency installation, deployment, production access, automatic push, or merge was added.


## Milestone 6 — Controlled Web Research

`research.search` is explicitly permission-gated by `RESEARCH`, has bounded query/result inputs, and is registered in the existing ToolRegistry. No generic URL fetcher or unrestricted HTTP client was added. Research receives no shell, filesystem-write, Git-write, deployment, production, or unrestricted network authority. Approval remains authoritative for tools whose risk policy requires it.

Web content is data, never instructions. Source snippets cannot alter the agent's permissions or execution policy.
