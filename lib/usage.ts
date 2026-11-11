import { db } from "./db";
import { NextResponse } from "next/server";

// An atomic database counter works across restarts and multiple web workers.
// Failed provider attempts also consume quota so repeated errors cannot bypass limits.
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
function dailyLimit(name:string,fallback:number){
  const n=Number(process.env[name]);
  return Number.isFinite(n)&&n>=1?Math.min(10_000,Math.trunc(n)):fallback;
}
/** Per-user and global daily caps. Override with AI_USER_DAILY_LIMIT and AI_GLOBAL_DAILY_LIMIT. */
export function generationLimits(){
  return {user:dailyLimit("AI_USER_DAILY_LIMIT",30),global:dailyLimit("AI_GLOBAL_DAILY_LIMIT",200)};
}
export async function canGenerate(owner: string) {
  const day = new Date().toISOString().slice(0,10);
  const limits=generationLimits();
  return await takeQuota("ai-user",owner,day,limits.user)
    && await takeQuota("ai-global","all",day,limits.global);
}
