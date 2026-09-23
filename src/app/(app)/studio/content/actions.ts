"use server";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateIdeas } from "@/server/ai/agent";
import { getBrandContext, validOffers } from "@/server/brand";

export type IdeasState = { ideas: { theme: string; objective: string; pillar: string; format: string; hook: string }[]; error?: string };

export async function generateIdeasAction(_prev: IdeasState, form: FormData): Promise<IdeasState> {
  try {
    const { brand } = await requireBrand("EDITOR");
    const pillar = String(form.get("pillar") ?? "") || undefined;
    const count = Math.min(12, Math.max(3, Number(form.get("count") ?? 6)));
    const hint = String(form.get("hint") ?? "").trim() || undefined;
    const [ctx, recent, offers] = await Promise.all([
      getBrandContext(brand),
      db.post.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" }, take: 80, select: { theme: true } }),
      validOffers(brand.id),
    ]);
    const ideas = await generateIdeas(brand.orgId, ctx, { pillar, count, hint, recentThemes: recent.map((r) => r.theme), hasOffers: offers.length > 0 });
    return { ideas: offers.length ? ideas : ideas.filter((i) => i.pillar !== "OFFERS") };
  } catch (e) {
    return { ideas: [], error: e instanceof Error ? e.message : "Falha ao gerar ideias." };
  }
}
