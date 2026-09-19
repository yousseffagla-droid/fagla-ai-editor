import { TOOL_RISK_LEVELS } from '../tools/contracts.js';
export class PermissionPolicy {
  evaluate(tool, _executionContext) {
    if (tool.riskLevel === TOOL_RISK_LEVELS.LOW) return { status: 'ALLOW', reason: 'Low-risk tool execution is allowed by policy.' };
    return { status: 'REQUIRES_APPROVAL', reason: `${tool.riskLevel}-risk tool execution requires explicit human approval.` };
  }
}
