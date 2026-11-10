import {checkpointsFor} from "./editorial";
import {briefMissing} from "./workflow";
type ReviewBook=Parameters<typeof briefMissing>[0]&{status:string;editorialStage:string;editorialChecks:unknown;chapters:{content:string;outlineObjective:string}[]};
export function reviewSubmissionMissing(book:ReviewBook,reviewerCount:number){
 const missing:string[]=[];
 if(book.status!=="DRAFT")return ["Pengajuan hanya tersedia untuk naskah draf."];
 if(!["WRITING","EDITING"].includes(book.editorialStage))missing.push("Selesaikan Ide dan Rancang sebelum mengajukan review.");
 missing.push(...briefMissing(book));
 if(!book.chapters.length)missing.push("Tambahkan sedikitnya satu bab.");
 if(book.chapters.some(c=>!c.outlineObjective.trim()))missing.push("Lengkapi tujuan setiap bab di Rancang.");
 if(book.chapters.some(c=>c.content.trim().length<20))missing.push("Lengkapi naskah setiap bab (minimal 20 karakter).");
 const checks=(book.editorialChecks||{}) as Record<string,unknown>;
 for(const item of checkpointsFor(book.bookType))if(checks[item.key]!==true)missing.push(item.label);
 if(!reviewerCount)missing.push("Tugaskan sedikitnya satu peninjau independen yang aktif.");
 return missing;
}
