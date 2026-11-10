export const editorialCheckpoints={
 FICTION:[
 {key:"premise",label:"Premis dan pembaca sasaran terdefinisi"},
 {key:"plot",label:"Alur, tokoh, konflik, dan konsistensi cerita"},
 {key:"language",label:"Penyuntingan bahasa dan sensitivitas"},
 {key:"originality",label:"Orisinalitas dan hak penggunaan karya"},
 {key:"editor",label:"Peninjauan dan persetujuan editor"}
 ],
 NONFICTION:[
 {key:"objectives",label:"Tujuan, sasaran, dan struktur isi"},
 {key:"sources",label:"Fakta, sumber, dan sitasi diverifikasi"},
 {key:"assessment",label:"Contoh, latihan, dan kunci diperiksa"},
 {key:"expert",label:"Telaah ahli dan aksesibilitas konten"},
 {key:"rights",label:"Hak cipta dan persetujuan editor"}
 ]
} as const;
export function checkpointsFor(type:string){return type==="FICTION"?editorialCheckpoints.FICTION:editorialCheckpoints.NONFICTION}
