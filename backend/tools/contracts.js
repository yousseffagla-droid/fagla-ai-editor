import { ValidationError } from '../errors/index.js';
export const TOOL_RISK_LEVELS = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' });
export function validateToolDefinition(definition) {
  if (!definition?.name || !definition?.description || !definition?.riskLevel || typeof definition.handler !== 'function') throw new ValidationError('ToolDefinition requires name, description, riskLevel, and handler');
  if (!Object.values(TOOL_RISK_LEVELS).includes(definition.riskLevel)) throw new ValidationError(`Invalid tool risk level: ${definition.riskLevel}`);
  return true;
}
