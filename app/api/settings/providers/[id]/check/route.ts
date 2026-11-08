import {NextRequest,NextResponse} from "next/server";
import {administrator} from "../../../../../../lib/auth";
import {db} from "../../../../../../lib/db";
import {decryptCredential,encryptionReady,providerSchema,providerEndpoints} from "../../../../../../lib/providers";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(!await administrator(req))return NextResponse.json({error:"Akses pengelola diperlukan."},{status:403,headers});
 const {id}=await params,credential=await db.providerCredential.findUnique({where:{id}});
 if(!credential)return NextResponse.json({error:"Konfigurasi tidak ditemukan."},{status:404,headers});
 const supported=providerSchema.safeParse(credential.provider).success;
 let secretReady=false;
 if(encryptionReady()){try{secretReady=decryptCredential(credential.encryptedKey,id).length>=16}catch{}}
 const modelReady=/^[a-zA-Z0-9._:/-]{1,120}$/.test(credential.model);
 const audit=await db.credentialAudit.findFirst({where:{credentialId:id,action:"TEST_OK",createdAt:{gte:credential.updatedAt}},orderBy:{createdAt:"desc"},select:{createdAt:true}});
 const ready=supported&&secretReady&&modelReady;
 return NextResponse.json({id,ready,active:credential.active,liveVerified:Boolean(audit),lastVerifiedAt:audit?.createdAt??null,checks:{encryption:encryptionReady(),credentialDecryptable:secretReady,providerSupported:supported,modelFormat:modelReady,endpointAllowlisted:supported&&Boolean(providerEndpoints[credential.provider as keyof typeof providerEndpoints])},message:ready?(audit?"Konfigurasi siap dan koneksi model pernah diverifikasi setelah perubahan terakhir.":"Konfigurasi lokal siap. Jalankan Tes koneksi untuk memverifikasi akses API."):"Konfigurasi belum siap; periksa provider, model, dan API key.",disclaimer:"Pemeriksaan kesiapan lokal tidak menghubungi provider dan tidak membuktikan saldo/kuota API."},{headers});
}
