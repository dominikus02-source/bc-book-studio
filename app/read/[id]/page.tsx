import {notFound} from "next/navigation";
import {manuscriptChapterRenderer} from "../../../lib/publishing-html";
import {db} from "../../../lib/db";
import {publishingSequence,type PublishingPackage} from "../../../lib/publishing-package";
export const dynamic="force-dynamic";
type Snapshot={publishingPackage?:PublishingPackage;title:string;author:string;subject:string;grade:string;description:string;assets?:{id:string;mime:string;data:string;altText:string}[];chapters:{title:string;content:string;position:number}[]};
export default async function ReadBook({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^c[a-z0-9]{10,40}$/.test(id))notFound();
 const p=await db.bookPublication.findUnique({where:{bookId:id}});
 if(!p||p.unpublishedAt)notFound();
 const b=p.snapshot as unknown as Snapshot;
 if(!b||!Array.isArray(b.chapters))notFound();
 const parts=b.publishingPackage?publishingSequence(b.publishingPackage,b.chapters):b.chapters;
 const renderChapter=manuscriptChapterRenderer(b.assets??[],false);
 return <main style={{maxWidth:850,margin:"auto",padding:"clamp(16px,5vw,64px)",lineHeight:1.7,overflowWrap:"anywhere"}}><p>BC Book Studio · Buku diterbitkan · Versi {p.version}</p><h1>{b.title}</h1><p>{b.author} · {b.subject} · Kelas {b.grade}</p><p>{b.description}</p><nav aria-label="Daftar isi"><h2>Daftar isi</h2><ol>{parts.map((c,i)=><li key={i}><a href={"#bab-"+i}>{c.title}</a></li>)}</ol></nav>{parts.map((c,i)=><section id={"bab-"+i} key={i} style={{marginTop:40}}><h2>{c.title}</h2><div className="public-book-chapter" dangerouslySetInnerHTML={{__html:renderChapter(c.content)}}/></section>)}</main>;
}
