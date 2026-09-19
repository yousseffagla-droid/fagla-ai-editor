import { AgentContractError, ValidationError } from '../errors/index.js';
export class BaseAgent {
  constructor(definition) { validateAgentDefinition(definition); this.definition = Object.freeze({ ...definition, capabilities: Object.freeze([...definition.capabilities]), permissions: Object.freeze([...definition.permissions]) }); }
  get name() { return this.definition.name; } get purpose() { return this.definition.purpose; } get capabilities() { return this.definition.capabilities; } get permissions() { return this.definition.permissions; }
  async plan(_context) { return { steps: [] }; }
  async execute(_context) { throw new AgentContractError(`Agent "${this.name}" does not implement execute()`); }
}
export function validateAgentDefinition(definition) { for (const key of ['name','purpose','capabilities','permissions']) if (definition?.[key] === undefined) throw new AgentContractError(`Agent definition requires "${key}"`); if (!Array.isArray(definition.capabilities) || !Array.isArray(definition.permissions)) throw new AgentContractError('Agent capabilities and permissions must be arrays'); return true; }
export function createAgentContext({ request, task, project, execution, workspace, memory = {} }) { if (!request || !task || !project || !execution || !workspace) throw new AgentContractError('AgentContext requires request, task, project, execution, and workspace'); return Object.freeze({ request, task, project, execution, workspace, memory }); }
export function createAgentResult({ status, output = null, observations = [], validation = null, error = null }) { if (!['COMPLETED','WAITING_FOR_APPROVAL','FAILED','FAILED_VALIDATION'].includes(status)) throw new ValidationError(`Invalid AgentResult status: ${status}`); return Object.freeze({ status, output, observations, validation, error }); }
