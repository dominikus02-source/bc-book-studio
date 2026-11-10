
const fs=require('fs');function edit(p,a,b){const s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error('Anchor '+p);fs.writeFileSync(p,s.replace(a,b))}
const route='app/api/reviewer/route.ts';
edit(route,'export const runtime=', 'import {reviewSubmissionMissing} from "../../../lib/review-readiness";\nexport const runtime=');
edit(route,'reviewNotes:{where:{status:{not:"ARCHIVED"}},orderBy:{createdAt:"desc"}}','reviewNotes:{orderBy:{createdAt:"desc"}},assignedReviewers:{include:{reviewer:{select:{id:true,name:true,active:true,role:true}}}}}');
edit(route,'assignments:books.map(book=>({book:{...book,isOwner:book.ownerId===actor.id,canReview:reviewer&&book.ownerId!==actor.id}}))',
`assignments:books.map(book=>({book:{...book,
 archivedNotes:book.reviewNotes.filter(n=>n.status==="ARCHIVED"),
 reviewNotes:book.reviewNotes.filter(n=>n.status!=="ARCHIVED"),
 reviewSubmissionMissing:reviewSubmissionMissing(book,book.assignedReviewers.filter(a=>a.reviewerId!==book.ownerId&&a.reviewer.active&&["REVIEWER","ADMIN"].includes(a.reviewer.role)).length),
 isOwner:book.ownerId===actor.id,canReview:reviewer&&book.ownerId!==actor.id}}))`);
const notes='app/api/reviewer/notes/[id]/route.ts';
edit(notes,'status:z.enum(["OPEN","RESOLVED"]).optional()','status:z.enum(["OPEN","RESOLVED"]).optional(),restore:z.literal(true).optional()');
edit(notes,'if(!note||note.status==="ARCHIVED")return null;','if(!note)return null;');
edit(notes,'const {expectedVersion,...patch}=p.data;',`if(found.note.status==="ARCHIVED"&&!p.data.restore)return NextResponse.json({error:"Catatan diarsipkan. Pulihkan terlebih dahulu."},{status:409});
 if(p.data.restore&&(found.note.status!=="ARCHIVED"||Object.keys(p.data).some(k=>!["restore","expectedVersion"].includes(k))))return NextResponse.json({error:"Permintaan pemulihan tidak valid."},{status:409});
 const {expectedVersion,restore,...fields}=p.data;
 const patch=restore?{status:"OPEN"}:fields;`);
edit(notes,'decision:"note:update"','decision:p.data.restore?"note:restore":"note:update"');
edit(notes,'if(found.note.updatedAt.toISOString()!==version.data.expectedVersion)', 'if(found.note.status==="ARCHIVED")return NextResponse.json({error:"Catatan telah diarsipkan."},{status:409});\n if(found.note.updatedAt.toISOString()!==version.data.expectedVersion)');
const review='app/api/books/[id]/review/route.ts';
edit(review,'import {briefMissing} from "../../../../../lib/workflow";','import {reviewSubmissionMissing} from "../../../../../lib/review-readiness";');
let s=fs.readFileSync(review,'utf8');const from=s.indexOf('   if(!["WRITING","EDITING"]'),to=s.indexOf('\n  }else{',from);
if(from<0||to<0)throw Error('submit anchor');
s=s.slice(0,from)+`   const chapters=await tx.chapter.findMany({where:{bookId:id,archivedAt:null},select:{content:true,outlineObjective:true}});
   const assignmentCount=await tx.bookReviewer.count({where:{bookId:id,reviewerId:{not:actor.id},reviewer:{active:true,role:{in:["REVIEWER","ADMIN"]}}}});
   const missing=reviewSubmissionMissing({...book,chapters},assignmentCount);
   if(missing.length)return NextResponse.json({error:missing.join(" "),missing},{status:409});`+s.slice(to);s=s.replace('import {checkpointsFor} from "../../../../../lib/editorial";\n','');fs.writeFileSync(review,s);
console.log('Review readiness and restore patched');
