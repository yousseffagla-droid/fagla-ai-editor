# Changelog

## Unreleased — Milestone 3

### Added
- Real OpenAI provider adapter behind the existing LLMProvider abstraction.
- Strict structured Coding Agent decision schema for plans, tool calls, and final results.
- Bounded LLM context builder with sensitive-field/path filtering.
- Controlled model-driven tool loop with observation and replanning.
- Provider timeout/error handling and bounded transient retries.
- LLM interaction audit events and safe usage metadata.
- Optional real-provider integration test gated by explicit environment configuration.
- Context, iteration, tool-call, and repeated-failure limits.

### Preserved
- Milestone 0/1 Core Platform behavior.
- Milestone 2 Coding Agent state machine, ToolRegistry, PermissionPolicy, workspace boundary, approval rules, and command allowlist.
- Existing Video Editor domain and media pipeline.

### Not included
- Generic shell execution.
- Unrestricted filesystem or network access.
- Automatic Git merge.
- Autonomous deployment.
- Social, image, video, Photoshop, or multi-agent integrations.
