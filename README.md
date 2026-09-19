# Fagla AI Editor

Arabic-first AI video editor MVP plus a bounded Coding Agent platform.

## Milestone 3 — Real LLM Integration & Agent Intelligence V1

The Coding Agent now supports a real LLM provider behind the existing `LLMProvider` abstraction. The model proposes structured plans/tool calls/final results; the platform runtime remains authoritative for registry lookup, permissions, workspace isolation, approvals, tool execution, tests, validation, and audit.

### Architecture

USER REQUEST → CODING AGENT → CONTEXT BUILDER → LLM PROVIDER → STRUCTURED DECISION → REGISTRY → PERMISSION POLICY → WORKSPACE BOUNDARY → TOOL EXECUTOR → OBSERVATION → LLM → TEST → VALIDATION → RESULT

The LLM never receives direct filesystem, process, Git, or shell access.

### Providers

- `MockLLMProvider`: deterministic and used by normal tests.
- `OpenAIProvider`: production adapter using the OpenAI Responses API through the provider abstraction.
- Credentials are read only from `OPENAI_API_KEY`; model is configurable through `OPENAI_MODEL`.
- No provider SDK is required by the Coding Agent.
- The default model can be overridden with `OPENAI_MODEL`.

### Structured output

Every model decision is validated against a strict schema with one of:

- `plan`
- `tool_call`
- `final`

Invalid output is rejected before any tool can run.

### Bounded reasoning

The agent uses fixed limits:

- max context: 24,000 characters
- max file content in context: 8,000 characters
- max LLM/tool iterations: 12
- max tool calls per task: 24
- max repeated test-failure fingerprint: 2

Provider retries are limited to two retries with bounded exponential backoff and are only used for transient provider/network failures.

### Environment

Copy `.env.example` to a local environment file and set credentials only locally:

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
RUN_LLM_INTEGRATION_TESTS=false
```

The real key is never committed, logged, placed in ExecutionContext, or sent to the model as task data.

### Testing

```bash
npm install
npm test
```

Normal CI and the full test suite work without an API key. The optional real-provider test runs only when both `RUN_LLM_INTEGRATION_TESTS=true` and `OPENAI_API_KEY` are explicitly present.

### Security boundary

The model cannot:

- invoke unregistered tools
- bypass PermissionPolicy
- escape the isolated workspace
- use absolute paths or traversal
- execute arbitrary shell commands
- access sensitive configuration files through Coding Agent file tools
- commit or push without approval
- merge branches
- access production/main workspaces

The existing Video Editor remains separate and is not used as an agent sandbox.

## Milestone 4 — Real Project Coding & Self-Correction V1

The Coding Agent now runs a bounded engineering loop over an isolated project workspace:

USER REQUEST → PROJECT INSPECTION → PLAN → IMPLEMENT → TEST → FAILURE ANALYSIS → CORRECTION → TEST AGAIN → VALIDATION → RESULT

Project inspection returns structured metadata, bounded relevant-file discovery is available through `coding.discover_files`, and `coding.run_tests` returns bounded structured results instead of converting test failures into generic tool errors.

### Self-correction

A failed test can be returned to the LLM as a structured observation. The agent may make a correction through the same Tool Registry → Permission Policy → Workspace → Tool Executor path and rerun the allowlisted test command. Correction attempts are bounded at 3, repeated identical failures stop the loop, and security/permission failures are not treated as fixable test failures.

### Engineering result

Completed runs report files planned for change, test observations, correction history, validation/diff information, progress records, and an audit summary. Failed validation is reported separately from ordinary runtime/security failure.

### Workspace lifecycle

Task workspaces carry lifecycle metadata for CREATE → INITIALIZE → INSPECT → MODIFY → TEST → VALIDATE → COMPLETE → CLEANUP. Automatic destructive cleanup is intentionally not performed by the agent in V1.

Dependency installation, deployment, arbitrary shell, unrestricted filesystem/network access, automatic Git commit/push/merge, and production access remain out of scope.


## Milestone 5 — Agent Orchestrator V1

The platform now includes a bounded orchestration layer above the existing Coding Agent. The Orchestrator understands requests, decomposes composite work, routes through a capability registry, executes sequential dependencies, passes structured results, aggregates outcomes, and validates the final result.

Research is a deterministic controlled adapter only; it does not provide unrestricted web/network access.

Security authority remains in the existing AgentRuntime, ToolRegistry, PermissionPolicy, Workspace boundary, and Approval system. The Orchestrator cannot grant permissions or directly execute tools.
