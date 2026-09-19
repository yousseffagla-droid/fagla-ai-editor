export function createExecutionContext({ taskId, projectId, requestId, actor = 'system', metadata = {} }) {
  if (!taskId || !projectId || !requestId) throw new Error('ExecutionContext requires taskId, projectId, and requestId');
  return Object.freeze({ taskId, projectId, requestId, actor, metadata, startedAt: new Date().toISOString() });
}
