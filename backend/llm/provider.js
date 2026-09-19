import { ModelError } from '../errors/index.js';

export class LLMProvider {
  async generateCodingPlan() { throw new ModelError('LLMProvider.generateCodingPlan() is not implemented'); }
}
export class MockLLMProvider extends LLMProvider {
  constructor(plan) { super(); this.plan = plan; }
  async generateCodingPlan() {
    if (!this.plan) throw new ModelError('MockLLMProvider requires a plan');
    return structuredClone(this.plan);
  }
}
