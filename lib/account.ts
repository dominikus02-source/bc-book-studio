import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import { db } from "./db";
import { accountEmail, activationEmailAllowed } from "./account-email";

export const hashToken = (token:string) => createHash("sha256").update(token).digest("hex");
export const randomToken = () => randomBytes(32).toString("hex");
export const passwordHash = (password:string) => {
 const salt=randomBytes(16).toString("hex");
 return salt+":"+scryptSync(password,salt,64).toString("hex");
};
export const checkPassword = (password:string,stored:string) => {
 const [salt,hash]=stored.split(":");
 if(!salt||!hash||hash.length!==128)return false;
 const expected=Buffer.from(hash,"hex");
 const got=scryptSync(password,salt,64);
 return timingSafeEqual(expected,got);
};
export async function createOneTimeToken(userId:string,purpose:"activate"|"reset") {
 const token=randomToken();
 await db.$transaction([
  db.studioAuthToken.deleteMany({where:{userId,purpose}}),
  db.studioAuthToken.create({data:{userId,purpose,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+30*60*1000)}})
 ]);
 return token;
}
const redactLog=(s:string)=>s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,"[REDACTED_EMAIL]");
const formatFrom=(from:string)=>{
 if(/</.test(from))return from;
 const name=(process.env.SMTP_FROM_NAME||"BC Book Studio").trim().replace(/[\r\n"<>]/g,"").slice(0,70)||"BC Book Studio";
 return `${name} <${from}>`;
};
export async function sendAccountEmail(to:string,name:string,link:string,type:"activate"|"reset"){
 if(type==="activate"&&!activationEmailAllowed(to))return;
 const {SMTP_USER,SMTP_APP_PASSWORD,SMTP_FROM}=process.env;
 if(!SMTP_USER||!SMTP_APP_PASSWORD||!SMTP_FROM)throw new Error("SMTP is not configured");
 const configuredHost=process.env.SMTP_HOST||"smtp.gmail.com";
 let connectHost=configuredHost;
 // Prefer getaddrinfo so Docker extra_hosts /etc/hosts wins over nodemailer 10's resolve4/6.
 if(!isIP(configuredHost)){
  try{const looked=await dnsLookup(configuredHost,{verbatim:true}); if(looked?.address)connectHost=looked.address;}catch{ /* use hostname */ }
 }
 const tlsServername=(process.env.SMTP_TLS_SERVERNAME||"").trim()||(!isIP(configuredHost)?configuredHost:"");
 const transport=nodemailer.createTransport({
  host:connectHost,
  port:Number(process.env.SMTP_PORT||465),
  secure:(process.env.SMTP_SECURE||"true")==="true",
  requireTLS:configuredHost==="smtp.gmail.com" && (process.env.SMTP_SECURE||"true")!=="true",
  auth:{user:SMTP_USER,pass:SMTP_APP_PASSWORD},
  connectionTimeout:15_000,
  greetingTimeout:15_000,
  socketTimeout:30_000,
  ...(tlsServername?{tls:{servername:tlsServername}}:{})
 });
 const started=Date.now();
 const replyTo=(process.env.SMTP_REPLY_TO||"").trim();
 try{
  const info=await transport.sendMail({
   from:formatFrom(SMTP_FROM),
   to,
   ...accountEmail(name,link,type),
   ...(replyTo?{replyTo}:{})
  });
  const smtp=typeof info?.response==="string"?redactLog(info.response).slice(0,160):"";
  console.info("Account email delivered","id="+(info?.messageId||"none"),"ms="+(Date.now()-started),"smtp="+smtp);
 }catch(e){
  console.error("Account email delivery failed",e instanceof Error?redactLog(e.message):"unknown","ms="+(Date.now()-started));
  throw e;
 }finally{
  transport.close();
 }
}
