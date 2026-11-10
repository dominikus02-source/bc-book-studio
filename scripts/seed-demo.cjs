#!/usr/bin/env node
// Demo seed for BC Book Studio. Default is --dry-run (prints a plan, writes nothing).
// Mutating modes: --apply (idempotent create) or --remove (delete only seeded rows).
// Mutating modes require DEMO_SEED_CONFIRM=srphysics04@gmail.com.
// Identifies seeded rows by title prefix "[DEMO] " plus payload/editorialChecks
// marker bc-book-studio-demo-20261111. Never sets BookStatus to REVIEW/APPROVED
// and never creates BookPublication rows.
const { PrismaClient } = require("@prisma/client");

const EMAIL = "srphysics04@gmail.com";
const MARKER = "bc-book-studio-demo-20261111";
const PREFIX = "[DEMO] ";
const args = new Set(process.argv.slice(2));
const mode = args.has("--remove") ? "remove" : args.has("--apply") ? "apply" : "dry-run";

if (args.has("--help") || (args.has("--apply") && args.has("--remove"))) {
  console.error("Usage: node scripts/seed-demo.cjs [--dry-run|--apply|--remove]");
  console.error("Mutating modes require DEMO_SEED_CONFIRM=srphysics04@gmail.com");
  process.exit(args.has("--help") ? 0 : 2);
}

function confirmOrThrow() {
  if (process.env.DEMO_SEED_CONFIRM !== EMAIL) {
    throw new Error("Set DEMO_SEED_CONFIRM="+EMAIL+" before --apply or --remove");
  }
}

