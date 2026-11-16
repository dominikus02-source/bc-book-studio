import {createHash} from "node:crypto";
import {parseMediaImage,richImageRegex,youtubeRegex,type MediaImage} from "./book-media";
import {styleRaster} from "./pure-image";
type Asset={id:string;mime:string;data:string;altText:string};
type Source={chapters:{title:string;content:string}[];assets?:Asset[]};
async function styledAsset(asset:Asset,m:MediaImage,id:string):Promise<Asset>{
 const bytes=styleRaster(asset.mime,Buffer.from(asset.data,"base64"),{radius:m.radius,padding:m.padding});
 return {id,mime:"image/png",data:bytes.toString("base64"),altText:asset.altText};
}
export async function normalizeMediaForExport<T extends Source>(book:T):Promise<T>{
 if(!book.chapters.some(ch=>ch.content.includes("{.bc-media ")||ch.content.includes("{.bc-youtube")))return book;
 const assets=new Map((book.assets??[]).map(a=>[a.id,a]));
 const normalized:Source["chapters"]=[];
 for(const chapter of book.chapters){
  const matches=[...chapter.content.matchAll(richImageRegex)];
  let output="",cursor=0;
  for(const match of matches){
   const m=parseMediaImage(match[0]);if(!m)continue;
   const original=assets.get(m.assetId);if(!original)throw Error("Referenced media image unavailable");
   let id=original.id;
   if(m.padding||m.radius){
    id="styled"+createHash("sha256").update(original.id+":"+m.padding+":"+m.radius).digest("hex").slice(0,22);
    if(!assets.has(id))assets.set(id,await styledAsset(original,m,id));
   }
   const attrs=['width="'+m.width+m.unit+'"',...(m.height?['height="'+m.height+'px"']:[]),'fig-align="'+m.align+'"'].join(" ");
   const image="!["+m.alt+"](asset:"+id+"){"+attrs+"}";
   const fragment=m.href?"["+image+"](<"+m.href+">)":image;
   output+=chapter.content.slice(cursor,match.index)+fragment;cursor=match.index+match[0].length;
  }
  output=(output+chapter.content.slice(cursor)).replace(youtubeRegex,(_m,title,url)=>"[Video: "+title+"]("+url+")");
  normalized.push({...chapter,content:output});
 }
 const used=new Set(normalized.flatMap(ch=>[...ch.content.matchAll(/!\[[^\]\n]*\]\(asset:([a-z0-9]{6,100})\)/g)].map(m=>m[1])));
 const selected=[...assets.values()].filter(a=>used.has(a.id));
 if(selected.length>20)throw Error("Export supports at most 20 different images or styled variants");
 return {...book,chapters:normalized,assets:selected};
}
