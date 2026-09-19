import { AgentRuntime } from '../runtime/agent-runtime.js';
import { ToolRegistry } from '../tools/registry.js';
import { PermissionPolicy } from '../permissions/policy.js';
import { ApprovalStore } from '../approvals/store.js';
import { AuditLogger } from '../logging/audit-log.js';
import { MemoryStore } from '../memory/store.js';
export function createAgentPlatform() {
  const toolRegistry = new ToolRegistry();
  const permissionPolicy = new PermissionPolicy();
  const approvalStore = new ApprovalStore();
  const auditLogger = new AuditLogger();
  const memoryStore = new MemoryStore();
  const runtime = new AgentRuntime({ toolRegistry, permissionPolicy, approvalStore, auditLogger });
  return Object.freeze({ runtime, toolRegistry, permissionPolicy, approvalStore, auditLogger, memoryStore });
}
