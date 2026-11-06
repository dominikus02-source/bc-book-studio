import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
export const providerEndpoints = {
 openai:"https://api.openai.com/v1/chat/completions",
 deepseek:"https://api.deepseek.com/chat/completions",
 qwen:"https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
 groq:"https://api.groq.com/openai/v1/chat/completions",
 gemini:"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
 anthropic:"https://api.anthropic.com/v1/messages",
 openrouter:"https://openrouter.ai/api/v1/chat/completions",
 mistral:"https://api.mistral.ai/v1/chat/completions",
 xai:"https://api.x.ai/v1/chat/completions"
} as const;
export const providerExamples = {
 openai:"gpt-4.1-mini",deepseek:"deepseek-flash",qwen:"qwen-plus",
 groq:"openai/gpt-oss-120b",gemini:"gemini-2.5-flash",
 anthropic:"claude-sonnet-4-5",openrouter:"openai/gpt-4.1-mini",
 mistral:"mistral-small-latest",xai:"grok-4"
} as const;
export const providerLabels = {
 openai:"OpenAI",deepseek:"DeepSeek",qwen:"Qwen (Alibaba Cloud)",
 groq:"Groq",gemini:"Google Gemini",anthropic:"Anthropic Claude",
 openrouter:"OpenRouter",mistral:"Mistral AI",xai:"xAI Grok"
} as const;
export const providerSchema = z.enum(["openai","deepseek","qwen","groq","gemini","anthropic","openrouter","mistral","xai"]);
const apiKey = z.string().trim().min(16).max(4096).regex(/^[^\s]+$/);
const modelSettings = {
 label:z.string().trim().min(2).max(80),
 model:z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._:/-]+$/),
 maxTokens:z.number().int().min(16).max(3000).default(1800),
 temperature:z.number().min(0).max(2).default(0.4),
 active:z.boolean().default(false)
};
export const credentialInput = z.object({provider:providerSchema,apiKey,...modelSettings}).strict();
export const credentialUpdate = z.object({
 apiKey:apiKey.optional(),label:modelSettings.label.optional(),model:modelSettings.model.optional(),
 maxTokens:modelSettings.maxTokens.optional(),temperature:modelSettings.temperature.optional(),
 active:modelSettings.active.optional()
}).strict().refine(x=>Object.keys(x).length>0);
export const safeCredential = {id:true,provider:true,label:true,model:true,lastFour:true,active:true,maxTokens:true,temperature:true,createdAt:true,updatedAt:true} as const;
function encryptionKey() {
 const encoded=process.env.STUDIO_SECRET_ENCRYPTION_KEY || "";
 if(!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw Error("Credential encryption unavailable");
 const key=Buffer.from(encoded,"base64");
 if(key.length!==32)throw Error("Credential encryption unavailable");
 return key;
}
export function encryptionReady() {try{encryptionKey();return true}catch{return false}}
export function encryptCredential(secret:string,id:string) {
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
 cipher.setAAD(Buffer.from(id));
 const encrypted=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);
 return ["v1",iv.toString("base64"),cipher.getAuthTag().toString("base64"),encrypted.toString("base64")].join(".");
}
export function decryptCredential(value:string,id:string) {
 const [version,iv,tag,payload]=value.split(".");
 if(version!=="v1"||!iv||!tag||!payload)throw Error("Credential unavailable");
 const cipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(iv,"base64"));
 cipher.setAAD(Buffer.from(id));cipher.setAuthTag(Buffer.from(tag,"base64"));
 return Buffer.concat([cipher.update(Buffer.from(payload,"base64")),cipher.final()]).toString("utf8");
}
export async function activeProvider(credentialId?:string) {
 const record=credentialId
   ? await db.providerCredential.findFirst({where:{id:credentialId,active:true}})
   : await db.providerCredential.findFirst({where:{active:true},orderBy:{createdAt:"asc"}});
 if(!record)return null;
 const provider=providerSchema.parse(record.provider);
 return {id:record.id,provider,apiKey:decryptCredential(record.encryptedKey,record.id),model:record.model,
   maxTokens:record.maxTokens,temperature:record.temperature,endpoint:providerEndpoints[provider]};
}
export function safeMutation(req:Request) {
 const origin=req.headers.get("origin");
 if(origin&&origin!==new URL(req.url).origin&&origin!==process.env.STUDIO_PUBLIC_ORIGIN)return false;
 return req.headers.get("content-type")?.split(";")[0]==="application/json";
}
type Message = {role:"system"|"user";content:string};
type TokenUsage={inputTokens:number;outputTokens:number;totalTokens:number;estimated:boolean};
function nonNegativeInt(value:unknown):number|undefined {
 return typeof value==="number"&&Number.isFinite(value)&&value>=0?Math.floor(value):undefined;
}
export async function invokeProvider(
  provider: z.infer<typeof providerSchema>,
  model: string, apiKey: string, messages: Message[],
  options: { maxTokens?: number; temperature?:number; timeoutMs?: number } = {}
):Promise<{content:string;usage:TokenUsage}> {
  const endpoint = providerEndpoints[provider];
  const headers:Record<string,string> = {"Content-Type":"application/json"};
  const maxTokens = Math.min(3000,Math.max(16,options.maxTokens ?? 1800));
  const temperature = Math.min(2,Math.max(0,options.temperature ?? 0.4));
  let url:string = endpoint;
  let body:unknown;
  if(provider==="gemini"){
    headers["x-goog-api-key"]=apiKey;
    url=endpoint.replace("{model}",encodeURIComponent(model));
    body={
      systemInstruction:{parts:[{text:messages.filter(m=>m.role==="system").map(m=>m.content).join("\n")}]},
      contents:messages.filter(m=>m.role!=="system").map(m=>({role:"user",parts:[{text:m.content}]})),
      generationConfig:{maxOutputTokens:maxTokens,temperature}
    };
  }else if(provider==="anthropic"){
    headers["x-api-key"]=apiKey;
    headers["anthropic-version"]="2026-10-21";
    body={model,max_tokens:maxTokens,temperature,
      system:messages.filter(m=>m.role==="system").map(m=>m.content).join("\n"),
      messages:messages.filter(m=>m.role!=="system")};
  }else{
    headers.Authorization="Bearer "+apiKey;
    if(provider==="openai" && /^(gpt-[56]|o[1-9])/i.test(model)){
      body={model,max_completion_tokens:maxTokens,messages};
    }else if(provider==="deepseek"){
      body={model,max_tokens:maxTokens,messages,temperature,thinking:{type:"disabled"}};
    }else{
      body={model,max_tokens:maxTokens,messages,temperature};
    }
  }
  const result=await fetch(url,{method:"POST",headers,body:JSON.stringify(body),cache:"no-store",
    redirect:"error",signal:AbortSignal.timeout(Math.min(45000,options.timeoutMs ?? 45000))});
  if(!result.ok)throw Error("PROVIDER_HTTP_"+result.status);
  const data=await result.json() as {
    choices?:{message?:{content?:string}}[];
    candidates?:{content?:{parts?:{text?:string}[]}}[];
    content?:{type?:string;text?:string}[];
    usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number;input_tokens?:number;output_tokens?:number};
    usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;totalTokenCount?:number};
  };
  const content=provider==="gemini"
    ? data.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")
    : provider==="anthropic"
      ? data.content?.filter(p=>p.type==="text").map(p=>p.text||"").join("")
      : data.choices?.[0]?.message?.content;
  if(!content?.trim())throw Error("PROVIDER_EMPTY_RESPONSE");
  const rawInput=provider==="gemini"?data.usageMetadata?.promptTokenCount:
    provider==="anthropic"?data.usage?.input_tokens:data.usage?.prompt_tokens;
  const rawOutput=provider==="gemini"?data.usageMetadata?.candidatesTokenCount:
    provider==="anthropic"?data.usage?.output_tokens:data.usage?.completion_tokens;
  const input=nonNegativeInt(rawInput),output=nonNegativeInt(rawOutput);
  const estimated=input===undefined||output===undefined;
  const inputTokens=input??Math.ceil(messages.reduce((sum,m)=>sum+m.content.length,0)/4);
  const outputTokens=output??Math.ceil(content.length/4);
  const reportedTotal=provider==="gemini"?data.usageMetadata?.totalTokenCount:data.usage?.total_tokens;
  return {content:content.trim(),usage:{inputTokens,outputTokens,
    totalTokens:nonNegativeInt(reportedTotal)??inputTokens+outputTokens,estimated}};
}
