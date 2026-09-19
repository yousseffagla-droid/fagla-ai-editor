import { TOOL_RISK_LEVELS } from '../tools/contracts.js';
import { PermissionDeniedError } from '../errors/index.js';

export const PERMISSION_DECISIONS = Object.freeze({ ALLOW: 'ALLOW', DENY: 'DENY', REQUIRES_APPROVAL: 'REQUIRES_APPROVAL' });

export class PermissionPolicy {
  evaluate(tool, executionContext) {
    if (!tool || !executionContext) return { status: PERMISSION_DECISIONS.DENY, reason: 'Tool and execution context are required.' };
    if (tool.alwaysDeny) return { status: PERMISSION_DECISIONS.DENY, reason: tool.denyReason || 'Tool is denied by policy.' };
    if (tool.requiredPermission && !executionContext.permissions.includes(tool.requiredPermission)) {
      return { status: PERMISSION_DECISIONS.DENY, reason: 'Missing permission: ' + tool.requiredPermission };
    }
    if (tool.riskLevel === TOOL_RISK_LEVELS.LOW) return { status: PERMISSION_DECISIONS.ALLOW, reason: 'Low-risk tool execution is allowed by policy.' };
    return { status: PERMISSION_DECISIONS.REQUIRES_APPROVAL, reason: tool.riskLevel + '-risk tool execution requires explicit human approval.' };
  }
  assertAllowed(decision) {
    if (decision.status === PERMISSION_DECISIONS.DENY) throw new PermissionDeniedError(decision.reason);
    return decision;
  }
}
