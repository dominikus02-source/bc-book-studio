import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {LETTER_KINDS,makeLetter,letterPdf,letterDocx} from "../../../../../lib/isbn-office";
type C={params:Promise<{kind:string}>};
export async function GET(req:NextRequest,{params}:C){
 const user=await sessionUser(req);if(!user)return deny();if(user.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403});
 const {kind}=await params;if(kind!=="membership_letter")return NextResponse.json({error:"Use application-specific template"},{status:400});
 const ext=req.nextUrl.searchParams.get("format");if(ext!=="pdf"&&ext!=="docx")return NextResponse.json({error:"format is required"},{status:400});
 const publisher=await db.publisherProfile.findUnique({where:{id:"bci-publisher"}});
 // An unsigned blank template must remain downloadable before company onboarding.
 const lines=makeLetter({kind:"membership_letter",publisher:publisher??{legalName:"PT Bahasa Cerdas Indonesia",directorName:"",legalAddress:"",email:"",officialWebsite:""}});
 const bytes=ext==="pdf"?await letterPdf(lines):await letterDocx(lines);
 return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":ext==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="DRAFT-pendaftaran-penerbit-ISBN.'+ext+'"',"Cache-Control":"private, no-store"}});
}
