import { ValidationError } from '../errors/index.js';

export const LLM_DECISION_TYPES = Object.freeze({ PLAN: 'plan', TOOL_CALL: 'tool_call', FINAL: 'final' });

export const CODING_DECISION_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['type','goal','assumptions','filesToInspect','filesToChange','actions','tests','risks','tool','arguments','result'],
  properties: {
    type:{type:'string',enum:['plan','tool_call','final']}, goal:{type:'string'},
    assumptions:{type:'array',items:{type:'string'}}, filesToInspect:{type:'array',items:{type:'string'}},
    filesToChange:{type:'array',items:{type:'string'}}, actions:{type:'array',items:{type:'object',additionalProperties:false,required:['tool','input'],properties:{tool:{type:'string'},input:{type:'object'}}}},
    tests:{type:'array',items:{type:'string'}}, risks:{type:'array',items:{type:'string'}},
    tool:{type:['string','null']}, arguments:{type:['object','null']}, result:{type:['string','object','null']}
  }
});

export function validateCodingDecision(value) {
  if (!value || typeof value !== 'object') throw new ValidationError('LLM response must be an object');
  if (!Object.values(LLM_DECISION_TYPES).includes(value.type)) throw new ValidationError('Unknown LLM decision type: ' + value.type);
  if (typeof value.goal !== 'string') throw new ValidationError('LLM decision goal must be a string');
  for (const field of ['assumptions','filesToInspect','filesToChange','actions','tests','risks']) if (!Array.isArray(value[field])) throw new ValidationError('LLM decision field "' + field + '" must be an array');
  if (value.type === 'tool_call') {
    if (typeof value.tool !== 'string' || !value.tool) throw new ValidationError('LLM tool_call requires a tool');
    if (!value.arguments || typeof value.arguments !== 'object' || Array.isArray(value.arguments)) throw new ValidationError('LLM tool_call requires arguments');
  }
  if (value.type === 'plan' && value.actions.some(action => !action?.tool || !action?.input || typeof action.tool !== 'string')) throw new ValidationError('LLM plan actions must contain tool and input');
  if (value.type === 'final' && value.result === null) throw new ValidationError('LLM final decision requires result');
  return Object.freeze(structuredClone(value));
}
