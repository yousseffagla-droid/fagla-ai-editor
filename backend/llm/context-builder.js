import { ValidationError } from '../errors/index.js';

export const LLM_CONTEXT_LIMITS = Object.freeze({ MAX_CONTEXT_CHARS: 24000, MAX_FILE_CHARS: 8000, MAX_TOOL_ITERATIONS: 12, MAX_TOOL_CALLS: 24, MAX_REPEATED_FAILURES: 2 });
const SENSITIVE_PATH = /(^|\\)(\.env(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?)$/i;
const SECRET_KEY = /secret|token|password|credential|api[_-]?key|authorization/i;

function sanitize(value, depth=0) {
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0,100).map(v=>sanitize(v,depth+1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k])=>!SECRET_KEY.test(k)).map(([k,v])=>[k,sanitize(v,depth+1)]));
  return value;
}
function boundedText(value,max){const text=typeof value==='string'?value:JSON.stringify(value??'');return text.length>max?text.slice(0,max)+'\n[truncated]':text;}
export function createLLMContext(input={},limits=LLM_CONTEXT_LIMITS){
  if(!input.request||!input.task||!input.workspace) throw new ValidationError('LLM context requires request, task, and workspace');
  const context={request:boundedText(input.request,4000),task:sanitize({id:input.task.id,status:input.task.status,projectId:input.task.projectId}),project:sanitize(input.project??{}),workspace:sanitize({projectId:input.workspace.projectId,workspaceId:input.workspace.workspaceId,taskId:input.workspace.taskId,mode:input.workspace.mode}),codingState:input.codingState??null,plan:sanitize(input.plan??null),observations:sanitize(input.observations??[]),toolResults:sanitize(input.toolResults??[]),testResults:sanitize(input.testResults??[]),validationResults:sanitize(input.validationResults??[]),files:(input.files??[]).filter(f=>typeof f==='string'&&!SENSITIVE_PATH.test(f)).slice(0,50)};
  if(JSON.stringify(context).length<=limits.MAX_CONTEXT_CHARS)return Object.freeze(context);
  const reduced={...context,toolResults:[],observations:context.observations.slice(-5),files:context.files.slice(0,20)};
  if(JSON.stringify(reduced).length>limits.MAX_CONTEXT_CHARS){reduced.request=boundedText(reduced.request,2000);reduced.plan=null;}
  return Object.freeze(reduced);
}
export function sanitizeToolResult(result,max=LLM_CONTEXT_LIMITS.MAX_FILE_CHARS){
  const safe=sanitize(result);
  if(safe&&typeof safe==='object'&&typeof safe.content==='string')return {...safe,content:boundedText(safe.content,max)};
  return typeof safe==='string'?boundedText(safe,max):safe;
}
