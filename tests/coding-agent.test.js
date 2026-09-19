import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ToolRegistry, ToolExecutor } from '../backend/tools/registry.js';
import { PermissionPolicy, PERMISSION_DECISIONS } from '../backend/permissions/policy.js';
import { AuditLogger } from '../backend/logging/audit-log.js';
import { createExecutionContext } from '../backend/runtime/execution-context.js';
import { createTaskWorkspace, resolveWorkspacePath } from '../backend/projects/workspace.js';
import { CodingAgent } from '../backend/agents/coding-agent.js';
import { CODING_AGENT_STATES, transitionCodingState } from '../backend/agents/coding-state.js';
import { createCodingPlan } from '../backend/agents/coding-plan.js';
import { MockLLMProvider } from '../backend/llm/provider.js';
import { CodingPlanner } from '../backend/agents/coding-planner.js';
import { registerCodingTools } from '../backend/tools/coding-tools.js';
import { createTask } from '../backend/tasks/task.js';
import { AgentRuntime } from '../backend/runtime/agent-runtime.js';
import { InMemoryApprovalStore } from '../backend/approvals/store.js';
import { CommandNotAllowedError, PermissionDeniedError, InvalidTaskTransition } from '../backend/errors/index.js';

const fixture = path.resolve('tests/fixtures/coding-project');

async function makeContext({ permissions = ['READ', 'WRITE', 'EXECUTE', 'GIT'], root = fixture } = {}) {
  const workspace = createTaskWorkspace({ projectId: 'coding-project', taskId: 'coding-task', root });
  const auditLogger = new AuditLogger();
  const registry = new ToolRegistry();
  registerCodingTools({ registry, auditLogger });
  const execution = createExecutionContext({
    taskId: 'coding-task', projectId: 'coding-project', agentId: 'coding-agent-v1',
    workspaceId: workspace.workspaceId, requestId: 'coding-request', permissions, metadata: { workspace }
  });
  return { workspace, auditLogger, registry, execution };
}

function fixturePlan() {
  return createCodingPlan({
    goal: 'Add a simple utility function and update its test.',
    assumptions: ['The fixture uses Node.js ESM.'],
    filesToInspect: ['src/math.js', 'tests/math.test.js'],
    filesToChange: ['src/math.js', 'tests/math.test.js'],
    actions: [
      { tool: 'coding.inspect_project', input: {} },
      { tool: 'coding.read_file', input: { path: 'src/math.js' } },
      { tool: 'coding.update_file', input: { path: 'src/math.js', content: 'export function add(a, b) { return a + b; }\nexport function multiply(a, b) { return a * b; }\n' } },
      { tool: 'coding.update_file', input: { path: 'tests/math.test.js', content: "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add, multiply } from '../src/math.js';\n\ntest('add works', () => { assert.equal(add(1, 2), 3); });\ntest('multiply works', () => { assert.equal(multiply(2, 3), 6); });\n" } },
      { tool: 'coding.run_tests', input: { command: 'npm test', args: ['test'] } }
    ],
    tests: ['npm test'],
    risks: ['Only files inside the fixture workspace are writable.']
  });
}

test('Coding Agent contract', () => {
  const agent = new CodingAgent({ planner: new CodingPlanner(new MockLLMProvider(fixturePlan())) });
  assert.equal(agent.name, 'coding-agent-v1');
  assert.ok(agent.capabilities.includes('file-editing'));
  assert.ok(agent.permissions.includes('WRITE'));
});

test('Coding Agent state transitions reject invalid transitions', () => {
  assert.equal(transitionCodingState('IDLE', 'PLANNING'), CODING_AGENT_STATES.PLANNING);
  assert.equal(transitionCodingState('PLANNING', 'EXECUTING'), CODING_AGENT_STATES.EXECUTING);
  assert.throws(() => transitionCodingState('IDLE', 'COMPLETED'), InvalidTaskTransition);
  assert.throws(() => transitionCodingState('COMPLETED', 'EXECUTING'), InvalidTaskTransition);
});

test('workspace isolation blocks traversal and absolute paths', () => {
  const { workspace } = { workspace: createTaskWorkspace({ projectId: 'p', taskId: 't', root: fixture }) };
  assert.throws(() => resolveWorkspacePath(workspace, '../outside.txt'), PermissionDeniedError);
  assert.throws(() => resolveWorkspacePath(workspace, path.resolve(fixture, '../outside.txt')), PermissionDeniedError);
});

test('task workspaces are independently identified', () => {
  const a = createTaskWorkspace({ projectId: 'p', taskId: 'a', root: fixture });
  const b = createTaskWorkspace({ projectId: 'p', taskId: 'b', root: fixture });
  assert.notEqual(a.workspaceId, b.workspaceId);
  assert.equal(a.taskId, 'a');
  assert.equal(b.taskId, 'b');
});

