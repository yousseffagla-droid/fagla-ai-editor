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
