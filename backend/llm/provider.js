import { ModelError } from '../errors/index.js';

export class LLMProvider {
  async generateCodingDecision(){throw new ModelError('LLMProvider.generateCodingDecision() is not implemented');}
  async generateCodingPlan(context){const response=await this.generateCodingDecision(context);return response?.decision??response;}
}
export class MockLLMProvider extends LLMProvider {
  
  constructor(planOrDecisions){super();this.plan=planOrDecisions;this.decisions=Array.isArray(planOrDecisions)?[...planOrDecisions]:null;}
  async generateCodingDecision(){
    if(this.decisions){if(!this.decisions.length)throw new ModelError('MockLLMProvider has no remaining decisions');return{decision:structuredClone(this.decisions.shift()),usage:null,model:'mock',latencyMs:0};}
    if(!this.plan)throw new ModelError('MockLLMProvider requires a plan');
    return{decision:structuredClone({type:'plan',goal:this.plan.goal,assumptions:this.plan.assumptions,filesToInspect:this.plan.filesToInspect,filesToChange:this.plan.filesToChange,actions:this.plan.actions,tests:this.plan.tests,risks:this.plan.risks,tool:null,arguments:null,result:null}),usage:null,model:'mock',latencyMs:0};
  }
  async generateCodingPlan(context){const response=await this.generateCodingDecision(context);if(response.decision.type!=='plan')throw new ModelError('MockLLMProvider decision is not a plan');return response.decision;}
}
