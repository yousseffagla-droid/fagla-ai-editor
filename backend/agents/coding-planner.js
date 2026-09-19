import { LLMProvider } from '../llm/provider.js';
import { validateCodingDecision } from '../llm/response-schema.js';

export class CodingPlanner {
  constructor(provider = new LLMProvider()) { this.provider = provider; }
  async generateDecision(context) {
    const response = await this.provider.generateCodingDecision(context);
    return validateCodingDecision(response?.decision ?? response);
  }
  async generatePlan(context) {
    const decision = await this.generateDecision(context);
    if (decision.type !== 'plan') throw new Error('CodingPlanner expected a plan decision');
    return decision;
  }
}