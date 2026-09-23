"use server";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { runAction, str, lines, int } from "@/lib/actions";
import { parseBRL } from "@/server/guard";
import { zonedTimeToUtc } from "@/lib/time";
import { audit } from "@/server/audit";

function dateStart(v: string, tz: string) {
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) throw new Error("Data inválida.");
  return zonedTimeToUtc(y, m, d, 0, 0, tz);
}
function dateEnd(v: string, tz: string) {
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) throw new Error("Data inválida.");
  return zonedTimeToUtc(y, m, d, 23, 59, tz);
}

export async function saveOfferAction(form: FormData) {
  const { auth, brand } = await requireBrand("EDITOR");
  return runAction("/offers", async () => {
    const id = str(form, "id");
    const operator = str(form, "operator");
    const speedMbps = int(form, "speedMbps", 0, 1, 100000);
    const priceCents = parseBRL(str(form, "price").replace(/R\$\s?/, ""));
    if (!operator || !speedMbps || !priceCents || Number.isNaN(priceCents)) throw new Error("Operadora, velocidade e preço são obrigatórios.");
    const validFrom = dateStart(str(form, "validFrom"), brand.timezone);
    const validUntil = dateEnd(str(form, "validUntil"), brand.timezone);
    if (validUntil <= validFrom) throw new Error("A validade final deve ser posterior à inicial.");
    const data = {
      operator,
      planName: str(form, "planName") || null,
      speedMbps,
      priceCents,
      pricePeriod: str(form, "pricePeriod") || "/mês",
      benefits: lines(form, "benefits"),
      conditions: str(form, "conditions") || null,
      regions: lines(form, "regions"),
      restrictions: str(form, "restrictions") || null,
      validFrom,
      validUntil,
      // Qualquer alteração volta a oferta para rascunho: precisa de nova aprovação
      status: "DRAFT" as const,
      approvedAt: null,
      approvedById: null,
    };
    if (id) {
      const existing = await db.offer.findFirst({ where: { id, brandId: brand.id } });
      if (!existing) throw new Error("Oferta não encontrada.");
      await db.offer.update({ where: { id }, data });
      await audit(auth.orgId, "offer.update", { userId: auth.user.id, entity: "Offer", entityId: id });
      return "Oferta atualizada. Aprove novamente para uso nas publicações.";
    }
    const o = await db.offer.create({ data: { ...data, orgId: auth.orgId, brandId: brand.id } });
    await audit(auth.orgId, "offer.create", { userId: auth.user.id, entity: "Offer", entityId: o.id });
    return "Oferta cadastrada como rascunho. Aprove para liberar o uso.";
  });
}

export async function setOfferStatusAction(form: FormData) {
  const { auth, brand } = await requireBrand("ADMIN");
  return runAction("/offers", async () => {
    const o = await db.offer.findFirst({ where: { id: str(form, "id"), brandId: brand.id } });
    if (!o) throw new Error("Oferta não encontrada.");
    const status = str(form, "status") as "APPROVED" | "ARCHIVED" | "DRAFT";
    await db.offer.update({
      where: { id: o.id },
      data: { status, approvedAt: status === "APPROVED" ? new Date() : null, approvedById: status === "APPROVED" ? auth.user.id : null },
    });
    if (status !== "APPROVED") {
      // Publicações futuras dependentes voltam para aprovação
      await db.post.updateMany({
        where: { offerId: o.id, status: { in: ["SCHEDULED", "APPROVED"] } },
        data: { status: "PENDING_APPROVAL", approvalReasons: ["A oferta vinculada foi arquivada ou voltou para rascunho."] },
      });
    }
    await audit(auth.orgId, `offer.${status.toLowerCase()}`, { userId: auth.user.id, entity: "Offer", entityId: o.id });
    return status === "APPROVED" ? "Oferta aprovada para uso." : "Status atualizado.";
  });
}
