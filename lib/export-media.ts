import {createHash} from "node:crypto";
import {parseMediaImage,richImageRegex,youtubeRegex,type MediaImage} from "./book-media";
type Asset={id:string;mime:string;data:string;altText:string};
type Source={chapters:{title:string;content:string}[];assets?:Asset[]};
async function styledAsset(asset:Asset,m:MediaImage,id:string):Promise<Asset>{
 const {default:sharp}=await import("sharp");
 const input=Buffer.from(asset.data,"base64");if(input.length>550000)throw Error("Image exceeds supported size");
 let image=await sharp(input,{limitInputPixels:10000000}).rotate().resize({width:1200,height:1200,fit:"inside",withoutEnlargement:true}).ensureAlpha().png().toBuffer({resolveWithObject:true});
 const {width,height}=image.info;
 const radius=Math.min(m.radius,Math.floor(Math.min(width,height)/2));
 if(radius){
  const mask=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><rect width="'+width+'" height="'+height+'" rx="'+radius+'" fill="white"/></svg>');
  image=await sharp(image.data).composite([{input:mask,blend:"dest-in"}]).png().toBuffer({resolveWithObject:true});
 }
 if(m.padding)image=await sharp(image.data).extend({top:m.padding,right:m.padding,bottom:m.padding,left:m.padding,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer({resolveWithObject:true});
 for(let i=0;image.data.length>540000&&i<6;i++){
  image=await sharp(image.data).resize({width:Math.round(image.info.width*.8),withoutEnlargement:true}).png({compressionLevel:9}).toBuffer({resolveWithObject:true});
 }
 if(image.data.length>550000)throw Error("Styled image exceeds export size; reduce dimensions");
 return {id,mime:"image/png",data:image.data.toString("base64"),altText:asset.altText};
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
