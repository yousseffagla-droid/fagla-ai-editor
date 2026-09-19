import { BaseAgent, createAgentResult } from './contracts.js';
import { createCodingPlan, validateCodingPlan } from './coding-plan.js';
import { CODING_AGENT_STATES, transitionCodingState } from './coding-state.js';
import { validateCodingDecision } from '../llm/response-schema.js';

export class CodingAgent extends BaseAgent {
  constructor({ planner, auditLogger = null } = {}) {
    super({name:'coding-agent-v1',purpose:'Safely reason and execute bounded code changes inside an isolated project workspace.',capabilities:['project-inspection','file-editing','test-execution','validation','git-inspection','llm-reasoning'],permissions:['READ','WRITE','EXECUTE','GIT']});
    if(!planner||typeof planner.generateDecision!=='function')throw new TypeError('CodingAgent requires a planner with generateDecision()');
    this.planner=planner;this.auditLogger=auditLogger;this.state=CODING_AGENT_STATES.IDLE;this.lastPlan=null;
  }
  transition(to){this.state=transitionCodingState(this.state,to);return this.state;}
  async decide(context){
    const decision=validateCodingDecision(await this.planner.generateDecision(context));
    await this.auditLogger?.append({event:'llm.response.received',taskId:context.task.id,agentId:this.name,decisionType:decision.type});
    if(decision.type==='plan'){
      this.lastPlan=createCodingPlan(decision);
      if(this.state===CODING_AGENT_STATES.IDLE)this.transition(CODING_AGENT_STATES.PLANNING);
      if(this.state===CODING_AGENT_STATES.PLANNING)this.transition(CODING_AGENT_STATES.EXECUTING);
      await this.auditLogger?.append({event:'coding.plan.created',taskId:context.task.id,agentId:this.name,plan:this.lastPlan});
    }
    return decision;
  }
  async plan(context){
    const decision=await this.decide(context);
    if(decision.type!=='plan')throw new Error('Coding Agent initial decision must be a plan');
    return {steps:decision.actions,...decision};
  }
  markTesting(){if(this.state===CODING_AGENT_STATES.EXECUTING)this.transition(CODING_AGENT_STATES.TESTING);}
  markWaitingApproval(){if(this.state===CODING_AGENT_STATES.EXECUTING)this.transition(CODING_AGENT_STATES.WAITING_APPROVAL);}
  async execute(context){
    validateCodingPlan(this.lastPlan);
    if(this.state===CODING_AGENT_STATES.EXECUTING)this.markTesting();
    if(this.state===CODING_AGENT_STATES.TESTING)this.transition(CODING_AGENT_STATES.VALIDATING);
    if(this.state!==CODING_AGENT_STATES.VALIDATING)throw new Error('CodingAgent cannot validate from state '+this.state);
    const result=createAgentResult({status:'COMPLETED',output:{goal:this.lastPlan.goal,filesChanged:this.lastPlan.filesToChange,tests:this.lastPlan.tests},observations:['Reasoning and tools were executed through the core runtime.'],validation:{state:this.state,taskId:context.task.id}});
    this.transition(CODING_AGENT_STATES.COMPLETED);
    await this.auditLogger?.append({event:'coding.completed',taskId:context.task.id,agentId:this.name});
    return result;
  }
}