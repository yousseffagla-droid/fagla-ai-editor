import { ValidationError } from '../errors/index.js';
import { createOrchestrationTask } from './contracts.js';

export class TaskDecomposer{
  constructor({maxTasks=8}={}){this.maxTasks=maxTasks;}
  understand(request){
    const text=String(request).toLowerCase();
    if(/research|competitor|market/.test(text)&&/build|create|update|code|website|landing/.test(text))return {type:'composite',goal:request,requirements:[],constraints:[]};
    if(/research|competitor|market/.test(text))return {type:'research',goal:request,requirements:[],constraints:[]};
    if(/build|create|update|fix|code|website|app|landing/.test(text))return {type:'coding',goal:request,requirements:[],constraints:[]};
    return {type:'unsupported',goal:request,requirements:[],constraints:[]};
  }
  decompose({request,intent,rootTaskId}){
    if(intent.type==='composite'){
      const research=createOrchestrationTask({id:`${rootTaskId}:research`,userRequest:'Research competitors relevant to the requested project',type:'research',metadata:{rootTaskId}});
      const coding=createOrchestrationTask({id:`${rootTaskId}:coding`,userRequest:request,type:'coding',dependencies:[research.id],metadata:{rootTaskId}});
      return [research,coding];
    }
    if(intent.type==='unsupported')return [createOrchestrationTask({id:`${rootTaskId}:unsupported`,userRequest:request,type:'unsupported',metadata:{rootTaskId}})];
    return [createOrchestrationTask({id:`${rootTaskId}:1`,userRequest:request,type:intent.type,metadata:{rootTaskId}})];
  }
  validate(tasks){
    if(!Array.isArray(tasks)||!tasks.length||tasks.length>this.maxTasks)throw new ValidationError('Invalid orchestration plan size');
    const ids=new Set(tasks.map(t=>t.id));const visiting=new Set(),visited=new Set();
    for(const t of tasks){for(const d of t.dependencies)if(!ids.has(d))throw new ValidationError(`Unknown dependency: ${d}`);}
    const byId=new Map(tasks.map(t=>[t.id,t]));
    const visit=id=>{if(visiting.has(id))throw new ValidationError('Cyclic orchestration dependency');if(visited.has(id))return;visiting.add(id);for(const d of byId.get(id).dependencies)visit(d);visiting.delete(id);visited.add(id);};
    for(const t of tasks)visit(t.id);
    const depth=id=>{const t=byId.get(id);return t.dependencies.length?1+Math.max(...t.dependencies.map(depth)):0;};
    if(tasks.some(t=>depth(t.id)>=this.maxTasks))throw new ValidationError('Maximum dependency depth exceeded');
    return true;
  }
}
