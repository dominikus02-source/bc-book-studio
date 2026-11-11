import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { db } from "./db";
import {accountEmail, activationEmailAllowed, type AccountEmailPurpose} from "./account-email";

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
export async function sendAccountEmail(to: string, name: string, link: string, type: AccountEmailPurpose) {
 if (type === "activate" && !activationEmailAllowed(to)) return;
 const {SMTP_USER, SMTP_APP_PASSWORD, SMTP_FROM} = process.env;
 if (!SMTP_USER || !SMTP_APP_PASSWORD || !SMTP_FROM) throw new Error("SMTP is not configured");
 const host = process.env.SMTP_HOST || "smtp.gmail.com";
 const secure = (process.env.SMTP_SECURE || "true") === "true";
 const transport = nodemailer.createTransport({
  host,
  port: Number(process.env.SMTP_PORT || 465),
  secure,
  requireTLS: host === "smtp.gmail.com" && !secure,
  auth: {user: SMTP_USER, pass: SMTP_APP_PASSWORD},
 });
 await transport.sendMail({from: {name: "BC Book Studio", address: SMTP_FROM}, to, ...accountEmail(name, link, type)});
}
