import { ValidationError } from '../errors/index.js';
export function createToolExecution({ executionId, tool, input = {} }) { if (!executionId || !tool) throw new ValidationError('ToolExecution requires executionId and tool'); return Object.freeze({ executionId, tool, input }); }
