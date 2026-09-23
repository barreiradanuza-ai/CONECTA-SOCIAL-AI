"use server";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { runAction, str, int } from "@/lib/actions";
import { audit } from "@/server/audit";

export async function addTrendAction(form: FormData) {
  const { auth, brand } = await requireBrand("EDITOR");
  return runAction("/studio/content", async () => {
    const text = str(form, "text");
    if (text.length < 10) throw new Error("Descreva a pauta com mais detalhes.");
    const days = int(form, "days", 7, 1, 60);
    const t = await db.trendNote.create({
      data: { brandId: brand.id, text, sourceUrl: str(form, "sourceUrl") || null, validUntil: new Date(Date.now() + days * 86400_000) },
    });
    await audit(auth.orgId, "trend.create", { userId: auth.user.id, entity: "TrendNote", entityId: t.id });
    return "Pauta adicionada. O agente pode usá-la nos próximos conteúdos.";
  });
}

export async function deleteTrendAction(form: FormData) {
  const { brand } = await requireBrand("EDITOR");
  return runAction("/studio/content", async () => {
    await db.trendNote.deleteMany({ where: { id: str(form, "id"), brandId: brand.id } });
    return "Pauta removida.";
  });
}
