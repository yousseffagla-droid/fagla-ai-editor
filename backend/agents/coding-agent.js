import { BaseAgent, createAgentResult } from './contracts.js';
import { createCodingPlan, validateCodingPlan } from './coding-plan.js';
import { CODING_AGENT_STATES, transitionCodingState } from './coding-state.js';

export class CodingAgent extends BaseAgent {
  constructor({ planner, auditLogger = null } = {}) {
    super({
      name: 'coding-agent-v1',
      purpose: 'Safely plan and execute bounded code changes inside an isolated project workspace.',
      capabilities: ['project-inspection', 'file-editing', 'test-execution', 'validation', 'git-inspection'],
      permissions: ['READ', 'WRITE', 'EXECUTE', 'GIT']
    });
    if (!planner || typeof planner.generatePlan !== 'function') throw new TypeError('CodingAgent requires a planner with generatePlan()');
    this.planner = planner; this.auditLogger = auditLogger; this.state = CODING_AGENT_STATES.IDLE; this.lastPlan = null;
  }
  transition(to) { this.state = transitionCodingState(this.state, to); return this.state; }
  async plan(context) {
    this.transition(CODING_AGENT_STATES.PLANNING);
    const plan = createCodingPlan(await this.planner.generatePlan(context));
    this.lastPlan = plan;
    await this.auditLogger?.append({ event: 'coding.plan.created', taskId: context.task.id, agentId: this.name, plan });
    this.transition(CODING_AGENT_STATES.EXECUTING);
    return { steps: plan.actions, ...plan };
  }
  markTesting() { if (this.state === CODING_AGENT_STATES.EXECUTING) this.transition(CODING_AGENT_STATES.TESTING); }
  markWaitingApproval() { if (this.state === CODING_AGENT_STATES.EXECUTING) this.transition(CODING_AGENT_STATES.WAITING_APPROVAL); }
  async execute(context) {
    validateCodingPlan(this.lastPlan);
    if (this.state === CODING_AGENT_STATES.EXECUTING) this.markTesting();
    if (this.state !== CODING_AGENT_STATES.TESTING && this.state !== CODING_AGENT_STATES.VALIDATING) throw new Error('CodingAgent cannot execute from state ' + this.state);
    if (this.state === CODING_AGENT_STATES.TESTING) this.transition(CODING_AGENT_STATES.VALIDATING);
    const result = createAgentResult({
      status: 'COMPLETED',
      output: { goal: this.lastPlan.goal, filesChanged: this.lastPlan.filesToChange, tests: this.lastPlan.tests },
      observations: ['Plan executed through the core runtime and registered tools.'],
      validation: { state: this.state, taskId: context.task.id }
    });
    this.transition(CODING_AGENT_STATES.COMPLETED);
    await this.auditLogger?.append({ event: 'coding.completed', taskId: context.task.id, agentId: this.name });
    return result;
  }
}
