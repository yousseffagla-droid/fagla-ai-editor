import { createAgentContext, createAgentResult } from '../agents/contracts.js';
import { PERMISSION_DECISIONS } from '../permissions/policy.js';
import { PermissionDeniedError, AgentExecutionError, InvalidToolInvocationError, ValidationError, FaglaError } from '../errors/index.js';
import { TASK_STATUSES, transitionTask } from '../tasks/task.js';
import { createLLMContext, sanitizeToolResult, LLM_CONTEXT_LIMITS } from '../llm/context-builder.js';
import { validateCodingDecision } from '../llm/response-schema.js';

function validateCodingInvocation(toolName,input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ValidationError('Tool arguments must be an object');
  const pathTools=new Set(['coding.read_file','coding.create_file','coding.update_file']);
  if(pathTools.has(toolName)&&typeof input.path!=='string')throw new ValidationError('Coding file tools require a path');
  if((toolName==='coding.create_file'||toolName==='coding.update_file')&&typeof input.content!=='string')throw new ValidationError('Coding write tools require string content');
  if(toolName==='coding.run_tests'&&(input.command&&input.command!=='npm test'))throw new ValidationError('Only npm test is allowed');
  if(toolName==='coding.run_tests'&&input.args&&JSON.stringify(input.args)!==JSON.stringify(['test']))throw new ValidationError('Only npm test with [test] is allowed');
  if(['coding.git_status','coding.git_diff','coding.git_commit','coding.git_push','coding.git_merge'].includes(toolName)&&Object.keys(input).length)throw new ValidationError('Git inspection tools do not accept arguments');
  return true;
}

export class AgentRuntime {
  constructor({toolRegistry,toolExecutor,permissionPolicy,approvalStore,auditLogger,taskStore=null}){this.toolRegistry=toolRegistry;this.toolExecutor=toolExecutor;this.permissionPolicy=permissionPolicy;this.approvalStore=approvalStore;this.auditLogger=auditLogger;this.taskStore=taskStore;}
  async persist(task){if(this.taskStore)await this.taskStore.update(task);}

  async run(args){
    if(args.agent?.name==='coding-agent-v1')return this.runCoding(args);
    return this.runLegacy(args);
  }

  async runLegacy({request,task,project,workspace,agent,execution,memory={}}){
    let currentTask=task;const context=createAgentContext({request,task:currentTask,project,execution,workspace,memory});
    await this.auditLogger.append({event:'task.started',taskId:execution.taskId,projectId:execution.projectId,agentId:execution.agentId,workspaceId:execution.workspaceId,executionId:execution.executionId});
    try{
      if(currentTask.status===TASK_STATUSES.CREATED){currentTask=transitionTask(currentTask,TASK_STATUSES.PLANNED);await this.persist(currentTask);}
      if(currentTask.status===TASK_STATUSES.PLANNED){currentTask=transitionTask(currentTask,TASK_STATUSES.RUNNING);await this.persist(currentTask);}
      await this.auditLogger.append({event:'agent.executed',taskId:currentTask.id,agentId:execution.agentId,executionId:execution.executionId});
      const plan=await agent.plan({...context,task:currentTask});if(!plan||!Array.isArray(plan.steps))throw new ValidationError('Agent plan must contain a steps array');
      for(const step of plan.steps)await this.executeAuthorizedStep({step,currentTask,project,agent,execution,coding:false});
      currentTask=transitionTask(currentTask,TASK_STATUSES.VALIDATING);await this.persist(currentTask);
      await this.auditLogger.append({event:'validation.completed',taskId:currentTask.id,executionId:execution.executionId});
      const result=await agent.execute({...context,task:currentTask});
      if(!result||!['COMPLETED','FAILED','WAITING_FOR_APPROVAL'].includes(result.status))throw new AgentExecutionError('Agent returned an invalid result');
      if(result.status==='COMPLETED'){currentTask=transitionTask(currentTask,TASK_STATUSES.COMPLETED);await this.persist(currentTask);await this.auditLogger.append({event:'task.completed',taskId:currentTask.id,executionId:execution.executionId});}
      else if(result.status==='FAILED'){currentTask=transitionTask(currentTask,TASK_STATUSES.FAILED);await this.persist(currentTask);await this.auditLogger.append({event:'task.failed',taskId:currentTask.id,executionId:execution.executionId});}
      return result;
    }catch(error){return this.fail(currentTask,execution,agent,error,false);}
  }

