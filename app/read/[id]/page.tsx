import {notFound} from "next/navigation";
import {db} from "../../../lib/db";
export const dynamic="force-dynamic";
type Snapshot={title:string;author:string;subject:string;grade:string;description:string;chapters:{title:string;content:string;position:number}[]};
export default async function ReadBook({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^c[a-z0-9]{10,40}$/.test(id))notFound();
 const p=await db.bookPublication.findUnique({where:{bookId:id}});
 if(!p||p.unpublishedAt)notFound();
 const b=p.snapshot as unknown as Snapshot;
 if(!b||!Array.isArray(b.chapters))notFound();
 return <main style={{maxWidth:850,margin:"auto",padding:"clamp(16px,5vw,64px)",lineHeight:1.7,overflowWrap:"anywhere"}}><p>BC Book Studio · Buku diterbitkan · Versi {p.version}</p><h1>{b.title}</h1><p>{b.author} · {b.subject} · Kelas {b.grade}</p><p>{b.description}</p><nav aria-label="Daftar isi"><h2>Daftar isi</h2><ol>{b.chapters.map((c,i)=><li key={i}><a href={"#bab-"+i}>{c.title}</a></li>)}</ol></nav>{b.chapters.map((c,i)=><section id={"bab-"+i} key={i} style={{marginTop:40}}><h2>{c.title}</h2>{c.content.split(/\n\s*\n/).map((paragraph,j)=><p key={j} style={{whiteSpace:"pre-wrap"}}>{paragraph}</p>)}</section>)}</main>;
}