const BOOK_SPECS = [
  {
    title: PREFIX + "Bahasa Indonesia Kelas VII — Teks Deskripsi",
    grade: "VII",
    subject: "Bahasa Indonesia",
    description: "Draf demo Stage 1–4: gagasan teks deskripsi, kerangka bab, naskah, latihan, dan catatan review. Marker: "+MARKER,
    targetAudience: "Siswa SMP kelas VII",
    writingGoal: "Siswa mampu mengenali dan menulis teks deskripsi yang runtut.",
    bookType: "NONFICTION",
    genre: "TEXTBOOK",
    pageSize: "A4",
    author: "BC Book Studio Demo",
    editorialStage: "WRITING",
    editorialChecks: {objectives:true,sources:true,assessment:true,expert:true,rights:true,demoMarker:MARKER},
    chapters: [
      {
        position: 1,
        title: "Mengenali Teks Deskripsi",
        outlineObjective: "Menjelaskan ciri, struktur, dan kaidah teks deskripsi.",
        content: "Teks deskripsi menggambarkan objek secara rinci agar pembaca seolah-olah melihat, mendengar, atau merasakan objek itu. Struktur umumnya meliputi identifikasi dan pemerian bagian. Versi demo ini merangkum ide, kerangka, dan naskah awal untuk latihan editorial.",
        revisionContent: "Draf awal: teks deskripsi adalah tulisan yang menggambarkan objek. Struktur dan kaidah akan dilengkapi pada revisi berikutnya.",
        outline: [
          {position:1,title:"Pengertian dan tujuan",objective:"Menyebutkan pengertian teks deskripsi.",content:"Definisi kerja dan contoh objek konkret di sekitar siswa."},
          {position:2,title:"Struktur dan kaidah",objective:"Mengidentifikasi identifikasi dan pemerian.",content:"Ciri kebahasaan: kata sifat, rujukan indera, dan urutan spasial."}
        ]
      },
      {
        position: 2,
        title: "Menulis dan Melatih Teks Deskripsi",
        outlineObjective: "Menulis teks deskripsi pendek dan mengerjakan latihan merinci objek.",
        content: "Siswa memilih satu objek di kelas, menyusun identifikasi, lalu menuliskan pemerian dengan rujukan indera. Latihan: lengkapi lima kalimat rinci, tukar tulisan, dan beri umpan balik merujuk kaidah bahasa.",
        outline: [
          {position:1,title:"Langkah menulis",objective:"Menyusun kerangka sebelum menulis.",content:"Pilih objek, tentukan sudut pandang, urutkan rincian."},
          {position:2,title:"Latihan dan umpan balik",objective:"Memberi masukan berdasarkan kaidah.",content:"Rubrik singkat: kelengkapan indera, urutan, dan ejaan."}
        ]
      }
    ],
    notes: [
      {chapterIndex:0,category:"CONTENT",severity:"SUGGESTION",content:"[DEMO] Pertajam contoh objek konkret di Bab 1 agar siswa kelas VII lebih mudah meniru."}
    ]
  },
  {
    title: PREFIX + "IPA Kelas VIII — Sistem Pernapasan",
    grade: "VIII",
    subject: "IPA",
    description: "Draf demo naskah sains, catatan review, arahan ilustrasi, dan tata letak. Marker: "+MARKER,
    targetAudience: "Siswa SMP kelas VIII",
    writingGoal: "Siswa memahami organ dan mekanisme pernapasan manusia secara ringkas.",
    bookType: "NONFICTION",
    genre: "TEXTBOOK",
    pageSize: "A4",
    author: "BC Book Studio Demo",
    editorialStage: "WRITING",
    editorialChecks: {objectives:true,sources:true,assessment:true,expert:true,rights:true,demoMarker:MARKER},
    chapters: [
      {
        position: 1,
        title: "Organ dan Mekanisme Pernapasan",
        outlineObjective: "Menjelaskan organ utama dan jalur masuk-keluar udara.",
        content: "Sistem pernapasan manusia meliputi hidung, faring, laring, trakea, bronkus, dan paru-paru. Pertukaran gas terjadi di alveolus. Naskah demo ini disiapkan untuk ditinjau, dilengkapi catatan ilustrasi penampang paru, dan direncanakan tata letaknya pada kertas A4.",
        outline: [
          {position:1,title:"Organ pernapasan",objective:"Menyebutkan organ utama secara berurutan.",content:"Jalur udara dari hidung hingga alveolus."},
          {position:2,title:"Mekanisme inspirasi dan ekspirasi",objective:"Membedakan inspirasi dan ekspirasi.",content:"Peran diafragma dan otot interkostal dalam perubahan volume rongga dada."}
        ]
      }
    ],
    notes: [
      {chapterIndex:0,category:"CONTENT",severity:"SUGGESTION",content:"[DEMO] Lengkapi keterangan ilustrasi penampang paru dan sumber hak pakai sebelum review formal."}
    ],
    pagination: true
  },
  {
    title: PREFIX + "Matematika Kelas X — Fungsi Kuadrat",
    grade: "X",
    subject: "Matematika",
    description: "Draf demo rumus LaTeX, latihan editor, catatan paginasi, dan pengaturan ekspor. Marker: "+MARKER,
    targetAudience: "Siswa SMA kelas X",
    writingGoal: "Siswa mampu menentukan titik puncak, sumbu simetri, dan grafik fungsi kuadrat.",
    bookType: "NONFICTION",
    genre: "TEXTBOOK",
    pageSize: "A4",
    author: "BC Book Studio Demo",
    editorialStage: "WRITING",
    editorialChecks: {objectives:true,sources:true,assessment:true,expert:true,rights:true,demoMarker:MARKER},
    chapters: [
      {
        position: 1,
        title: "Fungsi Kuadrat dan Grafiknya",
        outlineObjective: "Menulis bentuk umum, titik puncak, dan sketsa grafik fungsi kuadrat.",
        content: "Bentuk umum fungsi kuadrat adalah $f(x)=ax^2+bx+c$ dengan $a\\neq 0$. Diskriminan $\\Delta=b^2-4ac$ menentukan jumlah akar. Titik puncak berada di $\\left(-\\dfrac{b}{2a}, f\\left(-\\dfrac{b}{2a}\\right)\\right)$ dan sumbu simetri adalah $x=-\\dfrac{b}{2a}$. Contoh: $f(x)=x^2-4x+3$ memotong sumbu $x$ di $1$ dan $3$. Naskah ini menguji editor rumus, paginasi A4, dan pengaturan ekspor draf.",
        outline: [
          {position:1,title:"Bentuk umum dan diskriminan",objective:"Menuliskan $f(x)=ax^2+bx+c$ dan $\\Delta$.",content:"Syarat $a\\neq 0$ dan arti geometris diskriminan."},
          {position:2,title:"Titik puncak dan grafik",objective:"Menghitung titik puncak dan membuat sketsa.",content:"Langkah plot titik puncak, potongan sumbu, dan arah parabola."}
        ]
      }
    ],
    notes: [],
    pagination: true
  }
];

