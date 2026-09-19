export class FaglaError extends Error {
  constructor(message, options = {}) { super(message, options); this.name = new.target.name; this.code = options.code ?? this.name; }
}
export class AgentContractError extends FaglaError {}
export class InvalidTaskTransition extends FaglaError {}
export class InvalidToolInvocationError extends FaglaError {}
export class PermissionDeniedError extends FaglaError {}
export class ApprovalRequiredError extends FaglaError {}
export class AgentExecutionError extends FaglaError {}
export class ValidationError extends FaglaError {}
export class ToolExecutionError extends FaglaError {}
export class AuthenticationError extends FaglaError {}
export class TimeoutError extends FaglaError {}
export class ExternalServiceError extends FaglaError {}
export class ModelError extends FaglaError {}
