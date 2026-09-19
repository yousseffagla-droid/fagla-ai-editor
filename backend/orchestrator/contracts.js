import { ValidationError } from '../errors/index.js';

export const ORCHESTRATOR_STATES=Object.freeze({
  PLANNING:'PLANNING',DECOMPOSING:'DECOMPOSING',READY:'READY',EXECUTING:'EXECUTING',
  WAITING:'WAITING',VALIDATING:'VALIDATING',COMPLETED:'COMPLETED',FAILED:'FAILED',CANCELLED:'CANCELLED'
});
const transitions={
  PLANNING:['DECOMPOSING','FAILED','CANCELLED'],
  DECOMPOSING:['READY','FAILED','CANCELLED'],
  READY:['EXECUTING','FAILED','CANCELLED'],
  EXECUTING:['WAITING','VALIDATING','FAILED','CANCELLED'],
  WAITING:['EXECUTING','FAILED','CANCELLED'],
  VALIDATING:['COMPLETED','FAILED','CANCELLED'],
  COMPLETED:[],FAILED:[],CANCELLED:[]
};
export function transitionOrchestratorState(from,to){
  if(!transitions[from]?.includes(to))throw new ValidationError(`Invalid orchestration transition: ${from} -> ${to}`);
  return to;
}
export function createOrchestrationTask({id,userRequest,type='unsupported',priority='normal',dependencies=[],assignedCapability=null,input={},metadata={}}){
  if(!id||!userRequest||!['coding','research','composite','unsupported'].includes(type))throw new ValidationError('Invalid orchestration task');
  return {id,userRequest,type,priority,status:'pending',dependencies:[...dependencies],assignedCapability,input,output:null,errors:[],metadata:{...metadata}};
}
export function createCapability({id,description,supportedTaskTypes,execute}){
  if(!id||typeof execute!=='function'||!Array.isArray(supportedTaskTypes))throw new ValidationError('Invalid capability contract');
  return Object.freeze({id,description,supportedTaskTypes:Object.freeze([...supportedTaskTypes]),execute});
}
