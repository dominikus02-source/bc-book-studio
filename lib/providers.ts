import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
export const providerEndpoints = {
 openai:"https://api.openai.com/v1/chat/completions",
 deepseek:"https://api.deepseek.com/chat/completions",
 qwen:"https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
} as const;
export const providerSchema = z.enum(["openai","deepseek","qwen"]);
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
 return {apiKey:decryptCredential(record.encryptedKey,record.id),model:record.model,endpoint:providerEndpoints[provider]};
}
export function safeMutation(req:Request) {
 const origin=req.headers.get("origin");
 if(origin&&origin!==new URL(req.url).origin&&origin!==process.env.STUDIO_PUBLIC_ORIGIN)return false;
 return req.headers.get("content-type")?.split(";")[0]==="application/json";
}
