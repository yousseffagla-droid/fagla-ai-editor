import { CodingAgent } from '../agents/coding-agent.js';
import { CodingPlanner } from '../agents/coding-planner.js';
import { MockLLMProvider } from '../llm/provider.js';
import { registerCodingTools } from '../tools/coding-tools.js';

export function createCodingPlatform({ platform, plan } = {}) {
  const provider = new MockLLMProvider(plan);
  const planner = new CodingPlanner(provider);
  registerCodingTools({ registry: platform.toolRegistry, auditLogger: platform.auditLogger });
  const agent = new CodingAgent({ planner, auditLogger: platform.auditLogger });
  return Object.freeze({ ...platform, codingAgent: agent, codingPlanner: planner, llmProvider: provider });
}
