import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseAgent, createAgentResult } from '../backend/agents/contracts.js';
import { AgentRuntime } from '../backend/runtime/agent-runtime.js';
import { ToolRegistry } from '../backend/tools/registry.js';
import { TOOL_RISK_LEVELS } from '../backend/tools/contracts.js';
import { PermissionPolicy } from '../backend/permissions/policy.js';
import { ApprovalStore } from '../backend/approvals/store.js';
import { AuditLogger } from '../backend/logging/audit-log.js';
import { createExecutionContext } from '../backend/runtime/execution-context.js';
import { InvalidToolInvocationError } from '../backend/errors/index.js';

const execution = createExecutionContext({ taskId: 'task-1', projectId: 'project-1', requestId: 'request-1' });
const project = { id: 'project-1' };
const task = { id: 'task-1', projectId: 'project-1' };

function makeAgent(plan = { steps: [] }) {
  return new class extends BaseAgent {
    constructor() { super({ name: 'test-agent', purpose: 'Contract test agent', capabilities: ['test'], permissions: ['LOW'] }); }
    async plan() { return plan; }
    async execute() { return createAgentResult({ status: 'COMPLETED', output: { ok: true } }); }
  }();
}

test('registers and executes a tool', async () => {
  const registry = new ToolRegistry(); let called = false;
  registry.register({ name: 'test.read', description: 'Safe test tool', riskLevel: TOOL_RISK_LEVELS.LOW, handler: async () => { called = true; return { ok: true }; } });
  assert.deepEqual(await registry.execute('test.read', {}, execution), { ok: true });
  assert.equal(called, true);
});

test('evaluates low risk as allowed and medium risk as approval-required', () => {
  const policy = new PermissionPolicy();
  assert.equal(policy.evaluate({ riskLevel: TOOL_RISK_LEVELS.LOW }, execution).status, 'ALLOW');
  assert.equal(policy.evaluate({ riskLevel: TOOL_RISK_LEVELS.MEDIUM }, execution).status, 'REQUIRES_APPROVAL');
});

test('enforces the agent contract', async () => {
  const agent = makeAgent();
  assert.equal(agent.name, 'test-agent');
  assert.deepEqual(agent.capabilities, ['test']);
  assert.equal((await agent.execute({})).status, 'COMPLETED');
});

test('runs the runtime lifecycle for an allowed action', async () => {
  const registry = new ToolRegistry(); const events = [];
  registry.register({ name: 'test.low', description: 'Safe tool', riskLevel: TOOL_RISK_LEVELS.LOW, handler: async () => { events.push('tool'); } });
  const audit = new AuditLogger();
  const runtime = new AgentRuntime({ toolRegistry: registry, permissionPolicy: new PermissionPolicy(), approvalStore: new ApprovalStore(), auditLogger: audit });
  const result = await runtime.run({ request: 'do test', task, project, agent: makeAgent({ steps: [{ tool: 'test.low', input: {} }] }), execution });
  assert.equal(result.status, 'COMPLETED');
  assert.deepEqual(events, ['tool']);
  assert.deepEqual(audit.list().map(e => e.event), ['REQUEST', 'PLAN', 'EXECUTE', 'OBSERVE', 'VALIDATE', 'COMPLETE']);
});

test('pauses medium-risk actions for approval', async () => {
  const registry = new ToolRegistry(); let called = false;
  registry.register({ name: 'test.medium', description: 'Approval test tool', riskLevel: TOOL_RISK_LEVELS.MEDIUM, handler: async () => { called = true; } });
  const approvals = new ApprovalStore();
  const runtime = new AgentRuntime({ toolRegistry: registry, permissionPolicy: new PermissionPolicy(), approvalStore: approvals, auditLogger: new AuditLogger() });
  const result = await runtime.run({ request: 'approval test', task, project, agent: makeAgent({ steps: [{ tool: 'test.medium', input: {} }] }), execution });
  assert.equal(result.status, 'WAITING_FOR_APPROVAL');
  assert.equal(called, false);
  assert.equal(approvals.get(result.output.approvalId).status, 'PENDING');
});

test('rejects invalid tool invocation', async () => {
  const runtime = new AgentRuntime({ toolRegistry: new ToolRegistry(), permissionPolicy: new PermissionPolicy(), approvalStore: new ApprovalStore(), auditLogger: new AuditLogger() });
  await assert.rejects(() => runtime.run({ request: 'invalid tool', task, project, agent: makeAgent({ steps: [{ tool: 'does.not.exist', input: {} }] }), execution }), InvalidToolInvocationError);
});
