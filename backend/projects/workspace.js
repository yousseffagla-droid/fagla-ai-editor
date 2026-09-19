export const WORKSPACE_MODES = Object.freeze({ ISOLATED: 'ISOLATED', READ_ONLY: 'READ_ONLY' });
export function createProjectWorkspace({ projectId, root }) {
  if (!projectId || !root) throw new Error('Project workspace requires projectId and root');
  return Object.freeze({ projectId, root, mode: WORKSPACE_MODES.ISOLATED, protectedTargets: ['main', 'production'], workflow: ['agent-changes', 'tests', 'qa', 'approval', 'merge'] });
}
export function assertWorkspaceWriteAllowed(workspace, targetRef) {
  if (workspace.mode !== WORKSPACE_MODES.ISOLATED) throw new Error('Writes are only allowed from an isolated project workspace');
  if (workspace.protectedTargets.includes(targetRef)) throw new Error(`Direct writes to protected target are forbidden: ${targetRef}`);
  return true;
}
