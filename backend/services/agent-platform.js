import { AgentRuntime } from '../runtime/agent-runtime.js';
import { ToolRegistry, ToolExecutor } from '../tools/registry.js';
import { PermissionPolicy } from '../permissions/policy.js';
import { InMemoryApprovalStore } from '../approvals/store.js';
import { AuditLogger } from '../logging/audit-log.js';
import { InMemoryMemoryStore } from '../memory/store.js';
import { InMemoryTaskStore } from '../tasks/store.js';
export function createAgentPlatform(){const toolRegistry=new ToolRegistry();const toolExecutor=new ToolExecutor(toolRegistry);const permissionPolicy=new PermissionPolicy();const auditLogger=new AuditLogger();const approvalStore=new InMemoryApprovalStore({auditLogger});const memoryStore=new InMemoryMemoryStore();const taskStore=new InMemoryTaskStore();const runtime=new AgentRuntime({toolRegistry,toolExecutor,permissionPolicy,approvalStore,auditLogger,taskStore});return Object.freeze({runtime,toolRegistry,toolExecutor,permissionPolicy,approvalStore,auditLogger,memoryStore,taskStore});}
