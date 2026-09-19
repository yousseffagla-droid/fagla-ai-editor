import crypto from 'node:crypto';
import { createCapability } from './contracts.js';
import { createExecutionContext } from '../runtime/execution-context.js';
import { createAgentResult } from '../agents/contracts.js';
import { ValidationError } from '../errors/index.js';

export function createCodingCapability({runtime,codingAgent,project,workspaceFactory,auditLogger}){
  return createCapability({id:'coding',description:'Existing Milestone 4 Coding Agent through AgentRuntime',supportedTaskTypes:['coding'],execute:async(ctx,task)=>{
    const workspace=await workspaceFactory({taskId:task.id,projectId:project.id});
    const execution=createExecutionContext({taskId:task.id,projectId:project.id,agentId:codingAgent.name,workspaceId:workspace.workspaceId,requestId:crypto.randomUUID(),permissions:[...codingAgent.permissions],metadata:{workspace}});
    return runtime.run({request:task.userRequest,task:{id:task.id,projectId:project.id,request:task.userRequest,status:'CREATED'},project,workspace,agent:codingAgent,execution});
  }});
}
export function createResearchCapability(){
  return createCapability({id:'research',description:'Deterministic research adapter for orchestration tests',supportedTaskTypes:['research'],execute:async(_ctx,task)=>{
    const findings=[{topic:'competitor-landscape',finding:'Deterministic fixture finding for orchestration validation.'}];
    return createAgentResult({status:'COMPLETED',output:{type:'research.result',findings,sources:[],summary:'Controlled deterministic research result.'},validation:{controlled:true}});
  }});
}
