const SENSITIVE_KEYS = /secret|token|password|credential|api[_-]?key|authorization/i;
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE_KEYS.test(key)).map(([key, item]) => [key, sanitize(item)]));
  return value;
}
export class AuditLogStore { async append(entry) { throw new Error('AuditLogStore.append() is not implemented'); } async list() { throw new Error('AuditLogStore.list() is not implemented'); } }
export class AuditLogger extends AuditLogStore {
  constructor() { super(); this.entries = []; }
  async append(entry) { const normalized = Object.freeze({ timestamp: new Date().toISOString(), ...sanitize(entry) }); this.entries.push(normalized); return normalized; }
  async list() { return [...this.entries]; }
  record(entry) { return this.append(entry); }
}