  async runCoding({request,task,project,workspace,agent,execution,memory={}}){
    let currentTask=task;const observations=[],toolResults=[],testResults=[],validationResults=[];const failures=new Map();let iterations=0,toolCalls=0;
    try{
      if(currentTask.status===TASK_STATUSES.CREATED){currentTask=transitionTask(currentTask,TASK_STATUSES.PLANNED);await this.persist(currentTask);}
      if(currentTask.status===TASK_STATUSES.PLANNED){currentTask=transitionTask(currentTask,TASK_STATUSES.RUNNING);await this.persist(currentTask);}
      await this.auditLogger.append({event:'coding.task.created',taskId:currentTask.id,projectId:execution.projectId,agentId:execution.agentId,workspaceId:execution.workspaceId,executionId:execution.executionId});
      while(iterations++<LLM_CONTEXT_LIMITS.MAX_TOOL_ITERATIONS&&toolCalls<LLM_CONTEXT_LIMITS.MAX_TOOL_CALLS){
        const llmContext=createLLMContext({request,task:currentTask,project,workspace,codingState:agent.state,plan:agent.lastPlan,observations,toolResults,testResults,validationResults});
        await this.auditLogger.append({event:'llm.context.built',taskId:currentTask.id,agentId:execution.agentId,executionId:execution.executionId,iteration:iterations});
        let decision;
        try{decision=validateCodingDecision(await agent.decide({...llmContext,task:currentTask,project,workspace,execution,memory}));}
        catch(error){await this.auditLogger.append({event:'llm.response.invalid',taskId:currentTask.id,agentId:execution.agentId,error:error.name});throw error;}
        await this.auditLogger.append({event:'llm.response.received',taskId:currentTask.id,agentId:execution.agentId,executionId:execution.executionId,decisionType:decision.type});
        if(decision.type==='final'){
          currentTask=transitionTask(currentTask,TASK_STATUSES.VALIDATING);await this.persist(currentTask);
          validationResults.push({status:'FINAL_DECISION_ACCEPTED'});
          await this.auditLogger.append({event:'coding.validation.completed',taskId:currentTask.id,executionId:execution.executionId});
          const result=createAgentResult({status:'COMPLETED',output:decision.result,observations:[...observations],validation:{iterations,toolCalls,modelDriven:true}});
          if(agent.state=== 'EXECUTING')agent.markTesting();
          if(agent.state==='TESTING')agent.transition('VALIDATING');
          if(agent.state==='VALIDATING')agent.transition('COMPLETED');
          currentTask=transitionTask(currentTask,TASK_STATUSES.COMPLETED);await this.persist(currentTask);
          await this.auditLogger.append({event:'coding.completed',taskId:currentTask.id,executionId:execution.executionId});
          return result;
        }
        const steps=decision.type==='plan'?decision.actions:[{tool:decision.tool,input:decision.arguments}];
        for(const step of steps){
          toolCalls++;if(toolCalls>LLM_CONTEXT_LIMITS.MAX_TOOL_CALLS)break;
          await this.auditLogger.append({event:'llm.tool_call.proposed',taskId:currentTask.id,agentId:execution.agentId,tool:step.tool,executionId:execution.executionId});
          try{
            validateCodingInvocation(step.tool,step.input);
            if(!this.toolRegistry.has(step.tool))throw new InvalidToolInvocationError('Unknown tool: '+step.tool);
            await this.auditLogger.append({event:'llm.tool_call.validated',taskId:currentTask.id,agentId:execution.agentId,tool:step.tool,executionId:execution.executionId});
            const result=await this.executeAuthorizedStep({step,currentTask,project,agent,execution,coding:true});
            const safe=sanitizeToolResult(result);toolResults.push({tool:step.tool,result:safe});observations.push({tool:step.tool,status:'success'});
            if(step.tool==='coding.run_tests')testResults.push(safe);
          }catch(error){
            await this.auditLogger.append({event:'llm.tool_call.rejected',taskId:currentTask.id,agentId:execution.agentId,tool:step.tool,error:error.name});
            if(step.tool==='coding.run_tests'&&error instanceof ValidationError){
              const fingerprint=step.tool+':'+JSON.stringify(step.input??{});
              const count=(failures.get(fingerprint)??0)+1;failures.set(fingerprint,count);
              const safe={tool:step.tool,status:'failed',error:'TEST_FAILED',message:error.message};
              toolResults.push(safe);testResults.push(safe);observations.push(safe);
              if(count>LLM_CONTEXT_LIMITS.MAX_REPEATED_FAILURES)throw new AgentExecutionError('Repeated test failures exceeded the correction limit');
              continue;
            }
            throw error;
          }
        }
      }
      await this.auditLogger.append({event:'llm.loop_limit_reached',taskId:currentTask.id,agentId:execution.agentId,iterations,toolCalls});
      throw new AgentExecutionError('Coding Agent reasoning loop limit reached');
    }catch(error){return this.fail(currentTask,execution,agent,error,true);}
  }

