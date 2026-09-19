export class AgentContractError extends Error {
  constructor(message) { super(message); this.name = 'AgentContractError'; }
}
export class BaseAgent {
  constructor(definition) { validateAgentDefinition(definition); this.definition = Object.freeze({ ...definition }); }
  get name() { return this.definition.name; }
  get capabilities() { return this.definition.capabilities; }
  get permissions() { return this.definition.permissions; }
  async execute(_context) { throw new Error(`Agent "${this.name}" does not implement execute()`); }
}
export function validateAgentDefinition(definition) {
  for (const key of ['name', 'purpose', 'capabilities', 'permissions']) {
    if (definition?.[key] === undefined) throw new AgentContractError(`Agent definition requires "${key}"`);
  }
  if (!Array.isArray(definition.capabilities)) throw new AgentContractError('Agent capabilities must be an array');
  if (!Array.isArray(definition.permissions)) throw new AgentContractError('Agent permissions must be an array');
  return true;
}
export function createAgentContext({ request, task, project, execution, memory = {} }) {
  if (!request || !task || !project || !execution) throw new AgentContractError('AgentContext requires request, task, project, and execution');
  return Object.freeze({ request, task, project, execution, memory });
}
export function createAgentResult({ status, output = null, observations = [], validation = null, error = null }) {
  if (!['COMPLETED', 'WAITING_FOR_APPROVAL', 'FAILED'].includes(status)) throw new AgentContractError(`Invalid AgentResult status: ${status}`);
  return Object.freeze({ status, output, observations, validation, error });
}
