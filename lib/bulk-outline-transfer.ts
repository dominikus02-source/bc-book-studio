import JSZip from "jszip";
export type BulkRow={chapterTitle:string;subsectionTitle:string;sortOrder:number;content:string;genreTarget:"FANTASY"|"ROMANCE"|"SCI_FI"|"NONFICTION"|"THRILLER";accessTier:"PUBLIC"|"PREMIUM"|"DRAFT"};
export const HEADERS=["No","Judul Bab (Chapter Title)","Nama Subbagian (Subsection Title)","Urutan (Sort Order / Integer)","Konten Dummy","Genre Target","Peran Akses"] as const;
const genreLabels:Record<BulkRow["genreTarget"],string>={FANTASY:"Fantasi",ROMANCE:"Romansa",SCI_FI:"Sci-Fi",NONFICTION:"Non-Fiksi",THRILLER:"Thriller"};
const tiers:Record<BulkRow["accessTier"],string>={PUBLIC:"Public",PREMIUM:"Premium",DRAFT:"Draft"};
const genres=new Map([["fantasi","FANTASY"],["fantasy","FANTASY"],["romansa","ROMANCE"],["romance","ROMANCE"],["sci-fi","SCI_FI"],["scifi","SCI_FI"],["non-fiksi","NONFICTION"],["nonfiksi","NONFICTION"],["non-fiction","NONFICTION"],["thriller","THRILLER"]]);
function xml(s:string){return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function letter(col:number){let value="";for(let n=col;n;n=Math.floor((n-1)/26))value=String.fromCharCode(65+(n-1)%26)+value;return value}
function content(row:BulkRow){return row.content.replace(/\r\n/g,"\n").replace(/\n/g,"\\n")}
function data(rows:BulkRow[]){return [Array.from(HEADERS),...rows.map((r,i)=>[String(i+1),r.chapterTitle,r.subsectionTitle,String(r.sortOrder),content(r),genreLabels[r.genreTarget],tiers[r.accessTier]])]}
export const SAMPLE_BULK_ROWS:BulkRow[]=Array.from({length:25},(_,index)=>{
 const chapter=Math.floor(index/5),number=index%5+1;
 const chapters=["Bab 1: Gerbang Aetheria","Bab 2: Surat Musim Hujan","Bab 3: Koloni Mars 2087","Bab 4: Memahami Ekosistem Indonesia","Bab 5: Misteri Arsip Nomor Tujuh"];
 const sections=[["Peta yang Berubah","Penjaga Hutan","Kunci Kristal","Perjanjian Penyihir","Pintu Seribu Bintang"],["Perpustakaan","Pesan Tertunda","Janji di Halte","Keputusan Dewasa","Surat Terakhir"],["Sinyal Orbit","Laboratorium Oksigen","Robot NORA","Dewan Koloni","Pesan Masa Lalu"],["Biotik dan Abiotik","Rantai Makanan","Keanekaragaman Hayati","Pengamatan Sekolah","Konservasi"],["Ruang Arsip Terkunci","Rekaman Hilang","Saksi Koridor Barat","Dokumen Dua Tanggal","Kebenaran Arsip"]];
 const first=[`Di Aetheria, perjalanan menuju ${sections[chapter][number-1].toLowerCase()} membawa Lira pada petunjuk baru. Ia mengamati keadaan sekitar, membandingkan tanda, lalu mencatat kemungkinan yang belum pasti.`,`Naya dan Arga mendiskusikan ${sections[chapter][number-1].toLowerCase()} dalam suasana yang tenang. Mereka mempertimbangkan pilihan masing-masing tanpa mengabaikan perasaan serta kesempatan yang tersedia.`,`Di koloni Mars, para peneliti menyelidiki ${sections[chapter][number-1].toLowerCase()} dengan metode terukur. Setiap informasi diperiksa sebelum keputusan dibuat agar keselamatan tim tetap terjaga.`,`Pada pembelajaran ekologi, siswa mempelajari ${sections[chapter][number-1].toLowerCase()} melalui pengamatan lingkungan. Mereka membedakan data, pendapat, dan bukti agar kesimpulannya dapat diuji.`,`Dara menyelidiki ${sections[chapter][number-1].toLowerCase()} melalui arsip dan wawancara. Ia tidak menyimpulkan kesalahan seseorang tanpa pemeriksaan silang yang memadai.`][chapter];
 const second=[`"Apakah ini jalan yang benar?" tanya Lira. "Periksa kembali peta dan jejaknya!" jawab rekannya. Mereka melanjutkan perjalanan dengan berhati-hati.`,`"Bagaimana rencanamu?" tanya Naya. Arga menjawab, "Kita bicarakan dengan jujur, ya!" Keduanya sepakat untuk saling menghormati.`,`"Apakah sensor sudah dikalibrasi?" tanya kapten. "Belum, kami akan memeriksanya!" jawab teknisi. Tim menunda eksperimen sampai data dinyatakan valid.`,`"Apakah batu termasuk biotik?" tanya murid. Guru menjawab, "Tidak! Namun, batu dapat menjadi bagian penting habitat." Mereka mencatat penjelasan itu.`,`"Apa bukti pendukungnya?" tanya Dara. "Catatan akses dan waktu kejadian," jawab petugas. Penyelidikan berlanjut tanpa membuat tuduhan prematur.`][chapter];
 return {chapterTitle:chapters[chapter],subsectionTitle:(chapter+1)+"."+number+" "+sections[chapter][number-1],sortOrder:number,content:first+"\n\n"+second,genreTarget:(["FANTASY","ROMANCE","SCI_FI","NONFICTION","THRILLER"] as const)[chapter],accessTier:(["PUBLIC","PREMIUM","DRAFT"] as const)[index%3]};
});
export function markdown(rows:BulkRow[]){return "# BC Book Studio - Bulk Chapter & Subsection\n\n"+HEADERS.join(" | ").replace(/^/,"| ").replace(/$/," |")+"\n| "+HEADERS.map(()=>"---").join(" | ")+" |\n"+data(rows).slice(1).map(r=>"| "+r.map(v=>v.replace(/\|/g,"\\|")).join(" | ")+" |").join("\n")+"\n";}
export async function workbook(rows:BulkRow[]){
 const zip=new JSZip();
 zip.file("[Content_Types].xml",'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
 zip.file("_rels/.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.file("xl/workbook.xml",'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BULK" sheetId="1" r:id="rId1"/></sheets></workbook>');
 zip.file("xl/_rels/workbook.xml.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
 const rowsXml=data(rows).map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>'<c r="'+letter(j+1)+(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>').join("")+'</row>').join("");
 zip.file("xl/worksheets/sheet1.xml",'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>'+rowsXml+'</sheetData><autoFilter ref="A1:G'+(rows.length+1)+'"/></worksheet>');
 return zip.generateAsync({type:"uint8array",compression:"DEFLATE"});
}
function parseValues(row:string[],line:number):BulkRow{
 if(row.length!==7)throw Error("Baris "+line+": harus ada 7 kolom");
 if(!/^\d+$/.test(row[0].trim()))throw Error("Nomor baris bukan bilangan bulat pada "+line);
 const sort=Number(row[3].trim());
 if(!Number.isSafeInteger(sort)||sort<1||sort>1000)throw Error("Urutan harus integer 1-1000 pada baris "+line);
 const g=genres.get(row[5].trim().toLocaleLowerCase("id-ID"));if(!g)throw Error("Genre tidak dikenali pada baris "+line);
 const tier=row[6].trim().toUpperCase();if(!["PUBLIC","PREMIUM","DRAFT"].includes(tier))throw Error("Peran Akses tidak dikenali pada baris "+line);
 return {chapterTitle:row[1].trim(),subsectionTitle:row[2].trim(),sortOrder:sort,content:row[4].replace(/\\n/g,"\n"),genreTarget:g as BulkRow["genreTarget"],accessTier:tier as BulkRow["accessTier"]};
}
export function parseMarkdown(input:string){
 const lines=input.split(/\r?\n/).filter(l=>l.trim().startsWith("|")&&!/^\|[\s:|-]+\|$/.test(l.trim()));
 const entries=lines.map(l=>l.trim().replace(/^\||\|$/g,"").split(/(?<!\\)\|/).map(v=>v.trim().replace(/\\\|/g,"|")));
 if(!entries.length||entries[0].length!==7||entries[0][0]!=="No")throw Error("Header tabel Markdown tidak cocok dengan template");
 if(entries.length>201)throw Error("Maksimum 200 subbagian");
 return entries.slice(1).map((row,i)=>parseValues(row,i+2));
}
export async function parseWorkbook(bytes:Uint8Array){
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const files=Object.values(zip.files).filter(f=>!f.dir);
 if(files.length>40)throw Error("Workbook terlalu kompleks");
 let expanded=0;for(const f of files){if(/vbaProject|externalLinks|embeddings|activeX|oleObject/i.test(f.name))throw Error("Workbook aktif tidak diizinkan");expanded+=Number((f as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize||0);if(expanded>5e6)throw Error("Workbook terlalu besar")}
 const xml=await zip.file("xl/worksheets/sheet1.xml")?.async("string");
 if(!xml||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error("File bukan workbook BULK yang valid");
 const doc=new DOMParser().parseFromString(xml,"application/xml");if(doc.getElementsByTagName("parsererror").length||doc.getElementsByTagNameNS("*","f").length)throw Error("Formula atau XML tidak valid");
 const shared:string[]=[];const sharedFile=zip.file("xl/sharedStrings.xml");
 if(sharedFile){const doc=new DOMParser().parseFromString(await sharedFile.async("string"),"application/xml");for(const si of [...doc.getElementsByTagNameNS("*","si")])shared.push([...si.getElementsByTagNameNS("*","t")].map(t=>t.textContent||"").join(""))}
 const values=new Map<number,string[]>();for(const c of [...doc.getElementsByTagNameNS("*","c")]){const match=/^([A-G])(\d+)$/.exec(c.getAttribute("r")||"");if(!match)continue;const r=Number(match[2]);if(r>201)throw Error("Maksimum 200 subbagian");const col=match[1].charCodeAt(0)-65;const str=c.getAttribute("t")==="inlineStr"?[...c.getElementsByTagNameNS("*","t")].map(e=>e.textContent||"").join(""):c.getElementsByTagNameNS("*","v")[0]?.textContent||"";if(!values.has(r))values.set(r,Array(7).fill(""));values.get(r)![col]=c.getAttribute("t")==="s"?shared[Number(str)]||"":str}
 const header=values.get(1);if(!header||header.length!==7||header[0]!=="No")throw Error("Header sheet BULK tidak cocok");
 return [...values.entries()].filter(([index])=>index>1).sort((a,b)=>a[0]-b[0]).map(([index,row])=>parseValues(row,index));
}
