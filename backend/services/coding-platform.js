import { CodingAgent } from '../agents/coding-agent.js';
import { CodingPlanner } from '../agents/coding-planner.js';
import { MockLLMProvider } from '../llm/provider.js';
import { OpenAIProvider } from '../llm/openai-provider.js';
import { registerCodingTools } from '../tools/coding-tools.js';

export function createCodingPlatform({platform,plan,provider=null,useRealLLM=Boolean(process.env.OPENAI_API_KEY)}={}){
  const llmProvider=provider??(useRealLLM?new OpenAIProvider():new MockLLMProvider(plan));
  const planner=new CodingPlanner(llmProvider);
  registerCodingTools({registry:platform.toolRegistry,auditLogger:platform.auditLogger});
  const agent=new CodingAgent({planner,auditLogger:platform.auditLogger});
  return Object.freeze({...platform,codingAgent:agent,codingPlanner:planner,llmProvider});
}