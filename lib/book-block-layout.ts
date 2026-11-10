export const blockLayoutFields = [
 ["padding","Padding",120], ["margin","Margin",120], ["border","Ketebalan border",16],
 ["radius","Border radius",80], ["shadow","Box shadow",40], ["gap","Gap",80],
] as const;

export type BlockLayout = Partial<Record<typeof blockLayoutFields[number][0],number>>;

export function parseBlockLayout(header:string):BlockLayout|null {
 const match=/^:::\s*\{\.bc-block-layout((?:\s+\.bc-[a-z]+-\d{1,3})+)\}\s*$/.exec(header);
 if(!match)return null;
 const classes=match[1].trim().split(/\s+/);
 const layout:BlockLayout={};
 for(const [key,,max] of blockLayoutFields){
  const value=classes.find(name=>name.startsWith(".bc-"+key+"-"));
  if(value!==undefined)layout[key]=Math.min(max,Number(value.split("-").at(-1)));
 }
 return Object.keys(layout).length?layout:null;
}

export function wrapBlockLayout(raw:string,layout:BlockLayout|undefined){
 const classes=blockLayoutFields.flatMap(([key])=>layout?.[key]===undefined?[]:[".bc-"+key+"-"+layout[key]]);
 return classes.length?"::: {.bc-block-layout "+classes.join(" ")+"}\n\n"+raw.trimEnd()+"\n\n:::":raw;
}

export function blockLayoutStyle(layout:BlockLayout){
 const css:string[]=[];
 const {padding,margin,border,radius,shadow,gap}=layout;
 if(padding!==undefined)css.push("padding:"+padding+"px");
 if(margin!==undefined)css.push("margin:"+margin+"px");
 if(border!==undefined)css.push("border:"+border+"px solid currentColor");
 if(radius!==undefined)css.push("border-radius:"+radius+"px");
 if(shadow!==undefined)css.push("box-shadow:"+(shadow?"0 2px "+shadow+"px rgba(0,0,0,.25)":"none"));
 if(gap!==undefined)css.push("display:grid","gap:"+gap+"px");
 return css.join(";");
}

export const editorialLayouts = {
 chapter: [0,24,0,0,0,6], title: [0,16,0,0,0,4], subtitle: [0,10,0,0,0,4],
 paragraph: [0,8,0,0,0,0], list: [0,10,0,0,0,4], image: [0,12,0,4,0,6],
 video: [0,12,0,6,0,6], table: [0,12,1,4,0,0], quote: [10,10,0,4,0,4],
 exercise: [12,12,1,6,0,6], sidebar: [12,12,1,8,0,6], opener: [16,16,1,8,0,8],
 code: [10,10,1,4,0,0], equation: [0,12,0,0,0,0], footer: [0,8,0,0,0,4],
} as const;

export function editorialBlockLayout(kind:keyof typeof editorialLayouts){
 return Object.fromEntries(blockLayoutFields.map(([key],i)=>[key,editorialLayouts[kind][i]])) as Required<BlockLayout>;
}

export const editorialSpacingCss = `
:is(.writing-preview-paper,.book-page) :where(h1,h2,h3,h4,p,figure,blockquote,pre,table){margin-inline:0}
:is(.writing-preview-paper,.book-page) :where(h1){margin-block:0 24px}
:is(.writing-preview-paper,.book-page) :where(h2){margin-block:16px 8px}
:is(.writing-preview-paper,.book-page) :where(h3,h4){margin-block:10px 6px}
:is(.writing-preview-paper,.book-page) :where(p){margin-block:0 8px}
:is(.writing-preview-paper,.book-page) :where(figure,table){margin-block:12px}
:is(.writing-preview-paper,.book-page) :where(figure img){border-radius:4px}
:is(.writing-preview-paper,.book-page) :where(li+li){margin-block-start:4px}
:is(.writing-preview-paper,.book-page) :where(footer,figcaption){margin-block-start:8px}
.bc-block-layout > :first-child{margin-block-start:0}
.bc-block-layout > :last-child{margin-block-end:0}
`;
