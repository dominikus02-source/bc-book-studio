import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../lib/db";
import { accessEmail, deny, reviewerAuthorized } from "../../../lib/auth";
import { encryptSecret, isProviderName, preferredProvider, PROVIDERS, publicProvider, vaultConfigured, askProvider } from "../../../lib/ai-providers";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: noStore });
const idSchema = z.string().uuid();
const providerSchema = z.enum(["deepseek", "openai", "groq", "gemini", "anthropic", "openrouter", "mistral", "xai"]);
const modelSchema = z.string().trim().min(2).max(150).regex(/^[A-Za-z0-9._:/-]+$/);
const base = z.object({
  provider: providerSchema,
  label: z.string().trim().min(2).max(90),
  model: modelSchema,
  enabled: z.boolean(),
  isDefault: z.boolean()
}).strict();
const createSchema = base.extend({ apiKey: z.string().trim().min(12).max(4096) });
const updateSchema = base.partial().extend({
  id: idSchema,
  apiKey: z.string().trim().min(12).max(4096).optional()
});
async function canManage(req: NextRequest) {
  if (reviewerAuthorized(req)) return true;
  const email = await accessEmail(req);
  const admins = (process.env.CF_ACCESS_ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && admins.includes(email));
}
function validOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Bearer-authenticated CLI clients may omit Origin.
  try {
    return new URL(origin).origin === req.nextUrl.origin;
  } catch { return false; }
}
function validJson(req: NextRequest) {
  return req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() === "application/json";
}
function preflight(req: NextRequest) {
  if (!validOrigin(req)) return reply({ error: "Origin tidak diizinkan" }, 403);
  if (!validJson(req)) return reply({ error: "Content-Type harus application/json" }, 415);
  return null;
}
export async function GET(req: NextRequest) {
  if (!(await canManage(req))) return deny();
  const credentials = await db.aiProviderCredential.findMany({ orderBy: { createdAt: "asc" } });
  return reply({ providers: credentials.map(publicProvider), catalog: PROVIDERS, vaultReady: vaultConfigured() });
}
export async function POST(req: NextRequest) {
  if (!(await canManage(req))) return deny();
  const invalid = preflight(req); if (invalid) return invalid;
  const data = await req.json().catch(() => null);
  if (data?.action === "test") {
    const parsed = idSchema.safeParse(data.id);
    if (!parsed.success) return reply({ error: "ID provider tidak valid" }, 400);
    const row = await db.aiProviderCredential.findUnique({ where: { id: parsed.data } });
    if (!row) return reply({ error: "Provider tidak ditemukan" }, 404);
    try {
      await askProvider(row, [{ role: "user", content: "Balas dengan satu kata OK." }], { maxTokens: 32, timeoutMs: 12000 });
      return reply({ ok: true, message: "Model merespons permintaan tes." });
    } catch {
      return reply({ ok: false, message: "Tes gagal. Periksa API key, model, kuota, dan billing." });
    }
  }
  if (!vaultConfigured()) return reply({ error: "Enkripsi belum dikonfigurasi di server." }, 503);
  const parsed = createSchema.safeParse(data);
  if (!parsed.success) return reply({ error: "Data provider tidak valid" }, 400);
  try {
    const { apiKey, ...values } = parsed.data;
    const id = crypto.randomUUID();
    const created = await db.$transaction(async tx => {
      if (values.isDefault) await tx.aiProviderCredential.updateMany({ data: { isDefault: false } });
      return tx.aiProviderCredential.create({
        data: { id, ...values, isDefault: values.enabled && values.isDefault, secretCiphertext: encryptSecret(id, apiKey) }
      });
    });
    return reply({ provider: publicProvider(created) }, 201);
  } catch { return reply({ error: "Gagal menyimpan konfigurasi provider." }, 500); }
}
export async function PATCH(req: NextRequest) {
  if (!(await canManage(req))) return deny();
  const invalid = preflight(req); if (invalid) return invalid;
  if (!vaultConfigured()) return reply({ error: "Enkripsi belum dikonfigurasi di server." }, 503);
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Data perubahan tidak valid" }, 400);
  try {
    const { id, apiKey, ...fields } = parsed.data;
    const updated = await db.$transaction(async tx => {
      const old = await tx.aiProviderCredential.findUnique({ where: { id } });
      if (!old) return null;
      const enabled = fields.enabled ?? old.enabled;
      const isDefault = fields.isDefault ?? old.isDefault;
      if (fields.isDefault && enabled) await tx.aiProviderCredential.updateMany({ data: { isDefault: false } });
      return tx.aiProviderCredential.update({
        where: { id }, data: {
          ...fields,
          isDefault: enabled && isDefault,
          ...(apiKey ? { secretCiphertext: encryptSecret(id, apiKey) } : {})
        }
      });
    });
    return updated ? reply({ provider: publicProvider(updated) }) : reply({ error: "Provider tidak ditemukan" }, 404);
  } catch { return reply({ error: "Gagal memperbarui provider." }, 500); }
}
export async function DELETE(req: NextRequest) {
  if (!(await canManage(req))) return deny();
  const invalid = preflight(req); if (invalid) return invalid;
  const parsed = z.object({ id: idSchema }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return reply({ error: "ID provider tidak valid" }, 400);
  const found = await db.aiProviderCredential.findUnique({ where: { id: parsed.data.id } });
  if (!found) return reply({ error: "Provider tidak ditemukan" }, 404);
  await db.aiProviderCredential.delete({ where: { id: parsed.data.id } });
  return reply({ deleted: true });
}
