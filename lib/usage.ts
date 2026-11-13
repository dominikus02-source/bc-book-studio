import { db } from "./db";
import { NextResponse } from "next/server";

// An atomic database counter works across restarts and multiple web workers.
// When an AI daily limit is set, failed provider attempts also consume that cap.
export async function takeQuota(scope: string, subject: string, period: string, limit: number) {
  const rows = await db.$queryRaw<Array<{count:number}>>`
    INSERT INTO "UsageCounter" ("scope","subject","period","count")
    VALUES (${scope},${subject},${period},1)
    ON CONFLICT ("scope","subject","period") DO UPDATE
    SET "count" = "UsageCounter"."count" + 1
    WHERE "UsageCounter"."count" < ${limit}
    RETURNING "count"`;
  return rows.length > 0;
}
export function quotaDenied() {
  return NextResponse.json({error:"Batas penggunaan tercapai. Silakan coba lagi besok."},
    {status:429,headers:{"Cache-Control":"no-store","Retry-After":"86400"}});
}
export async function canCreateBook(owner: string) {
  return takeQuota("book-create",owner,new Date().toISOString().slice(0,10),20);
}
/** 0 means unlimited. Unset, empty, 0, or an invalid value is unlimited. Positive integers cap daily AI calls. */
export function parseDailyLimit(name:string,env:NodeJS.ProcessEnv=process.env):number{
  const raw=env[name];
  if(raw===undefined||String(raw).trim()==="")return 0;
  const n=Number(String(raw).trim());
  if(!Number.isFinite(n)||n<=0)return 0;
  return Math.min(10_000,Math.trunc(n));
}
/** Per-user and global daily AI caps. 0 / unset = unlimited. Set AI_DAILY_LIMIT_PER_USER or AI_DAILY_LIMIT_GLOBAL to enforce a cap later. */
export function generationLimits(env:NodeJS.ProcessEnv=process.env){
  return {user:parseDailyLimit("AI_DAILY_LIMIT_PER_USER",env),global:parseDailyLimit("AI_DAILY_LIMIT_GLOBAL",env)};
}
export async function canGenerate(owner: string) {
  const day = new Date().toISOString().slice(0,10);
  const limits=generationLimits();
  if(limits.user>0 && !await takeQuota("ai-user",owner,day,limits.user))return false;
  if(limits.global>0 && !await takeQuota("ai-global","all",day,limits.global))return false;
  return true;
}
