export type PaperSpec={id:string;label:string;widthMm:number;heightMm:number;typst?:string};
export const paperSizes=[
{id:"a3",label:"ISO A3",widthMm:297,heightMm:420,typst:"a3"},
{id:"a4",label:"ISO A4",widthMm:210,heightMm:297,typst:"a4"},
{id:"a5",label:"ISO A5",widthMm:148,heightMm:210,typst:"a5"},
{id:"a6",label:"ISO A6",widthMm:105,heightMm:148,typst:"a6"},
{id:"b4",label:"ISO B4",widthMm:250,heightMm:353,typst:"iso-b4"},
{id:"b5",label:"ISO B5",widthMm:176,heightMm:250,typst:"iso-b5"},
{id:"b6",label:"ISO B6",widthMm:125,heightMm:176,typst:"iso-b6"},
{id:"jis-b5",label:"JIS B5",widthMm:182,heightMm:257,typst:"jis-b5"},
{id:"letter",label:"US Letter",widthMm:215.9,heightMm:279.4,typst:"us-letter"},
{id:"legal",label:"US Legal",widthMm:215.9,heightMm:355.6,typst:"us-legal"},
{id:"trade-6x9",label:"Trade 6 x 9 in",widthMm:152.4,heightMm:228.6},
{id:"id-14x21",label:"Buku 14 x 21 cm",widthMm:140,heightMm:210},
{id:"id-15x23",label:"Buku 15 x 23 cm",widthMm:150,heightMm:230},
] as const satisfies readonly PaperSpec[];
export type PaperId=(typeof paperSizes)[number]["id"];
export function paperSpec(id:string|null|undefined):PaperSpec|undefined{
 return paperSizes.find(p=>p.id===(id||"").toLowerCase());
}
export const mmToTwips=(mm:number)=>Math.round(mm*1440/25.4);
export const mmToPt=(mm:number)=>mm*72/25.4;
