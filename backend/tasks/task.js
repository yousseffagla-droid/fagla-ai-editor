import { InvalidTaskTransition, ValidationError } from '../errors/index.js';

export const TASK_STATUSES = Object.freeze({
  CREATED: 'CREATED', PLANNED: 'PLANNED', RUNNING: 'RUNNING', WAITING_APPROVAL: 'WAITING_APPROVAL',
  VALIDATING: 'VALIDATING', COMPLETED: 'COMPLETED', FAILED: 'FAILED', CANCELLED: 'CANCELLED'
});

const TRANSITIONS = Object.freeze({
  CREATED: [TASK_STATUSES.PLANNED, TASK_STATUSES.CANCELLED, TASK_STATUSES.FAILED],
  PLANNED: [TASK_STATUSES.RUNNING, TASK_STATUSES.CANCELLED, TASK_STATUSES.FAILED],
  RUNNING: [TASK_STATUSES.WAITING_APPROVAL, TASK_STATUSES.VALIDATING, TASK_STATUSES.FAILED, TASK_STATUSES.CANCELLED],
  WAITING_APPROVAL: [TASK_STATUSES.RUNNING, TASK_STATUSES.FAILED, TASK_STATUSES.CANCELLED],
  VALIDATING: [TASK_STATUSES.COMPLETED, TASK_STATUSES.FAILED, TASK_STATUSES.CANCELLED],
  COMPLETED: [], FAILED: [], CANCELLED: []
});

export function canTransitionTask(from, to) { return TRANSITIONS[from]?.includes(to) ?? false; }
export function transitionTask(task, to) {
  if (!task?.status || !Object.values(TASK_STATUSES).includes(to)) throw new ValidationError('Invalid task status');
  if (!canTransitionTask(task.status, to)) throw new InvalidTaskTransition(`Cannot transition task from ${task.status} to ${to}`);
  return { ...task, status: to, updatedAt: new Date().toISOString() };
}
export function createTask({ id, projectId, request }) {
  if (!id || !projectId || !request) throw new ValidationError('Task requires id, projectId, and request');
  return { id, projectId, request, status: TASK_STATUSES.CREATED, createdAt: new Date().toISOString() };
}
export function taskTransitions() { return TRANSITIONS; }
