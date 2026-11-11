export type StageAiCoverage={
  module:string;
  formName:string;
  stage:string;
  agentId:string;
  generate:"form"|"reviewer"|"isbn"|"sensitive-human";
  notes:string;
};

/** Inventory of editorial stages and the agentic form each one uses. */
export const STAGE_AI_COVERAGE:readonly StageAiCoverage[]=[
  {module:"Buat Buku",formName:"Metadata proyek buku baru",stage:"IDE",agentId:"chief_editor",generate:"form",notes:"Form metadata buku baru"},
  {module:"Idea Lab",formName:"Idea Lab",stage:"IDE",agentId:"chief_editor",generate:"form",notes:"Draf gagasan pembaca"},
  {module:"Proyek Buku",formName:"Metadata proyek buku",stage:"IDE",agentId:"chief_editor",generate:"form",notes:"Identitas dan brief Stage 1"},
  {module:"Rancang",formName:"Stage 2 Kerangka Bab",stage:"RANCANG",agentId:"curriculum",generate:"form",notes:"Kerangka bab"},
  {module:"Rancang",formName:"Stage 2 Subbagian",stage:"RANCANG",agentId:"curriculum",generate:"form",notes:"Subbagian kerangka"},
  {module:"Kurikulum",formName:"Kurikulum",stage:"KURIKULUM",agentId:"curriculum",generate:"form",notes:"Pemetaan capaian dan sumber resmi"},
  {module:"Studio Penulisan",formName:"Stage 3 Naskah Bab",stage:"PENULISAN",agentId:"author",generate:"form",notes:"Naskah bab Markdown"},
  {module:"Studio Latihan",formName:"Studio Latihan",stage:"LATIHAN",agentId:"exercise",generate:"form",notes:"Butir latihan dan pembahasan"},
  {module:"Studio Visual",formName:"Studio Visual",stage:"VISUAL",agentId:"visual",generate:"form",notes:"Brief visual dan lisensi"},
  {module:"Penyuntingan",formName:"Catatan penyuntingan naskah",stage:"EDITORIAL",agentId:"editorial",generate:"form",notes:"Saran bahasa; checklist bukti tetap manual"},
  {module:"Penyuntingan",formName:"Checklist editorial",stage:"EDITORIAL",agentId:"editorial",generate:"sensitive-human",notes:"Centang bukti tidak diisi AI"},
  {module:"Review Naskah",formName:"Catatan keputusan editorial",stage:"EDITORIAL",agentId:"editorial",generate:"sensitive-human",notes:"Keputusan approve/reject wajib manusia"},
  {module:"Review Naskah",formName:"Analisis reviewer",stage:"EDITORIAL",agentId:"editorial",generate:"reviewer",notes:"Endpoint /api/reviewer/ai"},
  {module:"Tata Letak",formName:"Tata letak buku",stage:"TATA LETAK",agentId:"layout",generate:"form",notes:"Ukuran halaman dan urutan bab (setelah persetujuan)"},
  {module:"Tata Letak",formName:"Saran tata letak buku",stage:"TATA LETAK",agentId:"layout",generate:"form",notes:"Saran margin, tipografi, dan daftar isi"},
  {module:"Penerbitan",formName:"Paket penerbitan",stage:"PENERBITAN",agentId:"publisher",generate:"form",notes:"Metadata terbit dan sinopsis"},
  {module:"Percetakan",formName:"Spesifikasi percetakan",stage:"PERCETAKAN",agentId:"publisher",generate:"form",notes:"Spesifikasi cetak; bukan PO ke vendor"},
  {module:"ISBN & Legalitas",formName:"Berkas ISBN",stage:"PENERBITAN",agentId:"publisher",generate:"isbn",notes:"Dossier generate server-side; jangan mengarang ISBN"},
  {module:"Pengaturan",formName:"Metadata provider AI (tanpa API key)",stage:"PENGATURAN",agentId:"chief_editor",generate:"sensitive-human",notes:"API key tidak boleh diisi AI"}
];
