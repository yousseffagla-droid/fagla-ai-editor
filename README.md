# Fagla AI Editor

Arabic-first AI video editor MVP plus the first bounded Coding Agent platform.

## Current architecture

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Uploads: Multer
- Media processing: FFmpeg via ffmpeg-static
- Core Agent Platform: contracts, lifecycle, runtime, tools, permissions, approvals, workspace boundary, persistence interfaces, audit logging
- Coding Agent V1: structured planning, isolated task workspaces, bounded file tools, allowlisted tests, git inspection, and approval boundaries

## Coding Agent V1

The Coding Agent receives a request, obtains a structured plan, and executes only registered tools through the central runtime. File writes are workspace-scoped. Test execution is restricted to exact npm test. Git status and diff are read-only; commit and push require approval; merge is denied.

LLMProvider is provider-neutral. V1 uses MockLLMProvider for deterministic tests and does not contain API credentials.

## Mock project test

tests/fixtures/coding-project is a small independent Node project. Tests copy it to a temporary directory, execute real file changes, run its real test command, validate the result, and inspect audit events.

The real FAGLA repository is never used as the Coding Agent sandbox.

## Existing Video Editor

The existing Video Editor frontend, upload endpoint, and FFmpeg media service remain separate from the Coding Agent fixture and are not modified by Coding Agent execution.

## Run locally

npm install
npm test

## Security boundary

No unrestricted shell, arbitrary filesystem access, production access, Git push automation, automatic merge, social APIs, image/video automation, or multi-agent orchestration is included in V1.
