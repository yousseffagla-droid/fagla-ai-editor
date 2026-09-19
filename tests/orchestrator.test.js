import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Orchestrator, CapabilityRegistry, TaskDecomposer, ResultAggregator, createCodingCapability, createResearchCapability, ORCHESTRATOR_STATES } from '../backend/orchestrator/index.js';
import { AuditLogger } from '../backend/logging/audit-log.js';
import { ToolRegistry, ToolExecutor } from '../backend/tools/registry.js';
import { PermissionPolicy } from '../backend/permissions/policy.js';
import { InMemoryApprovalStore } from '../backend/approvals/store.js';
import { AgentRuntime } from '../backend/runtime/agent-runtime.js';
import { createTaskWorkspace } from '../backend/projects/workspace.js';
import { createExecutionContext } from '../backend/runtime/execution-context.js';
import { CodingAgent } from '../backend/agents/coding-agent.js';
import { CodingPlanner } from '../backend/agents/coding-planner.js';
import { MockLLMProvider } from '../backend/llm/provider.js';
import { registerCodingTools } from '../backend/tools/coding-tools.js';
import { createCapability } from '../backend/orchestrator/contracts.js';
import { ValidationError, PermissionDeniedError } from '../backend/errors/index.js';

const fixture=path.resolve('tests/fixtures/engineering-project');

