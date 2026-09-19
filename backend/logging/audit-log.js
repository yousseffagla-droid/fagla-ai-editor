export class AuditLogger {
  constructor() { this.entries = []; }
  async record(entry) {
    const normalized = Object.freeze({ timestamp: new Date().toISOString(), status: entry.status ?? 'RECORDED', ...entry });
    this.entries.push(normalized); return normalized;
  }
  list() { return [...this.entries]; }
}
