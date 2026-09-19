import path from 'node:path';
import { ValidationError, PermissionDeniedError } from '../errors/index.js';

export const WORKSPACE_MODES = Object.freeze({ ISOLATED: 'ISOLATED', READ_ONLY: 'READ_ONLY' });

export function createProjectWorkspace({ projectId, workspaceId = projectId, taskId = null, root, mode = WORKSPACE_MODES.ISOLATED }) {
  if (!projectId || !workspaceId || !root) throw new ValidationError('Project workspace requires projectId, workspaceId, and root');
  return Object.freeze({
    projectId,
    workspaceId,
    taskId,
    root: path.resolve(root),
    mode,
    protectedTargets: Object.freeze(['main', 'production'])
  });
}

export function createTaskWorkspace({ projectId, taskId, root, mode = WORKSPACE_MODES.ISOLATED }) {
  if (!taskId) throw new ValidationError('Task workspace requires taskId');
  return createProjectWorkspace({ projectId, workspaceId: projectId + ':' + taskId, taskId, root, mode });
}

export function assertWorkspaceWriteAllowed(workspace, targetRef) {
  if (workspace.mode !== WORKSPACE_MODES.ISOLATED) throw new PermissionDeniedError('Writes are only allowed from an isolated project workspace');
  if (workspace.protectedTargets.includes(targetRef)) throw new PermissionDeniedError('Direct writes to protected target are forbidden: ' + targetRef);
  return true;
}

export function resolveWorkspacePath(workspace, relativePath) {
  if (!workspace?.root || typeof relativePath !== 'string' || !relativePath.trim()) throw new ValidationError('A workspace and relative path are required');
  if (path.isAbsolute(relativePath)) throw new PermissionDeniedError('Absolute paths are not allowed');
  const root = path.resolve(workspace.root);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new PermissionDeniedError('Path is outside the project workspace');
  return resolved;
}

export function assertPathInWorkspace(workspace, targetPath) {
  const root = path.resolve(workspace.root);
  const resolved = path.resolve(targetPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new PermissionDeniedError('Path is outside the project workspace');
  return resolved;
}
