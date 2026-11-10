import { z } from "zod";

const id = z.string().min(1);
const base = z.object({ id });
const heading = base.extend({ type: z.literal("heading"), level: z.union([z.literal(2),z.literal(3),z.literal(4)]), text:z.string() });
const paragraph = base.extend({ type:z.literal("paragraph"), text:z.string() });
const list = base.extend({ type:z.literal("list"), style:z.enum(["ordered","bullet"]), items:z.array(z.string()) });
const example = base.extend({ type:z.literal("example"), text:z.string() });
const exercise = base.extend({ type:z.literal("exercise"), prompt:z.string().min(1), exerciseType:z.enum(["pilihan_ganda","isian","esai"]), options:z.array(z.string()).optional(), answerKey:z.string().min(1), explanation:z.string().optional(), difficulty:z.number().int().min(1).max(3) });
const callout = base.extend({ type:z.literal("callout"), kind:z.enum(["tip","warning","note"]), text:z.string() });
const image = base.extend({ type:z.literal("image"), assetId:z.string().min(1), alt:z.string().trim().min(1), caption:z.string().optional() });
const glossary = base.extend({ type:z.literal("glossary_term"), term:z.string().min(1), definition:z.string().min(1) });
const table = base.extend({ type:z.literal("table"), headers:z.array(z.string()).min(1), rows:z.array(z.array(z.string())) });
export const blockSchema=z.discriminatedUnion("type",[heading,paragraph,list,example,exercise,callout,image,glossary,table]);
export const blocksSchema=z.array(blockSchema).superRefine((blocks,ctx)=>{const seen=new Set<string>();for(const [i,b] of blocks.entries()){if(seen.has(b.id))ctx.addIssue({code:"custom",message:"Duplicate block id",path:[i,"id"]});seen.add(b.id);}});
export type ContentBlock=z.infer<typeof blockSchema>;
export function parseBlocks(value:unknown):ContentBlock[]{return blocksSchema.parse(value);}
export function blocksToPlainText(blocks:ContentBlock[]):string{return blocks.map(b=>{switch(b.type){case "heading":case "paragraph":case "example":case "callout":return b.text;case "list":return b.items.join(" ");case "exercise":return [b.prompt,...(b.options||[]),b.explanation||""].join(" ");case "image":return [b.alt,b.caption||""].join(" ");case "glossary_term":return b.term+" "+b.definition;case "table":return [...b.headers,...b.rows.flat()].join(" ");}}).join("\n");}
export function countWords(blocks:ContentBlock[]):number{return blocksToPlainText(blocks).trim().split(/\s+/u).filter(Boolean).length;}
const escapeHtml=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
export function renderBlocksToHtml(blocks:ContentBlock[]):string{return blocks.map(b=>{switch(b.type){case "heading":return `<h${b.level} id="${escapeHtml(b.id)}">${escapeHtml(b.text)}</h${b.level}>`;case "paragraph":return `<p>${escapeHtml(b.text)}</p>`;case "list":return `<${b.style==="ordered"?"ol":"ul"}>${b.items.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</${b.style==="ordered"?"ol":"ul"}>`;case "example":return `<aside class="example">${escapeHtml(b.text)}</aside>`;case "exercise":return `<section class="exercise"><p>${escapeHtml(b.prompt)}</p>${(b.options||[]).map(x=>`<p>${escapeHtml(x)}</p>`).join("")}</section>`;case "callout":return `<aside class="callout ${b.kind}">${escapeHtml(b.text)}</aside>`;case "image":return `<figure data-asset-id="${escapeHtml(b.assetId)}"><span role="img" aria-label="${escapeHtml(b.alt)}"></span><figcaption>${escapeHtml(b.caption||"")}</figcaption></figure>`;case "glossary_term":return `<dl><dt>${escapeHtml(b.term)}</dt><dd>${escapeHtml(b.definition)}</dd></dl>`;case "table":return `<table><thead><tr>${b.headers.map(x=>`<th scope="col">${escapeHtml(x)}</th>`).join("")}</tr></thead><tbody>${b.rows.map(row=>`<tr>${row.map(x=>`<td>${escapeHtml(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;}}).join("\n");}
