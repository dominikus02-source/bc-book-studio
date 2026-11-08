import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../../../lib/db";
import {sessionUser,deny} from "../../../../../../../lib/auth";
import {LETTER_KINDS,makeLetter,letterPdf,letterDocx} from "../../../../../../../lib/isbn-office";
export const runtime="nodejs";
type C={params:Promise<{applicationId:string;kind:string}>};
export async function GET(req:NextRequest,{params}:C){
 const user=await sessionUser(req);if(!user)return deny();if(user.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403});
 const {applicationId,kind}=await params; if(!LETTER_KINDS.some(x=>x===kind))return NextResponse.json({error:"Unknown letter template"},{status:404});
 const ext=req.nextUrl.searchParams.get("format");if(ext!=="docx"&&ext!=="pdf")return NextResponse.json({error:"format=docx or pdf"},{status:400});
 const [app,publisher]=await Promise.all([db.isbnApplication.findFirst({where:{id:applicationId,archivedAt:null}}),db.publisherProfile.findUnique({where:{id:"bci-publisher"}})]);
 if(!app||!publisher)return NextResponse.json({error:"Application or publisher missing"},{status:404});
 const text=makeLetter({kind:kind as typeof LETTER_KINDS[number],publisher,application:app});
 const bytes=ext==="pdf"?await letterPdf(text):await letterDocx(text);
 return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":ext==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="DRAFT-'+kind+'-'+applicationId+'.'+ext+'"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
