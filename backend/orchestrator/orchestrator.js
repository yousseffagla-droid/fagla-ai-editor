import crypto from 'node:crypto';
import { ValidationError } from '../errors/index.js';
import { ORCHESTRATOR_STATES, transitionOrchestratorState } from './contracts.js';
import { routeTask } from './task-router.js';
import { TaskDecomposer } from './task-decomposer.js';
import { ResultAggregator } from './result-aggregator.js';

export class Orchestrator{
  constructor({capabilityRegistry,auditLogger,decomposer=new TaskDecomposer(),aggregator=new ResultAggregator(),limits={maxTasks:8,maxSteps:12,maxDependencyDepth:8}}){
    this.registry=capabilityRegistry;this.auditLogger=auditLogger;this.decomposer=decomposer;this.aggregator=aggregator;this.limits=limits;this.state=ORCHESTRATOR_STATES.PLANNING;
  }
  async audit(event,data={}){await this.auditLogger?.append({event,orchestrationId:data.orchestrationId,...data});}
  async run({userRequest,project,workspaceFactory,codingAgent,runtime,context={}}){
    if(!userRequest)throw new ValidationError('userRequest is required');
    const orchestrationId=crypto.randomUUID();const rootTaskId=`orch:${orchestrationId}`;
    await this.audit('orchestration.created',{orchestrationId,rootTaskId});
    try{
      const intent=this.decomposer.understand(userRequest);this.state=transitionOrchestratorState(this.state,ORCHESTRATOR_STATES.DECOMPOSING);
      await this.audit('orchestration.planned',{orchestrationId,intent});
      const tasks=this.decomposer.decompose({request:userRequest,intent,rootTaskId});this.decomposer.validate(tasks);
      for(const task of tasks){task.assignedCapability=routeTask(task,this.registry);await this.audit('orchestration.task.created',{orchestrationId,taskId:task.id,type:task.type,capability:task.assignedCapability});}
      this.state=transitionOrchestratorState(this.state,ORCHESTRATOR_STATES.READY);this.state=transitionOrchestratorState(this.state,ORCHESTRATOR_STATES.EXECUTING);
      let steps=0;
      for(const task of tasks){
        if(++steps>this.limits.maxSteps)throw new ValidationError('Orchestration step limit reached');
        for(const d of task.dependencies){const dep=tasks.find(x=>x.id===d);if(!dep||dep.status!=='completed')throw new ValidationError(`Dependency ${d} did not complete`);}
        if(!task.assignedCapability){task.status='failed';task.errors.push({code:'UNSUPPORTED_TASK',message:'No supported capability'});continue;}
        const capability=this.registry.get(task.assignedCapability);if(!capability)throw new ValidationError('Unknown capability');
        task.status='running';await this.audit('orchestration.task.routed',{orchestrationId,taskId:task.id,capability:capability.id});await this.audit('orchestration.task.started',{orchestrationId,taskId:task.id});
        const dependencyResults=task.dependencies.map(id=>tasks.find(x=>x.id===id).output);
        try{
          const result=await capability.execute({...context,orchestrationId,dependencyResults,project,workspaceFactory,runtime,codingAgent,auditLogger:this.auditLogger},task);
          task.output={status:result.status,output:result.output,validation:result.validation};task.status=result.status==='COMPLETED'?'completed':result.status==='WAITING_FOR_APPROVAL'?'waiting':'failed';
          if(task.status==='waiting'){this.state=ORCHESTRATOR_STATES.WAITING;return {status:'waiting',taskId:rootTaskId,tasks,results:[],validation:{approvalRequired:true}};}
          await this.audit(task.status==='completed'?'orchestration.task.completed':'orchestration.task.failed',{orchestrationId,taskId:task.id,status:task.status});
          if(task.status==='failed')throw new ValidationError(`Task failed: ${task.id}`);
        }catch(error){task.status='failed';task.errors.push({name:error.name,message:error.message});await this.audit('orchestration.task.failed',{orchestrationId,taskId:task.id,error:error.name});throw error;}
      }
      this.state=transitionOrchestratorState(this.state,ORCHESTRATOR_STATES.VALIDATING);const validation=this.aggregator.validate(tasks);const result=this.aggregator.aggregate(rootTaskId,tasks,validation);
      if(result.status!=='completed'||!validation.requiredTasksCompleted)throw new ValidationError('Orchestration final validation failed');
      this.state=transitionOrchestratorState(this.state,ORCHESTRATOR_STATES.COMPLETED);await this.audit('orchestration.validation.completed',{orchestrationId,validation});await this.audit('orchestration.completed',{orchestrationId});
      return result;
    }catch(error){this.state=ORCHESTRATOR_STATES.FAILED;await this.audit('orchestration.failed',{orchestrationId,error:error.name,message:error.message});throw error;}
  }
}
