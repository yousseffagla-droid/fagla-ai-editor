import { validateToolDefinition } from './contracts.js';
import { InvalidToolInvocationError, ToolExecutionError } from '../errors/index.js';
export class ToolRegistry {
  constructor() { this.tools = new Map(); }
  register(definition) { validateToolDefinition(definition); if (this.tools.has(definition.name)) throw new InvalidToolInvocationError(`Tool already registered: ${definition.name}`); const tool = Object.freeze({ ...definition }); this.tools.set(tool.name, tool); return tool; }
  has(name) { return this.tools.has(name); }
  get(name) { const tool = this.tools.get(name); if (!tool) throw new InvalidToolInvocationError(`Unknown tool: ${name}`); return tool; }
  list() { return [...this.tools.values()]; }
}
export class ToolExecutor {
  constructor(registry) { this.registry = registry; }
  async execute(execution, invocation) {
    const tool = this.registry.get(invocation.tool);
    try { return await tool.handler(invocation.input, execution); }
    catch (error) { throw new ToolExecutionError(`Tool "${tool.name}" failed: ${error.message}`, { cause: error }); }
  }
}
