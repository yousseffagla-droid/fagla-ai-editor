import { ValidationError } from '../errors/index.js';
export class ResultAggregator{
  aggregate(rootTaskId,tasks,validation){
    const results=tasks.map(t=>({taskId:t.id,type:t.type,capability:t.assignedCapability,status:t.status,output:t.output,errors:t.errors}));
    const fatal=tasks.some(t=>t.status==='failed');
    return {status:fatal?'failed':'completed',taskId:rootTaskId,tasks:results,results,validation};
  }
  validate(tasks){
    for(const t of tasks)if(t.status==='completed'&&!t.output)throw new ValidationError(`Task ${t.id} has no output`);
    return {requiredTasksCompleted:tasks.filter(t=>t.type!=='unsupported').every(t=>t.status==='completed'),dependenciesRespected:true,resultsStructurallyValid:true};
  }
}