test('read file tool reads only workspace files', async () => {
  const { registry, execution } = await makeContext();
  const result = await new ToolExecutor(registry).execute(execution, { tool: 'coding.read_file', input: { path: 'src/math.js' } });
  assert.match(result.content, /function add/);
});

test('write tools cannot escape workspace', async () => {
  const { registry, execution } = await makeContext();
  await assert.rejects(() => new ToolExecutor(registry).execute(execution, { tool: 'coding.update_file', input: { path: '../escape.js', content: 'bad' } }), PermissionDeniedError);
});

test('permission enforcement blocks WRITE without WRITE permission', () => {
  const workspace = createTaskWorkspace({ projectId: 'p', taskId: 't', root: fixture });
  const auditLogger = new AuditLogger(); const registry = new ToolRegistry();
  registerCodingTools({ registry, auditLogger });
  const execution = createExecutionContext({ taskId: 't', projectId: 'p', agentId: 'a', workspaceId: workspace.workspaceId, requestId: 'r', permissions: ['READ'], metadata: { workspace } });
  assert.equal(new PermissionPolicy().evaluate(registry.get('coding.update_file'), execution).status, PERMISSION_DECISIONS.DENY);
});

test('command allowlist permits npm test and blocks arbitrary commands', async () => {
  const { workspace } = await makeContext();
  const { runAllowedCommand } = await import('../backend/runtime/command-executor.js');
  const result = await runAllowedCommand({ command: 'npm test', args: ['test'], workspace });
  assert.equal(result.code, 0);
  await assert.rejects(() => runAllowedCommand({ command: 'rm -rf .', args: [], workspace }), CommandNotAllowedError);
});

test('git commit/push require approval and merge is denied', () => {
  const registry = new ToolRegistry(); registerCodingTools({ registry, auditLogger: new AuditLogger() });
  const policy = new PermissionPolicy();
  const execution = createExecutionContext({ taskId: 't', projectId: 'p', agentId: 'a', workspaceId: 'w', requestId: 'r', permissions: ['GIT'] });
  assert.equal(policy.evaluate(registry.get('coding.git_commit'), execution).status, PERMISSION_DECISIONS.REQUIRES_APPROVAL);
  assert.equal(policy.evaluate(registry.get('coding.git_push'), execution).status, PERMISSION_DECISIONS.REQUIRES_APPROVAL);
  assert.equal(policy.evaluate(registry.get('coding.git_merge'), execution).status, PERMISSION_DECISIONS.DENY);
});

test('structured coding plan is validated', () => {
  const plan = fixturePlan();
  assert.equal(plan.actions.length, 5);
  assert.throws(() => createCodingPlan({ goal: 'x' }), /requires/);
});

test('coding tools are registered in the central registry', () => {
  const registry = new ToolRegistry(); registerCodingTools({ registry, auditLogger: new AuditLogger() });
  for (const name of ['coding.list_files','coding.read_file','coding.create_file','coding.update_file','coding.inspect_project','coding.run_tests','coding.git_status','coding.git_diff','coding.git_commit','coding.git_push','coding.git_merge']) assert.equal(registry.has(name), true);
});

test('mock project executes inspect, read, write, test, validation and returns structured result', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fagla-coding-'));
  try {
    await fs.cp(fixture, tempRoot, { recursive: true });
    const { workspace, auditLogger, registry, execution } = await makeContext({ root: tempRoot });
    const plan = fixturePlan();
    const agent = new CodingAgent({ planner: new CodingPlanner(new MockLLMProvider(plan)), auditLogger });
    const task = createTask({ id: 'coding-task', projectId: 'coding-project', request: plan.goal });
    const runtime = new AgentRuntime({ toolRegistry: registry, toolExecutor: new ToolExecutor(registry), permissionPolicy: new PermissionPolicy(), approvalStore: new InMemoryApprovalStore(), auditLogger });
    const result = await runtime.run({ request: plan.goal, task, project: { id: 'coding-project' }, workspace, agent, execution });
    assert.equal(result.status, 'COMPLETED');
    assert.equal(agent.state, CODING_AGENT_STATES.COMPLETED);
    assert.match(await fs.readFile(path.join(tempRoot, 'src/math.js'), 'utf8'), /multiply/);
    assert.match(await fs.readFile(path.join(tempRoot, 'tests/math.test.js'), 'utf8'), /multiply/);
    const events = (await auditLogger.list()).map(entry => entry.event);
    for (const event of ['coding.task.created','coding.plan.created','coding.tool.requested','coding.file.read','coding.file.changed','coding.tests.started','coding.tests.completed','coding.validation.completed','coding.completed']) assert.ok(events.includes(event), event);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
