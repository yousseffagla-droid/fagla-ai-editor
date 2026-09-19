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
      for(const step of plan.steps){const outcome=await this.executeAuthorizedStep({step,currentTask,project,agent,execution,coding:false});if(outcome?.status==='WAITING_FOR_APPROVAL')return createAgentResult({status:'WAITING_FOR_APPROVAL',output:{approvalId:outcome.approvalId},observations:['Execution paused until explicit human approval.']});}
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
    let currentTask=task;
    const observations=[],toolResults=[],testResults=[],validationResults=[],progress=[],corrections=[];
    const failureFingerprints=new Map();
    let iterations=0,toolCalls=0,correctionAttempts=0,lastTest=null;

    const recordProgress=async (cycle,phase,action,tool,result,testStatus=null)=>{
      const item={cycle,phase,action,tool:tool??null,result,testStatus};
      progress.push(item);
      await this.auditLogger.append({event:'engineering.progress',taskId:currentTask.id,projectId:execution.projectId,executionId:execution.executionId,cycle,...item});
    };

    const classifyFailure=(error,result)=>{
      if(result?.success===false)return {type:'test_failure',message:result.summary??'Tests failed',details:result.failures??[]};
      if(error?.code==='COMMAND_NOT_ALLOWED'||error?.name==='CommandNotAllowedError')return {type:'timeout_or_command_error',message:error.message};
      if(error?.name==='ValidationError')return {type:'validation_error',message:error.message};
      if(error?.name==='PermissionDeniedError')return {type:'permission_error',message:error.message};
      if(error?.name==='ToolExecutionError')return {type:'tool_error',message:error.message};
      if(error?.name==='ExternalServiceError'||error?.name==='ProviderError'||error?.name==='ModelError')return {type:'provider_error',message:error.message};
      return {type:'unknown_failure',message:error?.message??String(error)};
    };

    try{
      if(currentTask.status===TASK_STATUSES.CREATED){currentTask=transitionTask(currentTask,TASK_STATUSES.PLANNED);await this.persist(currentTask);}
      if(currentTask.status===TASK_STATUSES.PLANNED){currentTask=transitionTask(currentTask,TASK_STATUSES.RUNNING);await this.persist(currentTask);}
      await this.auditLogger.append({event:'coding.task.created',taskId:currentTask.id,projectId:execution.projectId,agentId:execution.agentId,workspaceId:execution.workspaceId,executionId:execution.executionId});

      while(iterations++<LLM_CONTEXT_LIMITS.MAX_TOOL_ITERATIONS&&toolCalls<LLM_CONTEXT_LIMITS.MAX_TOOL_CALLS){
        const llmContext=createLLMContext({request,task:currentTask,project,workspace,codingState:agent.state,plan:agent.lastPlan,observations,toolResults,testResults,validationResults,progress,corrections});
        await this.auditLogger.append({event:'llm.context.built',taskId:currentTask.id,agentId:execution.agentId,executionId:execution.executionId,iteration:iterations,cycle:correctionAttempts+1});
        let decision;
        try{decision=validateCodingDecision(await agent.decide({...llmContext,task:currentTask,project,workspace,execution,memory}));}
        catch(error){await this.auditLogger.append({event:'llm.response.invalid',taskId:currentTask.id,agentId:execution.agentId,error:error.name});throw error;}
        await this.auditLogger.append({event:'llm.response.received',taskId:currentTask.id,agentId:execution.agentId,executionId:execution.executionId,decisionType:decision.type,cycle:correctionAttempts+1});

        if(decision.type==='final'){
          if(lastTest && !lastTest.success){
            throw new ValidationError('Final model decision rejected because the latest test run failed');
          }
          progress.push({cycle:correctionAttempts+1,phase:'VALIDATE',action:'finalize',tool:null,result:'pending',testStatus:lastTest?.success?'passed':lastTest?'failed':'not_run'});
          const diffStep={tool:'coding.git_diff',input:{}};
          const diff=await this.executeAuthorizedStep({step:diffStep,currentTask,project,agent,execution,coding:true});
          const safeDiff=sanitizeToolResult(diff);validationResults.push({type:'git_diff',result:safeDiff});
          currentTask=transitionTask(currentTask,TASK_STATUSES.VALIDATING);await this.persist(currentTask);
          await this.auditLogger.append({event:'engineering.validation.started',taskId:currentTask.id,executionId:execution.executionId});
          const result=createAgentResult({status:'COMPLETED',output:{status:'COMPLETED',taskId:currentTask.id,projectId:execution.projectId,filesChanged:agent.lastPlan?.filesToChange??[],tests:testResults,corrections,validation:{diff:safeDiff,passed:true},warnings:[],remainingIssues:[],progress,auditSummary:{iterations,toolCalls}},observations:[...observations],validation:{iterations,toolCalls,progress}});
          if(agent.state==='IDLE')agent.transition('PLANNING');
          if(agent.state==='PLANNING')agent.transition('EXECUTING');
          if(agent.state==='EXECUTING')agent.markTesting();
          if(agent.state==='TESTING')agent.transition('VALIDATING');
          if(agent.state==='VALIDATING')agent.transition('COMPLETED');
          currentTask=transitionTask(currentTask,TASK_STATUSES.COMPLETED);await this.persist(currentTask);
          await this.auditLogger.append({event:'engineering.validation.completed',taskId:currentTask.id,executionId:execution.executionId,passed:true});
          await this.auditLogger.append({event:'engineering.completed',taskId:currentTask.id,executionId:execution.executionId,corrections:correctionAttempts});
          return result;
        }

        const steps=decision.type==='plan'?decision.actions:[{tool:decision.tool,input:decision.arguments}];
        for(const step of steps){
          toolCalls++;
          if(toolCalls>LLM_CONTEXT_LIMITS.MAX_TOOL_CALLS)break;
          await this.auditLogger.append({event:'llm.tool_call.proposed',taskId:currentTask.id,agentId:execution.agentId,tool:step.tool,executionId:execution.executionId,cycle:correctionAttempts+1});
          try{
            validateCodingInvocation(step.tool,step.input);
            if(!this.toolRegistry.has(step.tool))throw new InvalidToolInvocationError('Unknown tool: '+step.tool);
            await this.auditLogger.append({event:'llm.tool_call.validated',taskId:currentTask.id,agentId:execution.agentId,tool:step.tool,executionId:execution.executionId});
            const phase=step.tool==='coding.run_tests'?'TEST':(step.tool.includes('file')?'IMPLEMENT':'INSPECT');
            await recordProgress(correctionAttempts+1,phase,step.tool,step.tool, 'started');
            const result=await this.executeAuthorizedStep({step,currentTask,project,agent,execution,coding:true});
            if(result?.status==='WAITING_FOR_APPROVAL')return createAgentResult({status:'WAITING_FOR_APPROVAL',output:{approvalId:result.approvalId},observations:[...observations]});
            const safe=sanitizeToolResult(result);
            toolResults.push({tool:step.tool,result:safe});
            observations.push({tool:step.tool,status:'success',result:safe});
            if(step.tool==='coding.run_tests'){
              lastTest=safe;testResults.push(safe);
              await recordProgress(correctionAttempts+1,'TEST','run tests',step.tool,safe.success?'passed':'failed',safe.success?'passed':'failed');
              if(safe.success){
                if(agent.state==='EXECUTING')agent.markTesting();
                await this.auditLogger.append({event:'engineering.tests.completed',taskId:currentTask.id,executionId:execution.executionId,success:true});
              } else {
                const failure=classifyFailure(null,safe);
                const fingerprint=JSON.stringify({type:failure.type,failures:safe.failures});
                const count=(failureFingerprints.get(fingerprint)??0)+1;failureFingerprints.set(fingerprint,count);
                await this.auditLogger.append({event:'engineering.failure.analyzed',taskId:currentTask.id,executionId:execution.executionId,cycle:correctionAttempts+1,failureType:failure.type});
                if(count>1){await this.auditLogger.append({event:'engineering.loop.stopped',taskId:currentTask.id,executionId:execution.executionId,reason:'repeated_failure'});return this.finishFailedValidation(currentTask,execution,agent,progress,corrections,testResults,'Repeated identical test failure');}
                correctionAttempts++;
                corrections.push({attempt:correctionAttempts,failure});
                await this.auditLogger.append({event:'engineering.correction.started',taskId:currentTask.id,executionId:execution.executionId,attempt:correctionAttempts});
                if(correctionAttempts>3)return this.finishFailedValidation(currentTask,execution,agent,progress,corrections,testResults,'Maximum correction attempts exceeded');
                if(agent.state==='TESTING')agent.transition('EXECUTING');
              }
            }
          }catch(error){
            await this.auditLogger.append({event:'llm.tool_call.rejected',taskId:currentTask.id,agentId:execution.agentId,tool:step.tool,error:error.name});
            if(error?.name==='PermissionDeniedError'||error?.name==='InvalidToolInvocationError'||error?.name==='CommandNotAllowedError')throw error;
            throw error;
          }
        }
      }
      await this.auditLogger.append({event:'llm.loop_limit_reached',taskId:currentTask.id,agentId:execution.agentId,iterations,toolCalls});
      return this.finishFailedValidation(currentTask,execution,agent,progress,corrections,testResults,'Engineering loop limit reached');
    }catch(error){return this.fail(currentTask,execution,agent,error,true);}
  }

  async finishFailedValidation(task,execution,agent,progress,corrections,testResults,reason){
    const result=createAgentResult({status:'FAILED_VALIDATION',output:{status:'FAILED_VALIDATION',taskId:task.id,projectId:execution.projectId,filesChanged:agent.lastPlan?.filesToChange??[],tests:testResults,corrections,validation:{passed:false},warnings:[reason],remainingIssues:[reason],progress},error:{name:'ValidationError',message:reason}});
    if(task.status!==TASK_STATUSES.FAILED){task=task.status===TASK_STATUSES.VALIDATING?task:transitionTask(task,TASK_STATUSES.FAILED);await this.persist(task);}
    if(typeof agent.transition==='function' && agent.state!=='FAILED') agent.transition('FAILED');
    await this.auditLogger.append({event:'engineering.loop.stopped',taskId:task.id,executionId:execution.executionId,reason});
    await this.auditLogger.append({event:'engineering.failed',taskId:task.id,executionId:execution.executionId,reason});
    return result;
  }

  async executeAuthorizedStep({step,currentTask,project,agent,execution,coding}){
    if(!step?.tool)throw new InvalidToolInvocationError('Tool invocation requires a tool');
    if(coding)validateCodingInvocation(step.tool,step.input);
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
      return {status:'WAITING_FOR_APPROVAL',approvalId:approval.id};
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