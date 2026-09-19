import crypto from 'node:crypto';
import { ValidationError } from '../errors/index.js';
export const APPROVAL_STATUSES = Object.freeze({ PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' });
export class ApprovalStore {
  constructor() { this.items = new Map(); }
  async create(input) { const approval = { id: crypto.randomUUID(), status: APPROVAL_STATUSES.PENDING, ...input, createdAt: new Date().toISOString() }; this.items.set(approval.id, approval); return { ...approval }; }
  get(id) { const item = this.items.get(id); return item ? { ...item } : null; }
  async decide(id, decision, actor = 'human') { const approval = this.items.get(id); if (!approval) throw new ValidationError(`Approval not found: ${id}`); if (approval.status !== APPROVAL_STATUSES.PENDING) throw new ValidationError(`Approval is already resolved: ${id}`); if (![APPROVAL_STATUSES.APPROVED, APPROVAL_STATUSES.REJECTED].includes(decision)) throw new ValidationError(`Invalid approval decision: ${decision}`); approval.status = decision; approval.decidedBy = actor; approval.decidedAt = new Date().toISOString(); return { ...approval }; }
}
