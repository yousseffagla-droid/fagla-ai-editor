import crypto from 'node:crypto';
import { ValidationError } from '../errors/index.js';

export function createExecutionContext({ taskId, projectId, agentId, workspaceId, executionId = crypto.randomUUID(), requestId, permissions = [], metadata = {}, actor = 'system' }) {
  if (!taskId || !projectId || !agentId || !workspaceId || !requestId) throw new ValidationError('ExecutionContext requires taskId, projectId, agentId, workspaceId, and requestId');
  const safeMetadata = Object.freeze({ ...metadata });
  return Object.freeze({ taskId, projectId, agentId, workspaceId, executionId, requestId, permissions: Object.freeze([...permissions]), metadata: safeMetadata, actor, startedAt: new Date().toISOString() });
}
