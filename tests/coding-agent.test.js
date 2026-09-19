import test from 'node:test';
import assert from 'node:assert/strict';
import { CodingAgent } from '../backend/agents/coding-agent.js';

test('coding agent has a reviewable proposal-only contract', async () => {
  let called = false;
  const llmClient = {
    async generateJson(args) {
      called = true;
      assert.equal(args.name, 'coding_agent_proposal');
      return {
        summary: 'Add a test page',
        assumptions: [],
        steps: ['Create the page', 'Run tests'],
        changes: [{ path: 'src/page.js', action: 'create', reason: 'Requested page', content: 'export default 1;' }],
        validation: ['npm test']
      };
    }
  };
  const agent = new CodingAgent({ llmClient });
  const result = await agent.execute({
    request: 'Create a test page',
    project: { id: 'p1' },
    workspace: { projectId: 'p1', workspaceId: 'w1', mode: 'ISOLATED', protectedTargets: ['main', 'production'] }
  });
  assert.equal(called, true);
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.output.type, 'code-change-proposal');
  assert.equal(result.output.proposal.changes[0].action, 'create');
});

test('coding agent does not execute tools during proposal generation', async () => {
  const agent = new CodingAgent({
    llmClient: { async generateJson() {
      return { summary: 'No-op', assumptions: [], steps: [], changes: [], validation: [] };
    }}
  });
  const result = await agent.execute({
    request: 'Review only',
    project: { id: 'p1' },
    workspace: { projectId: 'p1', workspaceId: 'w1', mode: 'ISOLATED', protectedTargets: ['main', 'production'] }
  });
  assert.deepEqual(result.output.proposal.changes, []);
});
