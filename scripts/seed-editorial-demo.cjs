#!/usr/bin/env node
/**
 * Explicit, repeatable editorial demo seed. Never invoked by migrations or app startup.
 * Usage: BC_DEMO_SEED_CONFIRM=YES BC_DEMO_OWNER_EMAIL=... node scripts/seed-editorial-demo.cjs
 * Requires DATABASE_URL and an existing active account; never alters accounts, roles or passwords.
 */
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const prefix = 'bc-demo-editorial-20261111';
const specimens = [
  {
    code:'indonesia-7', title:'[DEMO] Bahasa Indonesia VII — Teks Deskripsi',grade:'VII',subject:'Bahasa Indonesia',genre:'TEXTBOOK',pageSize:'A5',
    audience:'Peserta didik SMP kelas VII',goal:'Mengamati, menganalisis, menulis, dan merevisi teks deskripsi.',
    chapters:[
      {title:'Mengamati dan Mengenali Teks Deskripsi',objective:'Mengidentifikasi objek, detail pancaindra, dan struktur deskripsi.',sections:['Pengertian dan tujuan','Identifikasi dan deskripsi bagian','Diksi dan pancaindra'],body:`# Mengamati dan Mengenali Teks Deskripsi

## Tujuan Pembelajaran
Peserta didik dapat membedakan identifikasi dan deskripsi bagian, serta menemukan detail pancaindra.

## Pemantik
Amati perpustakaan sekolah. Apa yang kamu lihat, dengar, dan rasakan?

## Materi
Teks deskripsi melukiskan suatu objek secara rinci agar pembaca membayangkan objek tersebut. Struktur umum mencakup identifikasi dan deskripsi bagian.

## Contoh
Perpustakaan itu terang dan tenang. Rak kayu tersusun sejajar. Di dekat jendela, meja baca menghadap taman hijau.

## Aktivitas
Tuliskan lima detail berdasarkan pengamatan langsung. Bedakan fakta dan pendapat.

## Latihan
1. Tentukan kalimat identifikasi pada contoh.
2. Sebutkan tiga kata yang menggambarkan suasana.
3. Jelaskan mengapa detail spesifik penting.

## Kunci dan Pembahasan
1. Kalimat pertama mengenalkan objek dan suasananya.
2. Contoh: terang, tenang, hijau.
3. Detail membantu pembaca membangun gambaran yang lebih jelas.

## Refleksi
Detail apa yang perlu diperbaiki agar tulisanmu lebih akurat?`},
      {title:'Menulis dan Menyunting Teks Deskripsi',objective:'Menghasilkan teks deskripsi dengan struktur dan ejaan yang tepat.',sections:['Menyusun kerangka','Mengembangkan paragraf','Menyunting dan memberi umpan balik'],body:`# Menulis dan Menyunting Teks Deskripsi

## Tujuan
Menyusun paragraf identifikasi, mengembangkan deskripsi bagian, lalu menyunting tulisan.

## Langkah
1. Pilih objek nyata.
2. Buat tabel pengamatan.
3. Susun kerangka.
4. Tulis dua sampai tiga paragraf.
5. Periksa tanda baca, ejaan, dan keterpaduan.

## Proyek
Tulis deskripsi 200–300 kata tentang ruang belajar. Mintalah teman memberikan umpan balik.

## Rubrik
Ketepatan isi 40%, organisasi 30%, kebahasaan 20%, mekanik 10%.

## Refleksi
Apa perubahan paling penting setelah revisi?`}
    ]
  },
  {
    code:'ipa-8',title:'[DEMO] IPA VIII — Sistem Pernapasan Manusia',grade:'VIII',subject:'Ilmu Pengetahuan Alam',genre:'TEXTBOOK',pageSize:'A4',
    audience:'Peserta didik SMP kelas VIII',goal:'Menjelaskan organ pernapasan, mekanisme ventilasi, dan menjaga kesehatan.',
    chapters:[
      {title:'Organ dan Jalur Pernapasan',objective:'Menjelaskan fungsi hidung, trakea, bronkus, dan alveolus.',sections:['Jalur udara','Pertukaran gas','Kesehatan pernapasan'],body:`# Organ dan Jalur Pernapasan

## Tujuan Pembelajaran
Mengidentifikasi jalur udara dan menjelaskan pertukaran gas.

## Materi
Udara masuk melalui hidung, faring, laring, trakea, bronkus, bronkiolus, hingga alveolus. Di alveolus, oksigen berdifusi menuju darah dan karbon dioksida bergerak ke udara alveolus.

## Diagram Konseptual
Hidung → Trakea → Bronkus → Bronkiolus → Alveolus

## Aktivitas
Gambarlah diagram berlabel. Jelaskan fungsi setiap organ.

## Latihan
1. Mengapa alveolus berdinding tipis?
2. Apa fungsi rambut hidung dan lendir?

## Pembahasan
1. Dinding tipis memudahkan difusi gas.
2. Membantu menyaring partikel dan menjaga kelembapan udara.

## Refleksi
Bagaimana polusi udara memengaruhi kesehatan pernapasan?`},
      {title:'Mekanisme Inspirasi dan Ekspirasi',objective:'Menghubungkan perubahan volume rongga dada dan tekanan udara.',sections:['Peran diafragma','Frekuensi napas','Analisis data'],body:`# Mekanisme Inspirasi dan Ekspirasi

## Materi
Saat inspirasi, diafragma berkontraksi dan volume rongga dada meningkat sehingga tekanan udara di paru menurun. Saat ekspirasi tenang, diafragma relaksasi dan udara keluar.

## Praktikum Aman
Hitung napas selama 60 detik saat duduk dan setelah berjalan ringan. Jangan memaksakan aktivitas jika merasa tidak nyaman.

| Kondisi | Napas per menit |
|---|---:|
| Istirahat (contoh fiktif) | 16 |
| Setelah berjalan (contoh fiktif) | 24 |

## Latihan
Jelaskan hubungan volume rongga dada dan tekanan udara.

## Pembahasan
Peningkatan volume berkaitan dengan penurunan tekanan relatif yang mendorong udara masuk.

## Refleksi
Mengapa hasil pengukuran antarsiswa dapat berbeda?`}
    ]
  },
  {
    code:'matematika-10',title:'[DEMO] Matematika X — Fungsi Kuadrat',grade:'X',subject:'Matematika',genre:'TEXTBOOK',pageSize:'A5',
    audience:'Peserta didik SMA kelas X',goal:'Menentukan akar, titik puncak, dan memodelkan situasi dengan fungsi kuadrat.',
    chapters:[
      {title:'Bentuk Umum dan Grafik Parabola',objective:'Menentukan arah buka parabola dan titik potong sumbu.',sections:['Bentuk umum','Akar dan diskriminan','Grafik'],body:String.raw`# Bentuk Umum dan Grafik Parabola

## Tujuan Pembelajaran
Mengidentifikasi koefisien, akar, dan sifat grafik.

## Materi
Bentuk umum fungsi kuadrat adalah $f(x)=ax^2+bx+c$ dengan $a\neq 0$. Untuk $a>0$ parabola terbuka ke atas, sedangkan $a<0$ terbuka ke bawah.

Diskriminan $D=b^2-4ac$ membantu menentukan jumlah akar real.

## Contoh
Untuk $f(x)=x^2-4x+3$, faktorkan menjadi $(x-1)(x-3)$. Akar-akarnya $x=1$ dan $x=3$.

## Latihan
1. Hitung diskriminan $x^2+2x+1$.
2. Tentukan akar $x^2-5x+6=0$.

## Pembahasan
1. $D=2^2-4(1)(1)=0$.
2. $(x-2)(x-3)=0$, jadi $x=2$ atau $x=3$.

## Refleksi
Bagaimana diskriminan berkaitan dengan perpotongan grafik dan sumbu-x?`},
      {title:'Titik Puncak dan Pemodelan',objective:'Menentukan koordinat puncak dan menginterpretasi nilai ekstrem.',sections:['Sumbu simetri','Titik puncak','Masalah kontekstual'],body:String.raw`# Titik Puncak dan Pemodelan

## Materi
Sumbu simetri fungsi kuadrat $f(x)=ax^2+bx+c$ berada pada $x=-\frac{b}{2a}$. Substitusikan nilai tersebut ke $f(x)$ untuk mendapatkan ordinat puncak.

## Contoh
$f(x)=x^2-6x+5$ mempunyai sumbu simetri $x=3$ dan titik puncak $(3,-4)$.

## Aktivitas
Buat tabel nilai untuk $x=0,1,2,3,4,5,6$, lalu sketsa grafik.

## Latihan
Tentukan nilai maksimum atau minimum fungsi $g(x)=-x^2+4x+1$.

## Pembahasan
Puncak pada $x=2$, sehingga $g(2)=5$ merupakan nilai maksimum.

## Refleksi
Apa makna titik puncak dalam model biaya atau lintasan?`}
    ]
  }
];
async function main(){
  if(process.env.BC_DEMO_SEED_CONFIRM!=='YES') throw Error('Explicit BC_DEMO_SEED_CONFIRM=YES required');
  const email=process.env.BC_DEMO_OWNER_EMAIL;
  if(!email) throw Error('BC_DEMO_OWNER_EMAIL required');
  const owner=await db.studioUser.findUnique({where:{email}});
  if(!owner?.active) throw Error('Owner account must exist and be active');
  const report=[];
  for(const spec of specimens){
    const id=prefix+'-'+spec.code;
    const exists=await db.book.findUnique({where:{id}});
    if(exists){report.push({id,result:'already_exists_skipped'});continue;}
    await db.$transaction(async tx=>{
      await tx.book.create({data:{id,ownerId:owner.id,title:spec.title,grade:spec.grade,subject:spec.subject,description:'DATA DEMO / FIKTIF — untuk uji Stage 1–5. Bukan naskah siap terbit.',targetAudience:spec.audience,writingGoal:spec.goal,bookType:'NONFICTION',genre:spec.genre,pageSize:spec.pageSize,author:'Tim Editorial Demo BC',editorialStage:'WRITING',editorialChecks:{demo:true,stage1:'complete',stage2:'complete',stage3:'sample',stage4:'pending_review',stage5:'preview_only'}}});
      await tx.bookBriefRevision.create({data:{bookId:id,actorId:owner.id,snapshot:{demo:true,title:spec.title,grade:spec.grade,subject:spec.subject,targetAudience:spec.audience,writingGoal:spec.goal,bookType:'NONFICTION',genre:spec.genre}}});
      for(let i=0;i<spec.chapters.length;i++){
        const ch=spec.chapters[i];
        const chapter=await tx.chapter.create({data:{bookId:id,position:i+1,title:ch.title,outlineObjective:ch.objective,content:ch.body}});
        await tx.chapterRevision.create({data:{chapterId:chapter.id,title:ch.title,outlineObjective:ch.objective,content:ch.body,revision:1}});
        for(let j=0;j<ch.sections.length;j++) await tx.outlineSection.create({data:{bookId:id,chapterId:chapter.id,position:j+1,title:ch.sections[j],objective:ch.objective,content:'[DEMO] Kerangka bagian '+ch.sections[j],genreTarget:'NONFICTION',accessTier:'DRAFT'}});
      }
      for(const [module,stage] of [['Buat Buku',1],['Rancang Buku',2],['Studio Penulisan',3],['Review Naskah',4],['Tata Letak',5],['ISBN & Legalitas',5]]){
        await tx.studioFormDraft.create({data:{ownerId:owner.id,module,title:spec.title+' — [DEMO] '+module,payload:{demo:true,bookId:id,stage,description:'Data latihan; belum disetujui atau diterbitkan.',needsHumanReview:stage>=4}}});
      }
      await tx.review.create({data:{bookId:id,decision:'REVISION_REQUIRED',note:'[DEMO] Review editorial: verifikasi fakta, tata bahasa, aksesibilitas, ilustrasi, dan latihan sebelum persetujuan.'}});
      await tx.bookPagination.create({data:{bookId:id,settings:{demo:true,pageSize:spec.pageSize,orientation:'portrait',pageNumbering:true,marginMm:18},version:1}});
    },{timeout:30000});
    report.push({id,result:'created',chapters:spec.chapters.length,stageDrafts:6});
  }
  console.log(JSON.stringify({demo:true,ownerEmail:email,report},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
