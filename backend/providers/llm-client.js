import { ExternalServiceError, ModelError, ValidationError } from '../errors/index.js';

export class LlmClient {
  constructor({ apiKey = process.env.OPENAI_API_KEY, baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', model = process.env.OPENAI_MODEL || 'gpt-5.6-luna', fetchImpl = fetch } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  async generateJson({ system, user, schema, name = 'fagla_result' }) {
    if (!this.apiKey) throw new ValidationError('OPENAI_API_KEY is not configured');
    const response = await this.fetchImpl(this.baseUrl + '/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: system }] },
          { role: 'user', content: [{ type: 'input_text', text: user }] }
        ],
        text: { format: { type: 'json_schema', name, strict: true, schema } }
      })
    });
    if (!response.ok) throw new ExternalServiceError(`LLM request failed with HTTP ${response.status}`);
    const data = await response.json();
    const text = data.output_text;
    if (typeof text !== 'string' || !text.trim()) throw new ModelError('LLM returned no structured text');
    try { return JSON.parse(text); } catch (error) { throw new ModelError('LLM returned invalid JSON', { cause: error }); }
  }
}
