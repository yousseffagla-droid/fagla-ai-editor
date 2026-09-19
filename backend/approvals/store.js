import crypto from 'node:crypto';
export const APPROVAL_STATUSES = Object.freeze({ PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' });
export class ApprovalStore {
  constructor() { this.items = new Map(); }
  async create(input) {
    const id = crypto.randomUUID(); const approval = { id, status: APPROVAL_STATUSES.PENDING, ...input };
    this.items.set(id, approval); return approval;
  }
  get(id) { return this.items.get(id) ?? null; }
  async decide(id, decision, actor = 'human') {
    const approval = this.items.get(id);
    if (!approval) throw new Error(`Approval not found: ${id}`);
    if (![APPROVAL_STATUSES.APPROVED, APPROVAL_STATUSES.REJECTED].includes(decision)) throw new Error(`Invalid approval decision: ${decision}`);
    approval.status = decision; approval.decidedBy = actor; approval.decidedAt = new Date().toISOString(); return approval;
  }
}
