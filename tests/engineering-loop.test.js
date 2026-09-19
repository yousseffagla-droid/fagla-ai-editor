import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ToolRegistry, ToolExecutor } from '../backend/tools/registry.js';
import { PermissionPolicy } from '../backend/permissions/policy.js';
import { AuditLogger } from '../backend/logging/audit-log.js';
import { createExecutionContext } from '../backend/runtime/execution-context.js';
import { createTaskWorkspace, resolveWorkspacePath } from '../backend/projects/workspace.js';
import { CodingAgent } from '../backend/agents/coding-agent.js';
import { MockLLMProvider } from '../backend/llm/provider.js';
import { CodingPlanner } from '../backend/agents/coding-planner.js';
import { registerCodingTools } from '../backend/tools/coding-tools.js';
import { createTask } from '../backend/tasks/task.js';
import { AgentRuntime } from '../backend/runtime/agent-runtime.js';
import { InMemoryApprovalStore } from '../backend/approvals/store.js';
import { PermissionDeniedError } from '../backend/errors/index.js';

const fixture=path.resolve('tests/fixtures/engineering-project');

function makeDecisions(){
  const plan={type:'plan',goal:'Fix calculator addition',assumptions:['Node ESM project'],filesToInspect:['src/calculator.js','tests/calculator.test.js'],filesToChange:['src/calculator.js'],actions:[
    {tool:'coding.inspect_project',input:{}},
    {tool:'coding.read_file',input:{path:'src/calculator.js'}},
    {tool:'coding.read_file',input:{path:'tests/calculator.test.js'}},
    {tool:'coding.run_tests',input:{command:'npm test',args:['test']}}
  ],tests:['npm test'],risks:['Only the isolated fixture workspace may be modified'],tool:null,arguments:null,result:null};
  const fix={type:'tool_call',goal:'Fix calculator addition',assumptions:[],filesToInspect:['src/calculator.js'],filesToChange:['src/calculator.js'],actions:[],tests:['npm test'],risks:[],tool:'coding.update_file',arguments:{path:'src/calculator.js',content:'export function add(a,b){return a+b;}\n'},result:null};
  const rerun={type:'tool_call',goal:'Verify the correction',assumptions:[],filesToInspect:[],filesToChange:[],actions:[],tests:['npm test'],risks:[],tool:'coding.run_tests',arguments:{command:'npm test',args:['test']},result:null};
  const done={type:'final',goal:'Fix calculator addition',assumptions:[],filesToInspect:[],filesToChange:['src/calculator.js'],actions:[],tests:['npm test'],risks:[],tool:null,arguments:null,result:{summary:'Calculator addition fixed and tests passed.'}};
  return [plan,fix,rerun,done];
}

async function setup(){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'fagla-engineering-'));
  await fs.cp(fixture,root,{recursive:true});
  const workspace=createTaskWorkspace({projectId:'engineering-project',taskId:'engineering-task',root});
  const auditLogger=new AuditLogger(),registry=new ToolRegistry();
  registerCodingTools({registry,auditLogger});
  const execution=createExecutionContext({taskId:'engineering-task',projectId:'engineering-project',agentId:'coding-agent-v1',workspaceId:workspace.workspaceId,requestId:'engineering-request',permissions:['READ','WRITE','EXECUTE','GIT'],metadata:{workspace}});
  const provider=new MockLLMProvider(makeDecisions());
  const agent=new CodingAgent({planner:new CodingPlanner(provider),auditLogger});
  const task=createTask({id:'engineering-task',projectId:'engineering-project',request:'Fix calculator addition'});
  const runtime=new AgentRuntime({toolRegistry:registry,toolExecutor:new ToolExecutor(registry),permissionPolicy:new PermissionPolicy(),approvalStore:new InMemoryApprovalStore(),auditLogger});
  return {root,workspace,auditLogger,registry,execution,agent,task,runtime};
}

