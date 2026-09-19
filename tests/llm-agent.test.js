import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from '../backend/llm/openai-provider.js';
import { MockLLMProvider } from '../backend/llm/provider.js';
import { createLLMContext, LLM_CONTEXT_LIMITS } from '../backend/llm/context-builder.js';
import { validateCodingDecision } from '../backend/llm/response-schema.js';
import { CodingAgent } from '../backend/agents/coding-agent.js';
import { CodingPlanner } from '../backend/agents/coding-planner.js';
import { AgentRuntime } from '../backend/runtime/agent-runtime.js';
import { ToolRegistry, ToolExecutor } from '../backend/tools/registry.js';
import { registerCodingTools } from '../backend/tools/coding-tools.js';
import { PermissionPolicy } from '../backend/permissions/policy.js';
import { InMemoryApprovalStore, APPROVAL_STATUSES } from '../backend/approvals/store.js';
import { AuditLogger } from '../backend/logging/audit-log.js';
import { createExecutionContext } from '../backend/runtime/execution-context.js';
import { createTask } from '../backend/tasks/task.js';
import { createTaskWorkspace } from '../backend/projects/workspace.js';
import { PermissionDeniedError, ValidationError, AgentExecutionError, ModelError } from '../backend/errors/index.js';
import path from 'node:path';

const fixture=path.resolve('tests/fixtures/coding-project');
const plan={goal:'inspect project',assumptions:[],filesToInspect:['src/math.js'],filesToChange:[],actions:[],tests:['npm test'],risks:[]};

function decision(type,extra={}){return {type,goal:plan.goal,assumptions:[],filesToInspect:['src/math.js'],filesToChange:[],actions:[],tests:['npm test'],risks:[],tool:null,arguments:null,result:null,...extra};}
async function runtimeFor(decisions,permissions=['READ','WRITE','EXECUTE','GIT']){
  const workspace=createTaskWorkspace({projectId:'p',taskId:'t',root:fixture});
  const auditLogger=new AuditLogger(),registry=new ToolRegistry();
  registerCodingTools({registry,auditLogger});
  const execution=createExecutionContext({taskId:'t',projectId:'p',agentId:'coding-agent-v1',workspaceId:workspace.workspaceId,requestId:'r',permissions,metadata:{workspace}});
  const agent=new CodingAgent({planner:new CodingPlanner(new MockLLMProvider(decisions)),auditLogger});
  const task=createTask({id:'t',projectId:'p',request:'test coding task'});
  const approvals=new InMemoryApprovalStore({auditLogger});
  const runtime=new AgentRuntime({toolRegistry:registry,toolExecutor:new ToolExecutor(registry),permissionPolicy:new PermissionPolicy(),approvalStore:approvals,auditLogger});
  return {workspace,auditLogger,execution,agent,task,approvals,runtime};
}

test('MockLLMProvider remains deterministic and provider-neutral',async()=>{const p=new MockLLMProvider(plan);const r=await p.generateCodingDecision({});assert.equal(r.model,'mock');assert.equal(r.decision.type,'plan');assert.equal(r.decision.goal,plan.goal);});