function draftSpecs(books) {
  const rows = [];
  const idea = ["gagasan pembaca","nilai unik","cakupan materi"];
  const kur = ["capaian pembelajaran","urutan bab","tujuan per bab"];
  const latihan = ["butir pilihan ganda","latihan uraian","kunci singkat"];
  const visual = ["catatan ilustrasi","sumber gambar","tata letak gambar"];
  const exportNotes = ["ukuran kertas A4","opsi ekspor PDF/DOCX/EPUB","catatan paginasi draf"];
  books.forEach((book, i) => {
    rows.push({module:"Idea Lab",title:PREFIX+"Stage 1 — Ide — "+idea[i]+" — "+book.title,payload:{demoMarker:MARKER,stage:"1",bookTitle:book.title,focus:idea[i],summary:"Draf formulir ide untuk "+book.title+"."}});
    rows.push({module:"Kurikulum",title:PREFIX+"Stage 2 — Rancang — "+kur[i]+" — "+book.title,payload:{demoMarker:MARKER,stage:"2",bookTitle:book.title,focus:kur[i],summary:"Draf kerangka kurikulum untuk "+book.title+"."}});
    rows.push({module:"Studio Latihan",title:PREFIX+"Stage 3 — Latihan — "+latihan[i]+" — "+book.title,payload:{demoMarker:MARKER,stage:"3",bookTitle:book.title,focus:latihan[i],summary:"Draf latihan untuk "+book.title+"."}});
    rows.push({module:"Studio Visual",title:PREFIX+"Stage 3/5 — Visual — "+visual[i]+" — "+book.title,payload:{demoMarker:MARKER,stage:"3",bookTitle:book.title,focus:visual[i],summary:"Draf catatan ilustrasi atau tata letak untuk "+book.title+"."}});
    rows.push({module:"Pengaturan",title:PREFIX+"Stage 5 — Ekspor — "+exportNotes[i]+" — "+book.title,payload:{demoMarker:MARKER,stage:"5",bookTitle:book.title,focus:exportNotes[i],summary:"Draf pengaturan ekspor/paginasi untuk "+book.title+"."}});
  });
  return rows;
}

function mappingNote() {
  return [
    "Form draft mapping (StudioFormDraft.module is an API enum, not Stage 1–5 names):",
    "  Stage 1 Ide     -> 3 x Idea Lab",
    "  Stage 2 Rancang -> 3 x Kurikulum (chapter OutlineSection holds the actual outline)",
    "  Stage 3 Tulis   -> 3 x Studio Latihan + illustration notes in 3 x Studio Visual",
    "  Stage 4 Review  -> ReviewerNote rows (no official form-draft module for review)",
    "  Stage 5 Terbit  -> 3 x Pengaturan (export/pagination notes) + BookPagination on IPA and Matematika",
    "  Never created: BookStatus REVIEW/APPROVED, BookPublication, ISBN, or publishing evidence."
  ].join("\n");
}

async function findOwner(db) {
  const user = await db.studioUser.findFirst({
    where: {email:{equals:EMAIL,mode:"insensitive"}},
    select:{id:true,email:true,role:true,active:true,name:true}
  });
  if (!user) throw new Error("User "+EMAIL+" not found; aborting");
  return user;
}

function planFrom(user) {
  const chapters = BOOK_SPECS.reduce((n,b)=>n+b.chapters.length,0);
  const outlines = BOOK_SPECS.reduce((n,b)=>n+b.chapters.reduce((m,c)=>m+(c.outline?c.outline.length:0),0),0);
  const revisions = BOOK_SPECS.filter(b=>b.chapters.some(c=>c.revisionContent)).length;
  const notes = BOOK_SPECS.reduce((n,b)=>n+(b.notes||[]).length,0);
  const drafts = draftSpecs(BOOK_SPECS.map(b=>({title:b.title}))).length;
  const pagination = BOOK_SPECS.filter(b=>b.pagination).length;
  return {user,books:BOOK_SPECS.length,chapters,outlines,revisions,notes,drafts,pagination};
}

