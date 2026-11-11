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
// Model IDs can vary by project and region: the admin chooses an allowed model.
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
export const credentialInput = z.object({
 provider:providerSchema, label:z.string().trim().min(2).max(80),
 model:z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._:/-]+$/),
 apiKey, active:z.boolean().default(false)
}).strict();
export const credentialUpdate = credentialInput.omit({provider:true,active:true}).partial().extend({active:z.boolean().optional()}).refine(x=>Object.keys(x).length>0);
export const safeCredential = {id:true,provider:true,label:true,model:true,lastFour:true,active:true,createdAt:true,updatedAt:true} as const;
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
export async function activeProvider() {
 const record=await db.providerCredential.findFirst({where:{active:true}});
 if(!record)return null;
 const provider=providerSchema.parse(record.provider);
 return {id:record.id,provider,apiKey:decryptCredential(record.encryptedKey,record.id),model:record.model,endpoint:providerEndpoints[provider]};
}
function configuredOrigins(){
 return [process.env.STUDIO_PUBLIC_ORIGIN,process.env.APP_ORIGIN].map(v=>(v||"").trim()).filter(Boolean);
}
/** Browser Origin is allowed when it matches the request URL or the configured public site. */
export function allowedRequestOrigin(req:Request) {
 const origin=req.headers.get("origin");
 if(!origin)return true;
 const target=new URL(req.url);
 if(origin===target.origin||configuredOrigins().includes(origin))return true;
 try{
  const from=new URL(origin);const hosts=["localhost","127.0.0.1"];
  if(process.env.NODE_ENV!=="production"&&hosts.includes(from.hostname)&&hosts.includes(target.hostname)&&from.port===target.port&&from.protocol===target.protocol)return true;
 }catch{}
 return false;
}
export function safeMutation(req:Request) {
 if(!allowedRequestOrigin(req))return false;
 return req.headers.get("content-type")?.split(";")[0]==="application/json";
}

type Message = {role:"system"|"user";content:string};
export async function invokeProvider(
  provider: z.infer<typeof providerSchema>,
  model: string, apiKey: string, messages: Message[],
  options: { maxTokens?: number; timeoutMs?: number; onUsage?:(usage:import("./ai-usage").ReportedUsage)=>Promise<void> } = {}
) {
  const endpoint = providerEndpoints[provider];
  const headers:Record<string,string> = {"Content-Type":"application/json"};
  const maxTokens = Math.min(3000,Math.max(16,options.maxTokens ?? 1800));
  let url:string = endpoint;
  let body:unknown;
  if(provider==="gemini"){
    headers["x-goog-api-key"]=apiKey;
    url=endpoint.replace("{model}",encodeURIComponent(model));
    body={
      systemInstruction:{parts:[{text:messages.filter(m=>m.role==="system").map(m=>m.content).join("\n")}]},
      contents:messages.filter(m=>m.role!=="system").map(m=>({role:"user",parts:[{text:m.content}]})),
      generationConfig:{maxOutputTokens:maxTokens,temperature:0.4}
    };
  }else if(provider==="anthropic"){
    headers["x-api-key"]=apiKey;
    headers["anthropic-version"]="2026-10-21";
    body={model,max_tokens:maxTokens,
      system:messages.filter(m=>m.role==="system").map(m=>m.content).join("\n"),
      messages:messages.filter(m=>m.role!=="system")};
  }else{
    headers.Authorization="Bearer "+apiKey;
    // Recent OpenAI reasoning models use max_completion_tokens; some reject temperature.
    if(provider==="openai" && /^(gpt-[56]|o[1-9])/i.test(model)){
      body={model,max_completion_tokens:maxTokens,messages};
    }else if(provider==="deepseek"){
      // DeepSeek defaults to thinking; disable for short test prompts and draft responses.
      body={model,max_tokens:maxTokens,messages,temperature:0.4,thinking:{type:"disabled"}};
    }else{
      body={model,max_tokens:maxTokens,messages,temperature:0.4};
    }
  }
  // Only fixed provider endpoints can be called (prevents SSRF via settings).
  const result=await fetch(url,{method:"POST",headers,body:JSON.stringify(body),cache:"no-store",
    redirect:"error",signal:AbortSignal.timeout(Math.min(45000,options.timeoutMs ?? 45000))});
  if(!result.ok)throw Error("PROVIDER_HTTP_"+result.status);
  const data=await result.json() as {
    choices?:{message?:{content?:string}}[];
    candidates?:{content?:{parts?:{text?:string}[]}}[];
    content?:{type?:string;text?:string}[];
  };

  const content=provider==="gemini"
    ? data.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")
    : provider==="anthropic"
      ? data.content?.filter(p=>p.type==="text").map(p=>p.text||"").join("")
      : data.choices?.[0]?.message?.content;
  if(!content?.trim())throw Error("PROVIDER_EMPTY_RESPONSE");
  if(options.onUsage){try{const {parseProviderUsage}=await import("./ai-usage");await options.onUsage(parseProviderUsage(provider,data))}catch{/* Telemetry must not interrupt content delivery. */}}
  return content.trim();
}
