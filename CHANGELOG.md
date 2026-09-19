# Changelog

## Unreleased — Milestone 2

### Added
- First real Coding Agent contract and explicit state machine.
- Structured Coding Plan validation.
- Provider-neutral LLM interface with deterministic MockLLMProvider.
- Task-specific logical workspace identities and path traversal protection.
- Registered coding file, project inspection, test, and git inspection tools.
- Closed command allowlist for npm test.
- Permission categories READ, WRITE, EXECUTE, and GIT.
- Approval-gated git commit and push plus permanently denied git merge.
- Coding-specific audit events.
- Isolated mock project integration test with real file mutation and real test execution.

### Preserved
- Milestone 0/1 Core Platform behavior.
- Existing Video Editor domain and media pipeline.

### Not included
- Real LLM provider credentials or network model calls.
- Arbitrary shell or filesystem access.
- Production deployment.
- GitHub push automation or automatic merge.
- Social, image, video, Photoshop, or multi-agent integrations.
