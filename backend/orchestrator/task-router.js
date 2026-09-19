import { ValidationError } from '../errors/index.js';
export function routeTask(task,registry){
  if(task.type==='unsupported')return null;
  const matches=registry.discover(task.type);
  if(!matches.length)throw new ValidationError(`No capability registered for task type: ${task.type}`);
  return matches[0].id;
}
