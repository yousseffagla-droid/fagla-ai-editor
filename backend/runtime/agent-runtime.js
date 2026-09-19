import { createAgentContext, createAgentResult } from '../agents/contracts.js';
import { PERMISSION_DECISIONS } from '../permissions/policy.js';
import { PermissionDeniedError, AgentExecutionError, InvalidToolInvocationError, ValidationError } from '../errors/index.js';
import { TASK_STATUSES, transitionTask } from '../tasks/task.js';
export class AgentRuntime {
  constructor({ toolRegistry, toolExecutor, permissionPolicy, approvalStore, auditLogger, taskStore = null }) { this.toolRegistry=toolRegistry;this.toolExecutor=toolExecutor;this.permissionPolicy=permissionPolicy;this.approvalStore=approvalStore;this.auditLogger=auditLogger;this.taskStore=taskStore; }
  async persist(task){if(this.taskStore)await this.taskStore.update(task);}
  async run({ request, task, project, workspace, agent, execution, memory = {} }) {
    let currentTask=task; const context=createAgentContext({request,task:currentTask,project,execution,workspace,memory});
    await this.auditLogger.append({event:'task.started',taskId:execution.taskId,projectId:execution.projectId,agentId:execution.agentId,executionId:execution.executionId});
    try {
      if(currentTask.status===TASK_STATUSES.CREATED){currentTask=transitionTask(currentTask,TASK_STATUSES.PLANNED);await this.persist(currentTask);}
      if(currentTask.status===TASK_STATUSES.PLANNED){currentTask=transitionTask(currentTask,TASK_STATUSES.RUNNING);await this.persist(currentTask);}
      await this.auditLogger.append({event:'agent.executed',taskId:currentTask.id,agentId:execution.agentId,executionId:execution.executionId});
      const plan=await agent.plan({...context,task:currentTask}); if(!plan||!Array.isArray(plan.steps))throw new ValidationError('Agent plan must contain a steps array');
      for(const step of plan.steps){
        if(!this.toolRegistry.has(step.tool))throw new InvalidToolInvocationError(`Unknown tool: ${step.tool}`);
        const tool=this.toolRegistry.get(step.tool);
        await this.auditLogger.append({event:'tool.requested',taskId:currentTask.id,agentId:execution.agentId,tool:tool.name,executionId:execution.executionId});
        const decision=this.permissionPolicy.evaluate(tool,execution);
        await this.auditLogger.append({event:'permission.evaluated',taskId:currentTask.id,tool:tool.name,decision:decision.status,executionId:execution.executionId});
        if(decision.status===PERMISSION_DECISIONS.DENY)throw new PermissionDeniedError(decision.reason);
        if(decision.status===PERMISSION_DECISIONS.REQUIRES_APPROVAL){
          const approval=await this.approvalStore.create({taskId:currentTask.id,projectId:project.id,tool:tool.name,reason:decision.reason,executionId:execution.executionId});
          currentTask=transitionTask(currentTask,TASK_STATUSES.WAITING_APPROVAL);await this.persist(currentTask);
          await this.auditLogger.append({event:'approval.requested',taskId:currentTask.id,approvalId:approval.id,tool:tool.name,executionId:execution.executionId});
          return createAgentResult({status:'WAITING_FOR_APPROVAL',output:{approvalId:approval.id},observations:['Execution paused until explicit human approval.']});
        }
        await this.toolExecutor.execute(execution,step);
      }
      currentTask=transitionTask(currentTask,TASK_STATUSES.VALIDATING);await this.persist(currentTask);
      await this.auditLogger.append({event:'validation.completed',taskId:currentTask.id,executionId:execution.executionId});
      const result=await agent.execute({...context,task:currentTask});
      if(!result||!['COMPLETED','FAILED','WAITING_FOR_APPROVAL'].includes(result.status))throw new AgentExecutionError('Agent returned an invalid result');
      if(result.status==='COMPLETED'){currentTask=transitionTask(currentTask,TASK_STATUSES.COMPLETED);await this.persist(currentTask);await this.auditLogger.append({event:'task.completed',taskId:currentTask.id,executionId:execution.executionId});}
      else if(result.status==='FAILED'){currentTask=transitionTask(currentTask,TASK_STATUSES.FAILED);await this.persist(currentTask);await this.auditLogger.append({event:'task.failed',taskId:currentTask.id,executionId:execution.executionId});}
      return result;
    } catch(error){
      if(currentTask.status!==TASK_STATUSES.FAILED&&currentTask.status!==TASK_STATUSES.CANCELLED){try{currentTask=transitionTask(currentTask,TASK_STATUSES.FAILED);await this.persist(currentTask);}catch{}}
      await this.auditLogger.append({event:'task.failed',taskId:execution.taskId,executionId:execution.executionId,error:error.name});
      if(error instanceof InvalidToolInvocationError||error instanceof ValidationError||error instanceof PermissionDeniedError||error instanceof AgentExecutionError)throw error;
      throw new AgentExecutionError(error.message,{cause:error});
    }
  }
}