async function applySeed(db, user) {
  const created = {books:0,skippedBooks:0,chapters:0,outlines:0,revisions:0,notes:0,drafts:0,skippedDrafts:0,pagination:0};
  const drafts = draftSpecs(BOOK_SPECS);
  await db.$transaction(async (tx) => {
    for (const spec of BOOK_SPECS) {
      const existing = await tx.book.findFirst({where:{ownerId:user.id,title:spec.title,archivedAt:null}});
      if (existing) {
        created.skippedBooks++;
        continue;
      }
      const book = await tx.book.create({
        data:{
          ownerId:user.id,
          title:spec.title,
          grade:spec.grade,
          subject:spec.subject,
          description:spec.description,
          targetAudience:spec.targetAudience,
          writingGoal:spec.writingGoal,
          status:"DRAFT",
          bookType:spec.bookType,
          genre:spec.genre,
          pageSize:spec.pageSize,
          author:spec.author,
          editorialStage:spec.editorialStage,
          editorialChecks:spec.editorialChecks
        }
      });
      created.books++;
      const chapterIds = [];
      for (const ch of spec.chapters) {
        const row = await tx.chapter.create({
          data:{
            bookId:book.id,
            position:ch.position,
            title:ch.title,
            content:ch.content,
            outlineObjective:ch.outlineObjective
          }
        });
        chapterIds.push(row.id);
        created.chapters++;
        if (ch.revisionContent) {
          await tx.chapterRevision.create({
            data:{chapterId:row.id,title:ch.title,content:ch.revisionContent,outlineObjective:ch.outlineObjective,revision:1}
          });
          created.revisions++;
        }
        for (const section of ch.outline||[]) {
          await tx.outlineSection.create({
            data:{
              bookId:book.id,
              chapterId:row.id,
              position:section.position,
              title:section.title,
              objective:section.objective,
              content:section.content,
              genreTarget:"NONFICTION",
              accessTier:"DRAFT"
            }
          });
          created.outlines++;
        }
      }
      for (const note of spec.notes||[]) {
        await tx.reviewerNote.create({
          data:{
            bookId:book.id,
            reviewerId:user.id,
            chapterId:chapterIds[note.chapterIndex]||null,
            category:note.category,
            severity:note.severity,
            status:"OPEN",
            content:note.content
          }
        });
        created.notes++;
      }
      if (spec.pagination) {
        await tx.bookPagination.create({
          data:{
            bookId:book.id,
            version:1,
            settings:{pageSize:spec.pageSize,demoMarker:MARKER,notes:"Draf paginasi demo, bukan artefak terbit."}
          }
        });
        created.pagination++;
      }
    }
    for (const draft of drafts) {
      const exists = await tx.studioFormDraft.findFirst({
        where:{ownerId:user.id,module:draft.module,title:draft.title}
      });
      if (exists) { created.skippedDrafts++; continue; }
      await tx.studioFormDraft.create({data:{ownerId:user.id,module:draft.module,title:draft.title,payload:draft.payload}});
      created.drafts++;
    }
  });
  return created;
}

async function removeSeed(db, user) {
  return db.$transaction(async (tx) => {
    const books = await tx.$queryRaw`
      SELECT id, title FROM "Book"
      WHERE "ownerId" = ${user.id}
        AND title LIKE ${PREFIX + "%"}
        AND "editorialChecks"->>'demoMarker' = ${MARKER}`;
    const bookIds = books.map((b) => b.id);
    let notes = 0, pagination = 0;
    if (bookIds.length) {
      notes = (await tx.reviewerNote.deleteMany({where:{bookId:{in:bookIds},content:{startsWith:PREFIX}}})).count;
      pagination = (await tx.bookPagination.deleteMany({where:{bookId:{in:bookIds}}})).count;
      // Chapters, outlines, and revisions cascade when books are deleted.
      await tx.book.deleteMany({where:{id:{in:bookIds}}});
    }
    const drafts = await tx.$executeRaw`
      DELETE FROM "StudioFormDraft"
      WHERE "ownerId" = ${user.id}
        AND title LIKE ${PREFIX + "%"}
        AND payload->>'demoMarker' = ${MARKER}`;
    return {books:bookIds.length,bookTitles:books.map((b)=>b.title),notes,pagination,drafts};
  });
}

function printPlan(plan) {
  console.log("Mode:", mode);
  console.log("Owner:", plan.user ? plan.user.email+" id="+plan.user.id+" role="+plan.user.role+" active="+plan.user.active : "(no database lookup)");
  console.log("Planned if absent:");
  console.log("  books:", plan.books);
  BOOK_SPECS.forEach((b)=>console.log("   -", b.title, "status=DRAFT editorialStage="+b.editorialStage, "chapters="+b.chapters.length));
  console.log("  chapters:", plan.chapters);
  console.log("  outline sections:", plan.outlines);
  console.log("  manuscript revisions:", plan.revisions);
  console.log("  reviewer notes:", plan.notes);
  console.log("  form drafts:", plan.drafts);
  console.log("  pagination records:", plan.pagination);
  console.log(mappingNote());
}

(async () => {
  if (mode === "dry-run" && !process.env.DATABASE_URL) {
    printPlan(planFrom(null));
    console.log("Dry-run without DATABASE_URL; no database lookup and no writes.");
    return;
  }
  const db = new PrismaClient();
  try {
    const user = await findOwner(db);
    const plan = planFrom(user);
    printPlan(plan);
    if (mode === "dry-run") {
      const existing = await db.book.findMany({where:{ownerId:user.id,title:{startsWith:PREFIX}},select:{id:true,title:true,status:true}});
      console.log("Existing [DEMO] books for this owner:", existing.length);
      existing.forEach((b)=>console.log("   -", b.status, b.title));
      console.log("No writes performed.");
      return;
    }
    confirmOrThrow();
    if (mode === "apply") {
      const created = await applySeed(db, user);
      console.log("Apply result:", created);
      return;
    }
    const removed = await removeSeed(db, user);
    console.log("Remove result:", removed);
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
