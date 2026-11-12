import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import { db } from "./db";

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
// One well-formed hash so a missing, inactive, or passwordless account still pays the scrypt cost.
const loginTimingHash = passwordHash("bc-book-studio-login-timing-pad");
export const ACCOUNT_RECOVERY_MESSAGE = "Jika alamat email terdaftar, instruksi akan dikirim.";
/** Delivery failure must not change the public reply. Registration stays undisclosed. */
export function accountRecoveryResult(_deliveryFailed = false) {
 return { status: 200 as const, body: { message: ACCOUNT_RECOVERY_MESSAGE } };
}
export function smtpConfigured() {
 const { SMTP_USER, SMTP_APP_PASSWORD, SMTP_FROM } = process.env;
 return Boolean(SMTP_USER && SMTP_APP_PASSWORD && SMTP_FROM);
}
export function loginPasswordAccepted(user: { active: boolean; passwordHash: string | null } | null, password: string) {
 const stored = user?.active && user.passwordHash ? user.passwordHash : loginTimingHash;
 const matches = checkPassword(password, stored);
 return Boolean(user?.active && user.passwordHash && matches);
}
export async function createOneTimeToken(userId:string,purpose:"activate"|"reset") {
 const token=randomToken();
 await db.$transaction([
  db.studioAuthToken.deleteMany({where:{userId,purpose}}),
  db.studioAuthToken.create({data:{userId,purpose,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+30*60*1000)}})
 ]);
 return token;
}
const safe=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
export function emailHTML(name:string,link:string,type:"activate"|"reset"){
 const isActivate=type==="activate";
 const title=isActivate?"Aktifkan ruang kreativitasmu":"Atur ulang kata sandimu";
 const intro=isActivate?"Undangan untuk berkarya telah tiba. Aktivasi akun BC Book Studio untuk mulai menyusun, mengembangkan, dan menerbitkan ide menjadi buku yang bermakna.":"Kami menerima permintaan pengaturan ulang kata sandi akun BC Book Studio. Gunakan tombol berikut untuk membuat kata sandi baru dengan aman.";
 const action=isActivate?"Aktifkan Akun":"Atur Ulang Kata Sandi";
 return `<!doctype html><html lang="id"><head><meta charset="UTF-8"></head><body style="margin:0;padding:36px 12px;background:#f1f5fb;font-family:Arial,sans-serif;color:#192547"><table role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;margin:auto;background:#fff;border-radius:20px;overflow:hidden"><tr><td style="background:#172b70;padding:30px 36px;color:#fff"><div style="font-size:13px;letter-spacing:3px;font-weight:bold;color:#c6d7ff">BAHASA CERDAS</div><div style="font-size:28px;font-weight:bold;margin-top:8px">Book Studio <span style="color:#f7cc79">✦</span></div><div style="font-size:13px;margin-top:8px;color:#d3dfff">Dari inspirasi menjadi karya.</div></td></tr><tr><td style="padding:38px 36px"><div style="font-size:13px;font-weight:bold;color:#5a66cc;text-transform:uppercase;letter-spacing:2px">Akun & keamanan</div><h1 style="font-size:28px;line-height:1.25;margin:14px 0 20px;color:#182659">${title}</h1><p style="font-size:16px;line-height:1.7">Halo, <b>${safe(name)}</b>!</p><p style="font-size:16px;line-height:1.8;color:#455171">${intro}</p><div style="margin:34px 0"><a href="${safe(link)}" style="display:inline-block;background:#364ad4;color:white;text-decoration:none;border-radius:12px;padding:16px 28px;font-weight:bold;font-size:15px">${action} →</a></div><p style="font-size:13px;line-height:1.7;color:#68738c">Tautan ini hanya berlaku selama <b>30 menit</b> dan dapat digunakan satu kali. Jika kamu tidak meminta email ini, abaikan saja. Jangan pernah membagikan tautan kepada siapa pun.</p><p style="font-size:12px;line-height:1.7;overflow-wrap:anywhere;color:#68738c">Jika tombol tidak berfungsi, salin tautan berikut ke browser:<br><a href="${safe(link)}" style="color:#364ad4">${safe(link)}</a></p></td></tr><tr><td style="padding:22px 36px;background:#f8faff;border-top:1px solid #e9edf6;color:#8490a8;font-size:12px">© BC Book Studio · Bagian dari Bahasa Cerdas<br>Pesan otomatis — mohon tidak membalas email ini.</td></tr></table></body></html>`;
}

const redactLog=(s:string)=>s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,"[REDACTED_EMAIL]");
const formatFrom=(from:string)=>{
 if(/</.test(from))return from;
 const name=(process.env.SMTP_FROM_NAME||"BC Book Studio").trim().replace(/[\r\n"<>]/g,"").slice(0,70)||"BC Book Studio";
 return `${name} <${from}>`;
};
export function emailText(name:string,link:string,type:"activate"|"reset"){
 const isActivate=type==="activate";
 const intro=isActivate
  ?"Undangan untuk berkarya telah tiba. Aktifkan akunmu untuk mulai menyusun dan menerbitkan buku."
  :"Kami menerima permintaan pengaturan ulang kata sandi akun BC Book Studio.";
 const action=isActivate
  ?"Buka tautan berikut untuk mengaktifkan akun (berlaku 30 menit, sekali pakai):"
  :"Buka tautan berikut untuk membuat kata sandi baru (berlaku 30 menit, sekali pakai):";
 return [`Halo, ${name}!`,"",intro,"",action,link,"","Jika kamu tidak meminta email ini, abaikan saja. Jangan bagikan tautan ini kepada siapa pun.","","— BC Book Studio · Bagian dari Bahasa Cerdas","Pesan otomatis, mohon tidak membalas email ini."].join("\n");
};
export async function sendAccountEmail(to:string,name:string,link:string,type:"activate"|"reset"){
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
   subject:type==="activate"?"Aktivasi akun | BC Book Studio":"Pulihkan kata sandi | BC Book Studio",
   text:emailText(name,link,type),
   html:emailHTML(name,link,type),
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
