import { spawn } from 'node:child_process';
import { CommandNotAllowedError, ValidationError } from '../errors/index.js';
import { assertPathInWorkspace } from '../projects/workspace.js';

const ALLOWED_COMMANDS = Object.freeze({ 'npm test': Object.freeze({ executable: 'npm', args: Object.freeze(['test']) }) });

export function allowedCommands() { return Object.freeze(Object.keys(ALLOWED_COMMANDS)); }
export function validateAllowedCommand(command, args = []) {
  const definition = ALLOWED_COMMANDS[command];
  if (!definition || JSON.stringify(definition.args) !== JSON.stringify(args)) throw new CommandNotAllowedError('Command is not allowed: ' + command);
  return definition;
}
export async function runAllowedCommand({ command, args = [], workspace, timeoutMs = 120000 }) {
  if (!workspace) throw new ValidationError('Workspace is required for command execution');
  validateAllowedCommand(command, args); assertPathInWorkspace(workspace, workspace.root);
  return new Promise((resolve, reject) => {
    const child = spawn(ALLOWED_COMMANDS[command].executable, ALLOWED_COMMANDS[command].args, { cwd: workspace.root, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: 'true' } });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new CommandNotAllowedError('Allowed command timed out: ' + command)); }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve(Object.freeze({ command, args: [...args], code, stdout, stderr })); });
  });
}