test('project inspection returns structured project metadata',async()=>{
  const {root,registry,execution}=await setup();
  try{
    const result=await new ToolExecutor(registry).execute(execution,{tool:'coding.inspect_project',input:{}});
    assert.equal(result.projectType,'node'); assert.equal(result.packageManager,'npm');
    assert.ok(result.scripts.test); assert.ok(result.sourceDirectories.includes('src')); assert.ok(result.testDirectories.includes('tests'));
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('bounded relevant-file discovery excludes sensitive paths',async()=>{
  const {root,registry,execution}=await setup();
  try{
    await fs.writeFile(path.join(root,'secret.env'),'NO');
    const result=await new ToolExecutor(registry).execute(execution,{tool:'coding.discover_files',input:{query:'calculator'}});
    assert.deepEqual(result.files.map(x=>x.path),['src/calculator.js','tests/calculator.test.js']);
    await assert.rejects(()=>new ToolExecutor(registry).execute(execution,{tool:'coding.read_file',input:{path:'secret.env'}}),PermissionDeniedError);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('structured test result reports failure without throwing validation error',async()=>{
  const {root,registry,execution}=await setup();
  try{
    const result=await new ToolExecutor(registry).execute(execution,{tool:'coding.run_tests',input:{command:'npm test',args:['test']}});
    assert.equal(result.success,false); assert.equal(result.exitCode??result.code,1); assert.ok(result.failures.length>0); assert.ok(result.durationMs>=0);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('real engineering loop fixes a failing fixture and reruns tests',async()=>{
  const ctx=await setup();
  try{
    const result=await ctx.runtime.run({request:ctx.task.request,task:ctx.task,project:{id:'engineering-project',type:'node'},workspace:ctx.workspace,agent:ctx.agent,execution:ctx.execution});
    assert.equal(result.status,'COMPLETED');
    assert.equal(result.output.corrections.length,1);
    assert.ok(result.output.tests.some(t=>t.success===false));
    assert.ok(result.output.tests.some(t=>t.success===true));
    assert.match(await fs.readFile(path.join(ctx.root,'src/calculator.js'),'utf8'),/a\+b/);
    const events=(await ctx.auditLogger.list()).map(x=>x.event);
    for(const event of ['engineering.failure.analyzed','engineering.correction.started','engineering.tests.completed','engineering.validation.completed','engineering.completed'])assert.ok(events.includes(event),event);
  }finally{await fs.rm(ctx.root,{recursive:true,force:true});}
});

test('maximum correction attempts produce controlled FAILED_VALIDATION',async()=>{
  const ctx=await setup();
  try{
    const plan={type:'plan',goal:'Keep failing',assumptions:[],filesToInspect:[],filesToChange:[],actions:[{tool:'coding.run_tests',input:{command:'npm test',args:['test']}}],tests:['npm test'],risks:[],tool:null,arguments:null,result:null};
    const update=(expected)=>({type:'tool_call',goal:'Keep failing',assumptions:[],filesToInspect:[],filesToChange:['tests/calculator.test.js'],actions:[],tests:['npm test'],risks:[],tool:'coding.update_file',arguments:{path:'tests/calculator.test.js',content:`import test from 'node:test';\\nimport assert from 'node:assert/strict';\\nimport { add } from '../src/calculator.js';\\ntest('add returns the sum',()=>{assert.equal(add(2,3),${expected});});\\n`},result:null});
    const run={type:'tool_call',goal:'Keep failing',assumptions:[],filesToInspect:[],filesToChange:[],actions:[],tests:['npm test'],risks:[],tool:'coding.run_tests',arguments:{command:'npm test',args:['test']},result:null};
    ctx.agent.planner=new CodingPlanner(new MockLLMProvider([plan,update(6),run,update(7),run,update(8),run]));
    const result=await ctx.runtime.run({request:'Keep failing',task:ctx.task,project:{id:'engineering-project'},workspace:ctx.workspace,agent:ctx.agent,execution:ctx.execution});
    assert.equal(result.status,'FAILED_VALIDATION'); assert.equal(result.output.corrections.length,3);
  }finally{await fs.rm(ctx.root,{recursive:true,force:true});}
});

test('security violations are not treated as correction opportunities',async()=>{
  const ctx=await setup();
  try{
    const denied={type:'tool_call',goal:'unsafe',assumptions:[],filesToInspect:[],filesToChange:[],actions:[],tests:[],risks:[],tool:'coding.read_file',arguments:{path:'../../secret.txt'},result:null};
    ctx.agent.planner=new CodingPlanner(new MockLLMProvider([denied]));
    await assert.rejects(()=>ctx.runtime.run({request:'unsafe',task:ctx.task,project:{id:'engineering-project'},workspace:ctx.workspace,agent:ctx.agent,execution:ctx.execution}),PermissionDeniedError);
  }finally{await fs.rm(ctx.root,{recursive:true,force:true});}
});

test('workspace resolution remains bounded',()=>{
  const workspace=createTaskWorkspace({projectId:'p',taskId:'t',root:fixture});
  assert.throws(()=>resolveWorkspacePath(workspace,'../../etc/passwd'),PermissionDeniedError);
  assert.throws(()=>resolveWorkspacePath(workspace,path.resolve('/tmp/outside')),PermissionDeniedError);
});
