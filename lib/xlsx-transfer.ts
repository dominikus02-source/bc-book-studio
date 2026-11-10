import JSZip from "jszip";
type Field={key:string;label:string;hint?:string;type?:"text"|"boolean"};
const NS="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKGREL="http://schemas.openxmlformats.org/package/2006/relationships";
const text=(v:string)=>v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
function cell(ref:string,value:string,style=0){
 return '<c r="'+ref+'" t="inlineStr"'+(style?' s="'+style+'"':'')+'><is><t xml:space="preserve">'+text(value)+'</t></is></c>';
}
function worksheet(rows:string[][],widths:number[]){
 const lines=rows.map((row,i)=>'<row r="'+(i+1)+'"'+(i===0?' ht="27" customHeight="1"':'')+'>'+row.map((v,j)=>cell(String.fromCharCode(65+j)+(i+1),v,i===0?1:0)).join("")+'</row>').join("");
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<worksheet xmlns="'+NS+'"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
 '<sheetFormatPr defaultRowHeight="17"/><cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join("")+'</cols><sheetData>'+lines+'</sheetData><autoFilter ref="A1:'+String.fromCharCode(64+widths.length)+rows.length+'"/></worksheet>';
}
export async function makeFormWorkbook(fields:readonly Field[],values:Record<string,string|boolean>,context=""):Promise<Uint8Array>{
 const zip=new JSZip();
 zip.file("[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8"?>'+
 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
 '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
 '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
 '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
 '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
 zip.file("_rels/.rels",'<?xml version="1.0" encoding="UTF-8"?>'+
 '<Relationships xmlns="'+PKGREL+'"><Relationship Id="rId1" Type="'+REL+'/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.file("xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8"?>'+
 '<workbook xmlns="'+NS+'" xmlns:r="'+REL+'"><sheets><sheet name="FORM" sheetId="1" r:id="rId1"/><sheet name="PANDUAN" sheetId="2" r:id="rId2"/></sheets></workbook>');
 zip.file("xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8"?>'+
 '<Relationships xmlns="'+PKGREL+'"><Relationship Id="rId1" Type="'+REL+'/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="'+REL+'/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="'+REL+'/styles" Target="styles.xml"/></Relationships>');
 zip.file("xl/styles.xml",'<?xml version="1.0" encoding="UTF-8"?>'+
 '<styleSheet xmlns="'+NS+'"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>'+
 '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF23375A"/><bgColor indexed="64"/></patternFill></fill></fills>'+
 '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
 '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
 '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>');
 const rows=[["field_id","Nama isian","Nilai (edit kolom ini)","Petunjuk"],...fields.map(f=>[f.key,f.label,f.type==="boolean"?(values[f.key]===true?"Ya":"Tidak"):String(values[f.key]??""),f.hint||""])];
 zip.file("xl/worksheets/sheet1.xml",worksheet(rows,[30,37,62,62]));
 zip.file("xl/worksheets/sheet2.xml",worksheet([["BC BOOK STUDIO | PANDUAN IMPOR XLSX"],["Edit hanya kolom C pada sheet FORM."],["Jangan ubah field_id pada kolom A; jangan menambah rumus atau hyperlink."],["File hanya dibaca di memori browser. Tidak dikirim ke server."],["Periksa pratinjau sebelum klik Terapkan ke form dan Simpan."],["Maksimal 1 MB; jangan masukkan password, token, atau API key."],...(context?[["KONTEKS PROYEK DAN PROMPT AI — salin bersama FORM ke AI."],...context.split("\n").map(line=>[line])]:[])],[109]));
 return zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:5}});
}
function parseXml(input:string){
 if(/<!DOCTYPE|<!ENTITY/i.test(input))throw Error("XML dengan deklarasi entitas tidak diizinkan.");
 const document=new DOMParser().parseFromString(input,"application/xml");
 if(document.getElementsByTagName("parsererror").length)throw Error("Struktur XML Excel rusak.");
 return document;
}
function all(element:Element|Document,local:string){return [...element.getElementsByTagNameNS("*",local)];}
function first(element:Element|Document,local:string){return all(element,local)[0];}
export async function parseFormWorkbook(bytes:Uint8Array,maxRows:number):Promise<Record<string,string>>{
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const entries=Object.values(zip.files).filter(f=>!f.dir);
 if(entries.length>40)throw Error("Terlalu banyak bagian dalam workbook.");
 let size=0;
 for(const e of entries){
  if(/vbaProject|externalLinks|embeddings|activeX|oleObject/i.test(e.name))throw Error("Workbook aktif/memiliki tautan eksternal tidak didukung.");
  const len=(e as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;
  size+=Number(len??0);
  if(size>3*1024*1024)throw Error("Workbook mengembang terlalu besar.");
 }
 const wbPath=zip.file("xl/workbook.xml"),relPath=zip.file("xl/_rels/workbook.xml.rels");
 if(!wbPath||!relPath)throw Error("Struktur workbook tidak lengkap.");
 const wb=parseXml(await wbPath.async("string"));
 const sheet=all(wb,"sheet").find(e=>e.getAttribute("name")==="FORM");
 if(!sheet)throw Error("Sheet FORM tidak ditemukan.");
 const relationId=sheet.getAttributeNS(REL,"id")||sheet.getAttribute("r:id");
 const rels=parseXml(await relPath.async("string"));
 const relation=all(rels,"Relationship").find(e=>e.getAttribute("Id")===relationId);
 if(!relation||relation.getAttribute("TargetMode")==="External")throw Error("Relasi sheet tidak valid.");
 const target=relation.getAttribute("Target")||"";
 const location=target.startsWith("/xl/")?target.slice(1):"xl/"+target.replace(/^\//,"");
 if(!/^xl\/worksheets\/sheet[\w-]+\.xml$/.test(location))throw Error("Lokasi sheet tidak valid.");
 const file=zip.file(location);if(!file)throw Error("Sheet tidak tersedia.");
 const xml=parseXml(await file.async("string"));
 if(all(xml,"f").length)throw Error("Formula Excel tidak diizinkan dalam file impor.");
 const strings:string[]=[];
 if(zip.file("xl/sharedStrings.xml")){
  const ss=parseXml(await zip.file("xl/sharedStrings.xml")!.async("string"));
  for(const si of all(ss,"si"))strings.push(all(si,"t").map(x=>x.textContent||"").join(""));
 }
 const cells=new Map<string,string>();
 for(const c of all(xml,"c")){
  const ref=c.getAttribute("r")||"";
  const match=/^([A-Z]+)(\d+)$/.exec(ref);
  if(!match)continue;
  const row=Number(match[2]);
  if(row>maxRows+3)throw Error("Jumlah baris melebihi batas template.");
  const t=c.getAttribute("t");
  const value=t==="inlineStr"?all(c,"t").map(x=>x.textContent||"").join(""):(first(c,"v")?.textContent||"");
  if(t==="e")throw Error("Nilai sel Excel mengalami kesalahan.");
  cells.set(ref,t==="s"?strings[Number(value)]||"":value);
 }
 if(cells.get("A1")!=="field_id")throw Error("Header field_id tidak sesuai.");
 const result:Record<string,string>=Object.create(null);
 for(let row=2;row<=maxRows+2;row++){
  const key=(cells.get("A"+row)||"").trim();if(!key)continue;
  if(Object.hasOwn(result,key))throw Error("field_id ganda: "+key);
  result[key]=cells.get("C"+row)||"";
 }
 return result;
}
