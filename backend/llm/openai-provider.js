import { ExternalServiceError, ModelError, TimeoutError, ValidationError } from '../errors/index.js';
import { LLMProvider } from './provider.js';
import { CODING_DECISION_SCHEMA, validateCodingDecision } from './response-schema.js';

const DEFAULT_MODEL='gpt-5.6-luna';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export class OpenAIProvider extends LLMProvider {
  constructor({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL||DEFAULT_MODEL,baseUrl=process.env.OPENAI_BASE_URL||'https://api.openai.com/v1',timeoutMs=30000,maxRetries=2,fetchImpl=globalThis.fetch}={}){
    super(); if(!apiKey)throw new ModelError('OPENAI_API_KEY is required for OpenAIProvider'); if(typeof fetchImpl!=='function')throw new ModelError('A fetch implementation is required');
    this.apiKey=apiKey; this.model=model; this.baseUrl=baseUrl.replace(/\/$/,''); this.timeoutMs=timeoutMs; this.maxRetries=Math.max(0,maxRetries); this.fetch=fetchImpl;
  }
  async generateCodingDecision(context){
    const payload={model:this.model,input:[
      {role:'system',content:'You are a coding planner. Return only the requested JSON object. Never request tools outside the supplied coding tool registry. The runtime, not you, enforces permissions, workspace boundaries, approvals, and execution.'},
      {role:'user',content:JSON.stringify(context)}
    ],text:{format:{type:'json_schema',name:'coding_decision',strict:true,schema:CODING_DECISION_SCHEMA}}};
    let attempt=0;
    while(true){
      try{
        const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
        const response=await this.fetch(this.baseUrl+'/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.apiKey},body:JSON.stringify(payload),signal:controller.signal});
        clearTimeout(timer); const body=await response.json().catch(()=>null); const latencyMs=Date.now()-started;
        if(response.ok){
          const text=body?.output_text??body?.output?.flatMap(i=>i.content??[]).find(i=>i.type==='output_text')?.text;
          if(!text)throw new ModelError('OpenAI response did not contain structured output');
          let parsed; try{parsed=JSON.parse(text);}catch{throw new ValidationError('OpenAI returned malformed JSON');}
          return Object.freeze({decision:validateCodingDecision(parsed),usage:body?.usage??null,model:body?.model??this.model,latencyMs});
        }
        const transient=response.status===408||response.status===409||response.status===429||response.status>=500;
        const message=typeof body?.error?.message==='string'?body.error.message:'OpenAI request failed';
        if(!transient||attempt>=this.maxRetries)throw new ExternalServiceError('OpenAI provider error: '+message);
      }catch(error){
        if(error.name==='AbortError'){if(attempt>=this.maxRetries)throw new TimeoutError('OpenAI provider timed out');}
        else if(error instanceof ValidationError||error instanceof ModelError)throw error;
        else if(!(error instanceof ExternalServiceError)&&attempt>=this.maxRetries)throw new ExternalServiceError('OpenAI provider unavailable');
        else if(error instanceof ExternalServiceError&&attempt>=this.maxRetries)throw error;
      }
      attempt++; await sleep(250*2**(attempt-1));
    }
  }
  async generateCodingPlan(context){const response=await this.generateCodingDecision(context);if(response.decision.type!=='plan')throw new ValidationError('OpenAI response is not a coding plan');return response.decision;}
}
