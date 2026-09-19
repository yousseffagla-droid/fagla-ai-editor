import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertWorkspaceWriteAllowed, resolveWorkspacePath } from '../projects/workspace.js';
import { runAllowedCommand } from '../runtime/command-executor.js';
import { ValidationError, PermissionDeniedError } from '../errors/index.js';

function assertModelSafePath(inputPath){
  if(typeof inputPath!=='string') throw new ValidationError('Path is required');
  const normalized=inputPath.replaceAll('\\\\','/');
  if(normalized.split('/').some(part=>part.toLowerCase()==='.env'||/^\.env\./i.test(part)||/credentials?|secrets?/i.test(part))) throw new PermissionDeniedError('Sensitive configuration files are not available to the Coding Agent');
}

const execFileAsync = promisify(execFile);

function tool(name, description, permission, riskLevel, handler, extras = {}) {
  return { name, description, permission, requiredPermission: permission, riskLevel, handler, ...extras };
}
function audit(auditLogger, event, execution, details = {}) {
  return auditLogger?.append({ event, taskId: execution.taskId, projectId: execution.projectId, agentId: execution.agentId, workspaceId: execution.workspaceId, executionId: execution.executionId, ...details });
}

export function registerCodingTools({ registry, auditLogger }) {
  const definitions = [
    tool('coding.list_files', 'List files inside the isolated workspace.', 'READ', 'LOW', async (input, execution) => {
      const workspace = execution.metadata.workspace; const dir = resolveWorkspacePath(workspace, input?.path || '.');
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.map(entry => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' }));
    }),
    tool('coding.read_file', 'Read a text file inside the isolated workspace.', 'READ', 'LOW', async (input, execution) => {
      const workspace = execution.metadata.workspace; assertModelSafePath(input.path); const target = resolveWorkspacePath(workspace, input.path);
      const content = await fs.readFile(target, 'utf8');
      await audit(auditLogger, 'coding.file.read', execution, { path: input.path });
      return { path: input.path, content };
    }),
    tool('coding.create_file', 'Create a new text file inside the isolated workspace.', 'WRITE', 'LOW', async (input, execution) => {
      const workspace = execution.metadata.workspace; const target = resolveWorkspacePath(workspace, input.path);
      assertWorkspaceWriteAllowed(workspace, 'workspace'); await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, input.content ?? '', { encoding: 'utf8', flag: 'wx' });
      await audit(auditLogger, 'coding.file.changed', execution, { path: input.path, operation: 'create' });
      return { path: input.path, operation: 'create' };
    }),
    tool('coding.update_file', 'Update an existing text file inside the isolated workspace.', 'WRITE', 'LOW', async (input, execution) => {
      const workspace = execution.metadata.workspace; const target = resolveWorkspacePath(workspace, input.path);
      assertWorkspaceWriteAllowed(workspace, 'workspace'); await fs.writeFile(target, input.content ?? '', 'utf8');
      await audit(auditLogger, 'coding.file.changed', execution, { path: input.path, operation: 'update' });
      return { path: input.path, operation: 'update' };
    }),
    tool('coding.inspect_project', 'Inspect top-level project files and package metadata.', 'READ', 'LOW', async (_input, execution) => {
      const workspace = execution.metadata.workspace; const entries = await fs.readdir(workspace.root, { withFileTypes: true });
      const packagePath = resolveWorkspacePath(workspace, 'package.json'); let packageJson = null;
      try { packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8')); } catch {}
      return { files: entries.map(entry => entry.name), package: packageJson };
    }),
    tool('coding.run_tests', 'Run the approved project test command.', 'EXECUTE', 'LOW', async (input, execution) => {
      await audit(auditLogger, 'coding.tests.started', execution, { command: input.command || 'npm test' });
      const result = await runAllowedCommand({ command: input.command || 'npm test', args: input.args || ['test'], workspace: execution.metadata.workspace });
      await audit(auditLogger, 'coding.tests.completed', execution, { command: result.command, exitCode: result.code });
      if (result.code !== 0) throw new ValidationError('Allowed test command failed with exit code ' + result.code);
      return result;
    }),
    tool('coding.git_status', 'Read git status inside the workspace.', 'GIT', 'LOW', async (_input, execution) => {
      const result = await execFileAsync('git', ['status', '--short', '--branch'], { cwd: execution.metadata.workspace.root });
      return { stdout: result.stdout, stderr: result.stderr };
    }),
    tool('coding.git_diff', 'Read the current git diff inside the workspace.', 'GIT', 'LOW', async (_input, execution) => {
      const result = await execFileAsync('git', ['diff', '--'], { cwd: execution.metadata.workspace.root });
      return { stdout: result.stdout, stderr: result.stderr };
    }),
    tool('coding.git_commit', 'Create a git commit after human approval.', 'GIT', 'MEDIUM', async () => { throw new ValidationError('git commit is approval-gated'); }),
    tool('coding.git_push', 'Push changes after human approval.', 'GIT', 'MEDIUM', async () => { throw new ValidationError('git push is approval-gated'); }),
    tool('coding.git_merge', 'Merge branches; permanently denied in V1.', 'GIT', 'HIGH', async () => { throw new ValidationError('git merge is disabled in V1'); }, { alwaysDeny: true, denyReason: 'git merge is permanently denied in V1.' })
  ];
  for (const definition of definitions) registry.register(definition);
  return definitions;
}
