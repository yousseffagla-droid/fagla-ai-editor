import { createAgentContext, createAgentResult } from '../agents/contracts.js';
import { ApprovalRequiredError, InvalidToolInvocationError } from '../errors/index.js';

export class AgentRuntime {
  constructor({ toolRegistry, permissionPolicy, approvalStore, auditLogger }) {
    this.toolRegistry = toolRegistry; this.permissionPolicy = permissionPolicy; this.approvalStore = approvalStore; this.auditLogger = auditLogger;
  }
  async run({ request, task, project, agent, execution, memory = {} }) {
    const context = createAgentContext({ request, task, project, execution, memory });
    await this.auditLogger.record({ event: 'REQUEST', ...execution, agent: agent.name });
    try {
      await this.auditLogger.record({ event: 'PLAN', ...execution, agent: agent.name });
      const plan = typeof agent.plan === 'function' ? await agent.plan(context) : { steps: [] };
      for (const step of plan.steps ?? []) {
        await this.auditLogger.record({ event: 'EXECUTE', ...execution, agent: agent.name, tool: step.tool });
        if (!this.toolRegistry.has(step.tool)) throw new InvalidToolInvocationError(`Unknown tool: ${step.tool}`);
        const definition = this.toolRegistry.get(step.tool);
        const decision = this.permissionPolicy.evaluate(definition, execution);
        if (decision.status === 'REQUIRES_APPROVAL') {
          const approval = await this.approvalStore.create({ taskId: task.id, projectId: project.id, tool: step.tool, reason: decision.reason, requestedAt: new Date().toISOString() });
          await this.auditLogger.record({ event: 'APPROVAL', ...execution, agent: agent.name, tool: step.tool, approvalId: approval.id });
          return createAgentResult({ status: 'WAITING_FOR_APPROVAL', output: { approvalId: approval.id }, observations: ['Execution paused until explicit human approval.'] });
        }
        if (decision.status !== 'ALLOW') throw new ApprovalRequiredError(decision.reason);
        await this.toolRegistry.execute(step.tool, step.input, execution);
      }
      await this.auditLogger.record({ event: 'OBSERVE', ...execution, agent: agent.name });
      const result = await agent.execute(context);
      await this.auditLogger.record({ event: 'VALIDATE', ...execution, agent: agent.name });
      if (result.status === 'COMPLETED') await this.auditLogger.record({ event: 'COMPLETE', ...execution, agent: agent.name });
      return result;
    } catch (error) {
      await this.auditLogger.record({ event: 'FAILED', ...execution, agent: agent.name, error: error.name });
      throw error;
    }
  }
}
