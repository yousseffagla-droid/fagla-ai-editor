import { ValidationError } from '../errors/index.js';
export class MemoryStore {
  constructor() { this.layers = { user: new Map(), project: new Map(), task: new Map() }; }
  set(layer, key, value) { if (!this.layers[layer]) throw new ValidationError(`Unknown memory layer: ${layer}`); this.layers[layer].set(key, value); }
  get(layer, key) { if (!this.layers[layer]) throw new ValidationError(`Unknown memory layer: ${layer}`); return this.layers[layer].get(key); }
}
