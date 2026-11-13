export type AccountEmailPurpose = "activate" | "reset";

export function activationEmailAllowed(email: string) {
  return email.trim().toLowerCase() !== "srphysics04@gmail.com";
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character] ?? character));

const copy = {
  activate: {
    subject: "Undangan aktivasi akun BC Book Studio",
    title: "Aktifkan akun Anda",
    intro: "Anda diundang untuk mengakses BC Book Studio, ruang kerja editorial Bahasa Cerdas. Untuk mengaktifkan akun dan menetapkan kata sandi, silakan gunakan tautan di bawah ini.",
    action: "Aktifkan akun",
    note: "Jika Anda tidak mengharapkan undangan ini, abaikan email ini atau hubungi pengelola BC Book Studio.",
  },
  reset: {
    subject: "Permintaan atur ulang kata sandi BC Book Studio",
    title: "Atur ulang kata sandi",
    intro: "Kami menerima permintaan untuk mengatur ulang kata sandi akun BC Book Studio Anda. Silakan gunakan tautan di bawah ini untuk membuat kata sandi baru.",
    action: "Atur ulang kata sandi",
    note: "Jika Anda tidak mengajukan permintaan ini, abaikan email ini. Kata sandi Anda tetap berlaku hingga Anda menyimpan kata sandi baru.",
  },
} as const;

export function accountEmail(name: string, link: string, purpose: AccountEmailPurpose) {
  const {subject, title, intro, action, note} = copy[purpose];
  const greeting = "Yth. " + name + ",";
  const validity = "Tautan berlaku selama 30 menit dan hanya dapat digunakan satu kali.";
  const signature = "Hormat kami, Tim BC Book Studio";
  const url = escapeHtml(link);
  return {
    subject,
    text: [greeting, intro, action + ": " + link, validity, note, signature].join("\n\n"),
    html: `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;background:#eef2f8;color:#1c2944;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f8"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #d9e1ee;border-radius:16px;overflow:hidden">
<tr><td style="padding:26px 32px;background:#172b57;color:#fff"><p style="margin:0 0 7px;color:#c9dbff;font-size:12px;font-weight:bold;letter-spacing:2px">BAHASA CERDAS</p><strong style="font-size:24px">BC Book Studio</strong></td></tr>
<tr><td style="padding:30px 32px;font-size:16px;line-height:1.65">
<h1 style="margin:0 0 22px;font-size:27px;line-height:1.2">${title}</h1>
<p>${escapeHtml(greeting)}</p><p>${intro}</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td bgcolor="#294bbb" style="border-radius:9px"><a href="${url}" style="display:inline-block;padding:13px 20px;color:#fff;text-decoration:none;font-weight:bold">${action}</a></td></tr></table>
<p style="padding:12px 16px;background:#edf3ff;border-radius:8px">${validity}</p>
<p>${note}</p><p style="font-size:13px;color:#485772;overflow-wrap:anywhere">Jika tombol tidak dapat dibuka, salin tautan ini ke browser.<br><a href="${url}" style="color:#294bbb">${url}</a></p>
<p>Hormat kami,<br><strong>Tim BC Book Studio</strong></p></td></tr>
<tr><td style="padding:16px 32px;background:#f4f7fb;color:#485772;font-size:12px">Pesan otomatis dari BC Book Studio.</td></tr>
</table></td></tr></table></body></html>`,
  };
}
