# Fagla AI Editor

Arabic-first AI video editor MVP.

## Current architecture

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Uploads: Multer
- Media processing: FFmpeg via ffmpeg-static
- First pipeline stage: video upload → WAV 16 kHz mono extraction
- Core Agent Platform: contracts, task lifecycle, runtime, tool registry/executor, permissions, approvals, workspace boundary, persistence interfaces, audit logging, and tests

## Core Platform — Milestone 1

Implemented:

- Explicit Task lifecycle and invalid-transition protection
- Agent, AgentContext, and AgentResult contracts
- ToolDefinition, ToolRegistry, ToolExecution, and ToolExecutor boundaries
- Runtime-level permission enforcement and approval gate
- Hardened ExecutionContext with scoped permissions and no secrets
- Typed core error hierarchy
- Replaceable in-memory TaskStore, ApprovalStore, MemoryStore, and AuditLogStore boundaries
- Sanitized audit events
- Regression and lifecycle tests

The Core Platform is infrastructure, not a set of autonomous product agents.

### Future agents — not implemented

- Coding Agent
- Research Agent
- QA Agent
- Main Orchestrator
- LLM provider integration
- Autonomous planning
- Shell/filesystem execution
- Real sandboxing
- Git merge automation
- PostgreSQL
- Social/media/design integrations

## Existing Video Editor

The existing Video Editor remains the active application domain. Its frontend, upload endpoint, and FFmpeg media service are preserved and are not part of the Milestone 1 domain/runtime changes.

## Run locally

npm install
npm start

Then open http://localhost:3000.

## Foundation tests

npm test

The test suite covers Milestone 0 regressions plus task transitions, runtime failures, permission denial, approval flow, audit redaction, execution context, ToolExecution, and replaceable in-memory stores.

## Existing video pipeline

The browser calls /api/upload, which stores the video and extracts WAV audio at 16 kHz mono using FFmpeg. Whisper, silence detection, and later AI video stages remain separate future work.