test('OpenAIProvider reads configuration from environment safely',()=>{const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-key';const p=new OpenAIProvider({fetchImpl:async()=>{throw new Error('unused');}});assert.equal(p.apiKey,'test-key');if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;});

test('OpenAIProvider rejects missing API key without making a request',()=>{assert.throws(()=>new OpenAIProvider({apiKey:''}),ModelError);});

test('OpenAIProvider validates structured response and exposes safe usage metadata',async()=>{
  let seenHeaders;
  const output=JSON.stringify(decision('final',{result:{ok:true}}));
  const p=new OpenAIProvider({apiKey:'secret',model:'test-model',fetchImpl:async(_url,options)=>{seenHeaders=options.headers;return {ok:true,json:async()=>({model:'test-model',output_text:output,usage:{input_tokens:3,output_tokens:2,total_tokens:5}})};}});
  const r=await p.generateCodingDecision({});
  assert.equal(r.decision.type,'final');assert.equal(r.usage.total_tokens,5);assert.equal(r.model,'test-model');assert.equal(seenHeaders.Authorization,'Bearer secret');
});

test('malformed structured model output is rejected',()=>{assert.throws(()=>validateCodingDecision({type:'unknown'}),ValidationError);assert.throws(()=>validateCodingDecision(decision('tool_call',{tool:'missing',arguments:null})),ValidationError);});

test('context builder bounds content and excludes sensitive fields',()=>{
  const ctx=createLLMContext({request:'x',task:{id:'t',status:'RUNNING',projectId:'p'},project:{apiKey:'hidden',name:'p'},workspace:{projectId:'p',workspaceId:'w',taskId:'t',mode:'ISOLATED'},files:['src/a.js','.env'],toolResults:[{content:'x'.repeat(50000),token:'secret'}]});
  assert.ok(JSON.stringify(ctx).length<=LLM_CONTEXT_LIMITS.MAX_CONTEXT_CHARS);assert.equal(ctx.project.apiKey,undefined);assert.deepEqual(ctx.files,['src/a.js']);
});

test('model tool call executes through registry and then returns to model',async()=>{
  const {runtime,task,workspace,execution,agent}=await runtimeFor([
    decision('tool_call',{tool:'coding.read_file',arguments:{path:'src/math.js'}}),
    decision('final',{result:{status:'done'}})
  ],['READ']);
  const result=await runtime.run({request:task.request,task,project:{id:'p'},workspace,agent,execution});
  assert.equal(result.status,'COMPLETED');assert.equal(agent.state,'COMPLETED');
});

test('model cannot execute an unregistered tool',async()=>{
  const x=await runtimeFor([decision('tool_call',{tool:'coding.not_registered',arguments:{}})]);
  await assert.rejects(()=>x.runtime.run({request:x.task.request,task:x.task,project:{id:'p'},workspace:x.workspace,agent:x.agent,execution:x.execution}),/Unknown tool/);
});

test('model cannot bypass permission policy',async()=>{
  const x=await runtimeFor([decision('tool_call',{tool:'coding.update_file',arguments:{path:'src/math.js',content:'bad'}})],['READ']);
  await assert.rejects(()=>x.runtime.run({request:x.task.request,task:x.task,project:{id:'p'},workspace:x.workspace,agent:x.agent,execution:x.execution}),PermissionDeniedError);
});

test('model cannot read sensitive configuration files',async()=>{
  const x=await runtimeFor([decision('tool_call',{tool:'coding.read_file',arguments:{path:'.env'}})],['READ']);
  await assert.rejects(()=>x.runtime.run({request:x.task.request,task:x.task,project:{id:'p'},workspace:x.workspace,agent:x.agent,execution:x.execution}),PermissionDeniedError);
});

test('git commit remains approval-gated and does not execute',async()=>{
  const x=await runtimeFor([decision('tool_call',{tool:'coding.git_commit',arguments:{}})]);
  const result=await x.runtime.run({request:x.task.request,task:x.task,project:{id:'p'},workspace:x.workspace,agent:x.agent,execution:x.execution});
  assert.equal(result.status,'WAITING_FOR_APPROVAL');const approvals=await x.approvals.get(result.output.approvalId);assert.ok(approvals||result.output.approvalRequired);
});

test('git merge remains denied',async()=>{
  const x=await runtimeFor([decision('tool_call',{tool:'coding.git_merge',arguments:{}})]);
  await assert.rejects(()=>x.runtime.run({request:x.task.request,task:x.task,project:{id:'p'},workspace:x.workspace,agent:x.agent,execution:x.execution}),PermissionDeniedError);
});

test('test failure observation can return control to the model once',async()=>{
  const x=await runtimeFor([
    decision('tool_call',{tool:'coding.run_tests',arguments:{command:'not allowed',args:[]}}),
    decision('final',{result:{fixed:true}})
  ]);
  const result=await x.runtime.run({request:x.task.request,task:x.task,project:{id:'p'},workspace:x.workspace,agent:x.agent,execution:x.execution});
  assert.equal(result.status,'COMPLETED');
});

test('loop limit stops a non-progressing model',async()=>{
  const decisions=Array.from({length:20},()=>decision('tool_call',{tool:'coding.read_file',arguments:{path:'src/math.js'}}));
  const x=await runtimeFor(decisions,['READ']);
  await assert.rejects(()=>x.runtime.run({request:x.task.request,task:x.task,project:{id:'p'},workspace:x.workspace,agent:x.agent,execution:x.execution}),AgentExecutionError);
  const events=await x.auditLogger.list();assert.ok(events.some(e=>e.event==='llm.loop_limit_reached'));
});

test('audit records LLM interaction events without secret fields',async()=>{
  const x=await runtimeFor([decision('final',{result:{ok:true}})]);
  await x.runtime.run({request:x.task.request,task:x.task,project:{id:'p'},workspace:x.workspace,agent:x.agent,execution:x.execution});
  const events=await x.auditLogger.list();const names=events.map(e=>e.event);
  assert.ok(names.includes('llm.context.built'));assert.ok(names.includes('llm.response.received'));assert.equal(events.some(e=>JSON.stringify(e).includes('OPENAI_API_KEY')),false);
});

test('provider integration test', {skip: process.env.RUN_LLM_INTEGRATION_TESTS!=='true'||!process.env.OPENAI_API_KEY}, async()=>{
  const p=new OpenAIProvider();const r=await p.generateCodingDecision({request:'Return a final empty-safe result',task:{id:'integration',status:'RUNNING',projectId:'p'},workspace:{projectId:'p',workspaceId:'w',taskId:'integration',mode:'ISOLATED'}});
  assert.ok(r.decision);
});
