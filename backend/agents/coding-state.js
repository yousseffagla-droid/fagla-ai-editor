import { InvalidTaskTransition } from '../errors/index.js';

export const CODING_AGENT_STATES = Object.freeze({
  IDLE: 'IDLE', PLANNING: 'PLANNING', EXECUTING: 'EXECUTING', TESTING: 'TESTING',
  VALIDATING: 'VALIDATING', WAITING_APPROVAL: 'WAITING_APPROVAL', COMPLETED: 'COMPLETED', FAILED: 'FAILED'
});

const TRANSITIONS = Object.freeze({
  IDLE: [CODING_AGENT_STATES.PLANNING, CODING_AGENT_STATES.FAILED],
  PLANNING: [CODING_AGENT_STATES.EXECUTING, CODING_AGENT_STATES.FAILED],
  EXECUTING: [CODING_AGENT_STATES.TESTING, CODING_AGENT_STATES.WAITING_APPROVAL, CODING_AGENT_STATES.FAILED],
  TESTING: [CODING_AGENT_STATES.VALIDATING, CODING_AGENT_STATES.FAILED],
  VALIDATING: [CODING_AGENT_STATES.COMPLETED, CODING_AGENT_STATES.FAILED],
  WAITING_APPROVAL: [CODING_AGENT_STATES.EXECUTING, CODING_AGENT_STATES.FAILED],
  COMPLETED: [], FAILED: []
});

export function canTransitionCodingState(from, to) { return TRANSITIONS[from]?.includes(to) ?? false; }
export function transitionCodingState(from, to) {
  if (!Object.values(CODING_AGENT_STATES).includes(to) || !canTransitionCodingState(from, to)) throw new InvalidTaskTransition('Cannot transition Coding Agent from ' + from + ' to ' + to);
  return to;
}
export function codingStateTransitions() { return TRANSITIONS; }
