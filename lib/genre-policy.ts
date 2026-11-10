/**
 * Genre-sensitive writing guidance and mandatory brief metadata.
 * This module does not issue, reserve, or validate official ISBN allocation.
 * ISBN eligibility and Perpusnas dossier require authorized human review.
 */
export const GENRE_GUIDE={
 NOVEL:{name:"Novel",type:"FICTION",outline:"Tentukan alur, tokoh, konflik, klimaks, dan kesinambungan antarbagian.",proof:"Jaga konsistensi tokoh, kronologi, orisinalitas dan izin."},
 SHORT_STORY:{name:"Cerita pendek",type:"FICTION",outline:"Tentukan tema, tokoh, konflik, dan resolusi tiap cerita.",proof:"Periksa orisinalitas, penyuntingan bahasa dan hak terbit."},
 ANTHOLOGY:{name:"Antologi",type:"FICTION",outline:"Susun karya menurut tema; catat penulis dan izin setiap kontribusi.",proof:"Kelayakan ISBN tergantung sifat penerbitan; pastikan izin seluruh kontributor."},
 POETRY:{name:"Puisi",type:"FICTION",outline:"Tentukan tema, urutan puisi, gaya dan keutuhan baris/larik.",proof:"Periksa hak penggunaan serta reproduksi tata letak dan larik."},
 TEXTBOOK:{name:"Buku ajar",type:"NONFICTION",outline:"Sejajarkan bab dengan capaian, tujuan belajar, latihan dan asesmen.",proof:"Fakta, kurikulum, kunci jawaban dan sumber wajib diperiksa."},
 REFERENCE:{name:"Referensi",type:"NONFICTION",outline:"Susun gagasan berdasarkan ruang lingkup, rujukan dan keterkaitan topik.",proof:"Verifikasi sumber, kutipan, daftar pustaka dan indeks."},
 GUIDE:{name:"Panduan",type:"NONFICTION",outline:"Urutkan prosedur, prasyarat, langkah, contoh dan pemeriksaan hasil.",proof:"Pastikan instruksi dapat diikuti, aman dan akurat."},
 WORKBOOK:{name:"Buku latihan",type:"NONFICTION",outline:"Susun kompetensi, latihan bertingkat, asesmen dan pembahasan.",proof:"Uji soal dan jawaban; kelayakan ISBN harus dinilai berdasarkan tujuan distribusi."},
} as const;
export function genreGuide(genre:string){
 return GENRE_GUIDE[genre as keyof typeof GENRE_GUIDE]??null;
}
export function briefGenreIssues(book:{bookType:string;genre:string;author:string;pageSize:string}){
 const errors:string[]=[];
 const info=genreGuide(book.genre);
 if(!info)errors.push("Pilih genre yang didukung.");
 else if(info.type!==book.bookType)errors.push("Jenis buku dan genre tidak sesuai.");
 if(book.author.trim().length<2)errors.push("Identitas penulis minimal 2 karakter.");
 if(!["A4","A5","B5"].includes(book.pageSize))errors.push("Pilih format halaman cetak yang didukung.");
 return errors;
}
