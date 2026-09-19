import { ValidationError } from '../errors/index.js';

const REQUIRED_FIELDS = ['goal', 'assumptions', 'filesToInspect', 'filesToChange', 'actions', 'tests', 'risks'];

export function validateCodingPlan(plan) {
  if (!plan || typeof plan !== 'object') throw new ValidationError('Coding plan must be an object');
  for (const field of REQUIRED_FIELDS) if (!(field in plan)) throw new ValidationError('Coding plan requires "' + field + '"');
  for (const field of ['assumptions', 'filesToInspect', 'filesToChange', 'actions', 'tests', 'risks']) {
    if (!Array.isArray(plan[field])) throw new ValidationError('Coding plan field "' + field + '" must be an array');
  }
  if (typeof plan.goal !== 'string' || !plan.goal.trim()) throw new ValidationError('Coding plan goal must be a non-empty string');
  if (plan.actions.some(action => !action?.tool || typeof action.tool !== 'string')) throw new ValidationError('Every coding plan action requires a tool');
  return true;
}
export function createCodingPlan(plan) {
  validateCodingPlan(plan);
  return Object.freeze({
    goal: plan.goal, assumptions: Object.freeze([...plan.assumptions]), filesToInspect: Object.freeze([...plan.filesToInspect]),
    filesToChange: Object.freeze([...plan.filesToChange]), actions: Object.freeze(plan.actions.map(action => Object.freeze({ ...action }))),
    tests: Object.freeze([...plan.tests]), risks: Object.freeze([...plan.risks])
  });
}