  async executeAuthorizedStep({step,currentTask,project,agent,execution,coding}){
    if(!step?.tool)throw new InvalidToolInvocationError('Tool invocation requires a tool');
    if(!this.toolRegistry.has(step.tool))throw new InvalidToolInvocationError('Unknown tool: '+step.tool);
    const tool=this.toolRegistry.get(step.tool);
    await this.auditLogger.append({event:coding?'coding.tool.requested':'tool.requested',taskId:currentTask.id,agentId:execution.agentId,tool:tool.name,executionId:execution.executionId});
    const decision=this.permissionPolicy.evaluate(tool,execution);
    await this.auditLogger.append({event:'permission.evaluated',taskId:currentTask.id,tool:tool.name,decision:decision.status,executionId:execution.executionId});
    if(decision.status===PERMISSION_DECISIONS.DENY)throw new PermissionDeniedError(decision.reason);
    if(decision.status===PERMISSION_DECISIONS.REQUIRES_APPROVAL){
      if(typeof agent.markWaitingApproval==='function')agent.markWaitingApproval();
      const approval=await this.approvalStore.create({taskId:currentTask.id,projectId:project.id,tool:tool.name,reason:decision.reason,executionId:execution.executionId});
      const waiting=transitionTask(currentTask,TASK_STATUSES.WAITING_APPROVAL);await this.persist(waiting);
      await this.auditLogger.append({event:coding?'coding.approval.requested':'approval.requested',taskId:waiting.id,approvalId:approval.id,tool:tool.name,executionId:execution.executionId});
      throw new ApprovalRequiredError('Approval required for '+tool.name,{code:'APPROVAL_REQUIRED'});
    }
    return this.toolExecutor.execute(execution,step);
  }

  async fail(currentTask,execution,agent,error,coding){
    if(currentTask.status!==TASK_STATUSES.FAILED&&currentTask.status!==TASK_STATUSES.CANCELLED){try{currentTask=transitionTask(currentTask,TASK_STATUSES.FAILED);await this.persist(currentTask);}catch{}}
    await this.auditLogger.append({event:coding?'coding.failed':'task.failed',taskId:execution.taskId,executionId:execution.executionId,error:error.name});
    if(typeof agent.transition==='function'){try{agent.transition('FAILED');}catch{}}
    if(error instanceof FaglaError)throw error;
    throw new AgentExecutionError(error.message,{cause:error});
  }
}