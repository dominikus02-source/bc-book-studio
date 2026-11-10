import {randomUUID} from "node:crypto";
import {db} from "./db";
export type ReportedUsage={inputTokens:number|null;outputTokens:number|null;totalTokens:number|null;reported:boolean};
function count(x:unknown):number|null{return typeof x==="number"&&Number.isSafeInteger(x)&&x>=0&&x<=100000000?x:null}
export function parseProviderUsage(provider:string,source:unknown):ReportedUsage{
 const data=source&&typeof source==="object"?source as Record<string,unknown>:{};
 const usage=(data.usage&&typeof data.usage==="object"?data.usage:{}) as Record<string,unknown>;
 const prompt=count(usage.prompt_tokens??usage.input_tokens??usage.promptTokenCount);
 const completion=count(usage.completion_tokens??usage.output_tokens??usage.candidatesTokenCount);
 const total=count(usage.total_tokens??usage.totalTokenCount);
 const input=provider==="gemini"?count((data.usageMetadata as Record<string,unknown>|undefined)?.promptTokenCount)??prompt:prompt;
 const output=provider==="gemini"?count((data.usageMetadata as Record<string,unknown>|undefined)?.candidatesTokenCount)??completion:completion;
 const all=provider==="gemini"?count((data.usageMetadata as Record<string,unknown>|undefined)?.totalTokenCount)??total:total;
 return {inputTokens:input,outputTokens:output,totalTokens:all??(input!==null&&output!==null?input+output:null),reported:input!==null||output!==null||all!==null};
}
export async function recordAiUsage(args:{credentialId:string;provider:string;model:string;purpose:string;actorId?:string|null;usage:ReportedUsage}):Promise<void>{
 const {credentialId,provider,model,purpose,actorId,usage}=args;
 await db.$executeRaw`INSERT INTO "AiUsageEvent" ("id","credentialId","provider","model","purpose","actorId","inputTokens","outputTokens","totalTokens","reported")
 VALUES (${randomUUID()},${credentialId},${provider},${model},${purpose},${actorId||null},${usage.inputTokens},${usage.outputTokens},${usage.totalTokens},${usage.reported})`;
}
