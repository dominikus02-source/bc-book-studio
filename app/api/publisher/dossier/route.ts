import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { sessionUser, deny } from "../../../../lib/auth";
import { canEditPublisherDossier, emptyPublisher, publisherDossierSchema } from "../../../../lib/isbn-packet";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const actor = await sessionUser(req);
  if (!actor) return deny();
  const row = await db.publisherDossier.findUnique({ where: { id: "bci-publisher" } });
  const payload = publisherDossierSchema.safeParse(row?.payload ?? {});
  return NextResponse.json({ dossier: payload.success ? payload.data : emptyPublisher(), canEdit: canEditPublisherDossier(actor.role) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const actor = await sessionUser(req);
  if (!actor) return deny();
  if (!canEditPublisherDossier(actor.role)) return NextResponse.json({ error: "Hanya admin penerbit yang dapat mengubah data penerbit." }, { status: 403 });
  const parsed = publisherDossierSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Data penerbit tidak valid." }, { status: 400 });
  if (parsed.data.legalName && parsed.data.legalName !== "PT Bahasa Cerdas Indonesia" && parsed.data.legalName.trim()) {
    return NextResponse.json({ error: "Nama badan hukum tetap PT Bahasa Cerdas Indonesia. Imprint yang diubah adalah Teras Kata." }, { status: 409 });
  }
  const data = { ...parsed.data, legalName: "PT Bahasa Cerdas Indonesia", imprintName: parsed.data.imprintName || "Teras Kata" };
  const row = await db.publisherDossier.upsert({ where: { id: "bci-publisher" }, update: { payload: data, updatedById: actor.id }, create: { id: "bci-publisher", payload: data, updatedById: actor.id } });
  return NextResponse.json({ dossier: publisherDossierSchema.parse(row.payload) });
}
