import { validateToolDefinition } from './contracts.js';
import { InvalidToolInvocationError } from '../errors/index.js';
export class ToolRegistry {
  constructor() { this.tools = new Map(); }
  register(definition) {
    validateToolDefinition(definition);
    if (this.tools.has(definition.name)) throw new Error(`Tool already registered: ${definition.name}`);
    this.tools.set(definition.name, Object.freeze({ ...definition })); return this.tools.get(definition.name);
  }
  has(name) { return this.tools.has(name); }
  get(name) { const tool = this.tools.get(name); if (!tool) throw new InvalidToolInvocationError(`Unknown tool: ${name}`); return tool; }
  list() { return [...this.tools.values()]; }
  async execute(name, input, executionContext) { return this.get(name).handler(input, executionContext); }
}
export class ToolExecutor {
  constructor(registry) { this.registry = registry; }
  execute(name, input, context) { return this.registry.execute(name, input, context); }
}
