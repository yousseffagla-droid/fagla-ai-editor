import { LLMProvider } from '../llm/provider.js';
export class CodingPlanner {
  constructor(provider = new LLMProvider()) { this.provider = provider; }
  async generatePlan(context) {
    return this.provider.generateCodingPlan({ request: context.request, project: context.project, workspace: { workspaceId: context.workspace.workspaceId, root: context.workspace.root } });
  }
}