function decisions({commit=false}={}){
  const plan={type:'plan',goal:'Update project',assumptions:[],filesToInspect:['src/calculator.js'],filesToChange:[],actions:[{tool:'coding.read_file',input:{path:'src/calculator.js'}},{tool:'coding.run_tests',input:{command:'npm test',args:['test']}}],tests:['npm test'],risks:[],tool:null,arguments:null,result:null};
  const done={type:'final',goal:'Update project',assumptions:[],filesToInspect:[],filesToChange:[],actions:[],tests:['npm test'],risks:[],tool:null,arguments:null,result:{summary:'done'}};
  if(!commit)return [plan,done];
  return [ {...plan,actions:[{tool:'coding.git_commit',input:{}}]}, done ];
}
async function setup({research=false,commit=false,permissions=null}={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'fagla-orch-'));await fs.cp(fixture,root,{recursive:true});
  const auditLogger=new AuditLogger(),registry=new ToolRegistry();registerCodingTools({registry,auditLogger});
  const approvals=new InMemoryApprovalStore({auditLogger});
  const runtime=new AgentRuntime({toolRegistry:registry,toolExecutor:new ToolExecutor(registry),permissionPolicy:new PermissionPolicy(),approvalStore:approvals,auditLogger});
  const agent=new CodingAgent({planner:new CodingPlanner(new MockLLMProvider(decisions({commit}))),auditLogger});
  const capabilities=new CapabilityRegistry();capabilities.register(createResearchCapability());
  let captured=null;
  const coding=createCodingCapability({runtime,codingAgent:agent,project:{id:'p',type:'node'},workspaceFactory:async({taskId,projectId})=>createTaskWorkspace({projectId,taskId,root}),auditLogger});
  const wrapped=createCapability({id:'coding',description:'wrapped coding',supportedTaskTypes:['coding'],execute:async(ctx,task)=>{captured={request:task.userRequest,input:task.input,permissions:[...agent.permissions]};return coding.execute(ctx,task);}});
  capabilities.register(wrapped);
  const orchestrator=new Orchestrator({capabilityRegistry:capabilities,auditLogger,limits:{maxTasks:8,maxSteps:12,maxDependencyDepth:8}});
  return {root,auditLogger,approvals,runtime,agent,capabilities,orchestrator,captured:()=>captured};
}
test('orchestrator initializes with authoritative state machine',()=>{const o=new Orchestrator({capabilityRegistry:new CapabilityRegistry(),auditLogger:new AuditLogger()});assert.equal(o.state,ORCHESTRATOR_STATES.PLANNING);});
test('task understanding classifies coding, research and composite requests',()=>{const d=new TaskDecomposer();assert.equal(d.understand('fix the website').type,'coding');assert.equal(d.understand('research competitors').type,'research');assert.equal(d.understand('research competitors then build a landing page').type,'composite');});
test('capability registry rejects duplicates and routes by task type',()=>{const r=new CapabilityRegistry();const c=createResearchCapability();r.register(c);assert.equal(r.get('research'),c);assert.equal(r.discover('research').length,1);assert.throws(()=>r.register(c),ValidationError);});
test('composite decomposition creates a dependency graph',()=>{const d=new TaskDecomposer();const tasks=d.decompose({request:'research competitors then build a landing page',intent:d.understand('research competitors then build a landing page'),rootTaskId:'root'});assert.equal(tasks.length,2);assert.deepEqual(tasks[1].dependencies,['root:research']);assert.doesNotThrow(()=>d.validate(tasks));});
test('dependency cycles are rejected',()=>{const d=new TaskDecomposer();assert.throws(()=>d.validate([{id:'a',dependencies:['b']},{id:'b',dependencies:['a']}]),/Cyclic/);});
test('unsupported task returns structured unsupported result',async()=>{const x=await setup();try{const r=await x.orchestrator.run({userRequest:'tell me a joke',project:{id:'p'},workspaceFactory:async()=>null,runtime:x.runtime,codingAgent:x.agent});assert.equal(r.status,'completed');assert.equal(r.tasks[0].output.status,'UNSUPPORTED');}finally{await fs.rm(x.root,{recursive:true,force:true});}});
test('coding-only orchestration uses the existing Coding Agent runtime',async()=>{const x=await setup();try{const r=await x.orchestrator.run({userRequest:'update the project',project:{id:'p',type:'node'},workspaceFactory:async({taskId,projectId})=>createTaskWorkspace({projectId,taskId,root:x.root}),runtime:x.runtime,codingAgent:x.agent});assert.equal(r.status,'completed');assert.equal(r.results[0].capability,'coding');assert.equal(r.validation.requiredTasksCompleted,true);}finally{await fs.rm(x.root,{recursive:true,force:true});}});
test('research routes to the deterministic Research capability',async()=>{const x=await setup();try{const r=await x.orchestrator.run({userRequest:'research competitors',project:{id:'p'},workspaceFactory:async()=>null,runtime:x.runtime,codingAgent:x.agent});assert.equal(r.status,'completed');assert.equal(r.results[0].output.output.type,'research.result');}finally{await fs.rm(x.root,{recursive:true,force:true});}});
test('composite execution runs research before coding and passes structured results',async()=>{const x=await setup();try{const r=await x.orchestrator.run({userRequest:'research competitors then update the project',project:{id:'p',type:'node'},workspaceFactory:async({taskId,projectId})=>createTaskWorkspace({projectId,taskId,root:x.root}),runtime:x.runtime,codingAgent:x.agent});assert.equal(r.status,'completed');assert.equal(r.tasks[0].status,'completed');assert.equal(r.tasks[1].status,'completed');assert.equal(x.captured().input.context[0].output.type,'research.result');assert.match(x.captured().request,/Structured dependency results/);}finally{await fs.rm(x.root,{recursive:true,force:true});}});
test('result aggregation preserves task outputs and validation',()=>{const a=new ResultAggregator();const tasks=[{id:'a',type:'research',assignedCapability:'research',status:'completed',output:{x:1},errors:[]}];const v=a.validate(tasks);const r=a.aggregate('root',tasks,v);assert.equal(r.status,'completed');assert.equal(r.results[0].output.x,1);});
test('task failure stops dependent orchestration',async()=>{const x=await setup();const failing=createCapability({id:'research',description:'fail',supportedTaskTypes:['research'],execute:async()=>{throw new Error('research failed')}});x.capabilities.capabilities.set('research',failing);try{await assert.rejects(()=>x.orchestrator.run({userRequest:'research competitors then update the project',project:{id:'p'},workspaceFactory:async({taskId,projectId})=>createTaskWorkspace({projectId,taskId,root:x.root}),runtime:x.runtime,codingAgent:x.agent}),/research failed/);}finally{await fs.rm(x.root,{recursive:true,force:true});}});
test('permission boundary is not expanded by the orchestrator',async()=>{const x=await setup();try{await x.orchestrator.run({userRequest:'update the project',project:{id:'p',type:'node'},workspaceFactory:async({taskId,projectId})=>createTaskWorkspace({projectId,taskId,root:x.root}),runtime:x.runtime,codingAgent:x.agent});assert.deepEqual(x.captured().permissions,['READ','WRITE','EXECUTE','GIT']);}finally{await fs.rm(x.root,{recursive:true,force:true});}});
test('approval requirement remains enforced by AgentRuntime',async()=>{const x=await setup({commit:true});try{const r=await x.orchestrator.run({userRequest:'update the project',project:{id:'p',type:'node'},workspaceFactory:async({taskId,projectId})=>createTaskWorkspace({projectId,taskId,root:x.root}),runtime:x.runtime,codingAgent:x.agent});assert.equal(r.status,'waiting');assert.equal(x.orchestrator.state,ORCHESTRATOR_STATES.WAITING);}finally{await fs.rm(x.root,{recursive:true,force:true});}});
test('malformed decomposition is rejected before execution',()=>{const d=new TaskDecomposer({maxTasks:1});assert.throws(()=>d.validate([{id:'a',dependencies:[]},{id:'b',dependencies:[]}]),/plan size/);});
test('orchestration bounds stop excessive execution',async()=>{const audit=new AuditLogger(),r=new CapabilityRegistry();let count=0;r.register(createCapability({id:'coding',description:'loop',supportedTaskTypes:['coding'],execute:async()=>{count++;return {status:'COMPLETED',output:{ok:true}}}}));const o=new Orchestrator({capabilityRegistry:r,auditLogger:audit,limits:{maxTasks:8,maxSteps:0,maxDependencyDepth:8}});await assert.rejects(()=>o.run({userRequest:'update project',project:{id:'p'}}),/step limit/);assert.equal(count,0);});
test('audit events are emitted and sanitized',async()=>{const x=await setup();try{await x.orchestrator.run({userRequest:'research competitors',project:{id:'p'},runtime:x.runtime,codingAgent:x.agent});const events=await x.auditLogger.list();const names=events.map(e=>e.event);for(const n of ['orchestration.created','orchestration.planned','orchestration.task.created','orchestration.task.routed','orchestration.task.started','orchestration.task.completed','orchestration.validation.completed','orchestration.completed'])assert.ok(names.includes(n),n);assert.equal(events.some(e=>JSON.stringify(e).includes('OPENAI_API_KEY')),false);}finally{await fs.rm(x.root,{recursive:true,force:true});}});
test('workspace boundary remains authoritative for coding capability',async()=>{const x=await setup();try{const ws=createTaskWorkspace({projectId:'p',taskId:'manual',root:x.root});assert.throws(()=>path.resolve(ws.root,'../../outside'),()=>false);const result=await x.orchestrator.run({userRequest:'update the project',project:{id:'p',type:'node'},workspaceFactory:async({taskId,projectId})=>createTaskWorkspace({projectId,taskId,root:x.root}),runtime:x.runtime,codingAgent:x.agent});assert.equal(result.status,'completed');}finally{await fs.rm(x.root,{recursive:true,force:true});}});
