import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "@/lib/db";
import {sessionUser} from "@/lib/auth";
import {takeQuota} from "@/lib/usage";
import {createOneTimeToken,hashToken,sendAccountEmail} from "@/lib/account";
import {activationEmailAllowed} from "@/lib/account-email";
export const runtime="nodejs";
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
const input=z.object({id:z.string().min(1).max(128),action:z.enum(["reset","activate"])}).strict();
export async function POST(req:NextRequest){
 const actor=await sessionUser(req);
 if(actor?.role!=="SUPERADMIN")return reply({error:"Forbidden"},403);
 const origin=req.headers.get("origin");
 const expectedOrigin=new URL(process.env.APP_ORIGIN||req.nextUrl.origin).origin;
 if(origin&&origin!==expectedOrigin)return reply({error:"Forbidden origin"},403);
 const parsed=input.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:"Pilih pengguna dan tindakan pemulihan yang valid."},400);
 const target=await db.studioUser.findUnique({where:{id:parsed.data.id}});
 if(!target)return reply({error:"Pengguna tidak ditemukan."},404);
 const purpose=parsed.data.action;
 if(purpose==="activate"&&!activationEmailAllowed(target.email))return reply({error:"Alamat ini dikecualikan dari email aktivasi."},409);
 if(purpose==="reset"&&!target.active)return reply({error:"Akun nonaktif tidak dapat menerima reset password. Aktifkan akun atau kirim ulang aktivasi."},409);
 if(purpose==="activate"&&target.active)return reply({error:"Akun sudah aktif. Gunakan reset password."},409);
 const cutoff=new Date(Date.now()-60_000);
 const recent=await db.studioAuthToken.findFirst({where:{userId:target.id,purpose,usedAt:null,createdAt:{gt:cutoff}},select:{id:true}});
 if(recent||!await takeQuota("admin-account-recovery",target.id+":"+purpose,String(Math.floor(Date.now()/60000)),1))return reply({error:"Tunggu satu menit sebelum mengirim ulang."},429);
 let token:string|undefined;
 try{
  const base=new URL(process.env.APP_ORIGIN||"https://bcbookstudio.bahasacerdas.com");
  if(base.protocol!=="https:"&&base.hostname!=="localhost"&&base.hostname!=="127.0.0.1")throw Error("Invalid application origin");
  token=await createOneTimeToken(target.id,purpose);
  await sendAccountEmail(target.email,target.name,base.origin+"/"+(purpose==="reset"?"reset-password":"activate")+"?token="+encodeURIComponent(token),purpose);
  return reply({message:purpose==="reset"?"Tautan reset password dikirim. Berlaku 30 menit dan sekali pakai.":"Undangan aktivasi dikirim ulang. Berlaku 30 menit."});
 }catch{
  if(token)await db.studioAuthToken.deleteMany({where:{userId:target.id,tokenHash:hashToken(token)}});
  return reply({error:"Email belum terkirim. Periksa konfigurasi SMTP lalu coba kembali. Password pengguna tidak diubah."},503);
 }
}
