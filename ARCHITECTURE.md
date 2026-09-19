# FAGLA AI Architecture

## Milestone 3 — Real LLM Integration & Agent Intelligence V1

Milestone 3 adds real model-driven reasoning without changing the authority model established in Milestones 0–2.

### Execution flow

USER REQUEST
→ CODING AGENT
→ CONTEXT BUILDER
→ LLM PROVIDER
→ STRUCTURED DECISION
→ TOOL REGISTRY
→ PERMISSION POLICY
→ WORKSPACE BOUNDARY
→ TOOL EXECUTOR
→ OBSERVATION
→ CONTEXT UPDATE
→ LLM
→ TEST
→ VALIDATION
→ RESULT

The model proposes intent. The runtime decides whether intent is valid and permitted.

### Provider boundary

`LLMProvider` is the only contract consumed by `CodingPlanner`. `OpenAIProvider` implements the contract using the Responses API. `MockLLMProvider` remains deterministic for tests.

Provider credentials never enter AgentContext or ExecutionContext. Provider responses expose safe metadata such as model, latency, and usage when supplied.

### Structured decision protocol

A model decision is one of:

- `plan`: validated with the existing CodingPlan contract, then its registered actions are executed.
- `tool_call`: one registered tool request, validated before authorization.
- `final`: a structured completion result after validation.

No natural-language command parsing is used for execution.

### Context builder

`backend/llm/context-builder.js` builds bounded context from task/project/workspace state, the current Coding Agent state, the validated plan, and sanitized observations/tool/test results.

Sensitive keys are recursively filtered. Sensitive configuration paths such as `.env`, credentials, and secrets are excluded from model context, and Coding Agent file tools reject them.

### Loop controls

| Control | Limit |
|---|---:|
| Context | 24,000 characters |
| File content in context | 8,000 characters |
| Reasoning/tool iterations | 12 |
| Tool calls per task | 24 |
| Repeated test-failure fingerprint | 2 |
| Provider retries | 2 |

A loop-limit audit event is emitted before controlled failure.

### Tool and approval flow

Every model tool request follows:

MODEL INTENT
→ schema/argument validation
→ ToolRegistry lookup
→ PermissionPolicy
→ Workspace/tool boundary
→ Approval policy
→ ToolExecutor
→ sanitized observation

Git commit and push remain approval-gated. Git merge remains denied. There is no generic shell tool.

### Coding Agent state machine

The existing state machine is preserved:

IDLE → PLANNING → EXECUTING → TESTING → VALIDATING → COMPLETED

WAITING_APPROVAL and FAILED remain controlled branches. Milestone 3 does not create a competing state machine.

### Existing Video Editor

The frontend, upload endpoint, and FFmpeg media service remain outside the Coding Agent sandbox and are not redesigned by this milestone.
