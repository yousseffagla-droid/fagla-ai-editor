export const TASK_STATUSES = Object.freeze({ PLANNING: 'PLANNING', IN_PROGRESS: 'IN_PROGRESS', WAITING_FOR_APPROVAL: 'WAITING_FOR_APPROVAL', QA: 'QA', COMPLETED: 'COMPLETED', FAILED: 'FAILED', CANCELLED: 'CANCELLED' });
export function createTask({ id, projectId, request, status = TASK_STATUSES.PLANNING }) {
  if (!id || !projectId || !request) throw new Error('Task requires id, projectId, and request');
  return { id, projectId, request, status, createdAt: new Date().toISOString() };
}
