const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function main() {
  const title = 'Bahasa Indonesia Kelas VII — Contoh Beta';
  const existing = await db.book.findFirst({ where: { title } });
  if (existing) { console.log('SEED_ALREADY_EXISTS'); return; }
  const book = await db.book.create({
    data: {
      title, ownerId: 'legacy-unassigned', grade: '7', subject: 'Bahasa Indonesia',
      description: 'Contoh konten untuk pengujian beta. Belum melalui pemeriksaan editorial akhir.',
      chapters: { create: [
        { position: 1, title: 'Mengenal Teks Deskripsi', content: 'Teks deskripsi menggambarkan objek, tempat, atau suasana secara terperinci. Contoh: Perpustakaan sekolah memiliki rak-rak buku yang tersusun rapi. Cahaya matahari masuk melalui jendela besar. Latihan: Tulislah lima kalimat yang menggambarkan ruang kelasmu.' },
        { position: 2, title: 'Menyusun Teks Narasi', content: 'Teks narasi menceritakan rangkaian peristiwa yang saling berhubungan. Struktur sederhana mencakup orientasi, komplikasi, dan resolusi. Latihan: Buatlah cerita pendek tentang kerja sama teman-teman saat menyelesaikan masalah di sekolah.' }
      ] }
    }
  });
  console.log('SEED_BOOK_CREATED_CHAPTERS=2');
}
main().catch(e=>{console.error('SEED_FAILED',e.code||e.name);process.exitCode=1}).finally(()=>db.$disconnect());
