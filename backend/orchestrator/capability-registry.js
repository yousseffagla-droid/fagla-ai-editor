import { ValidationError } from '../errors/index.js';
export class CapabilityRegistry{
  constructor(){this.capabilities=new Map();}
  register(capability){
    if(this.capabilities.has(capability.id))throw new ValidationError(`Capability already registered: ${capability.id}`);
    this.capabilities.set(capability.id,capability);return capability;
  }
  get(id){return this.capabilities.get(id)??null;}
  discover(type){return [...this.capabilities.values()].filter(c=>c.supportedTaskTypes.includes(type));}
  has(id){return this.capabilities.has(id);}
}
