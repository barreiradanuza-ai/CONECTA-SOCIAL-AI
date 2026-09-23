"use server";
import { revalidatePath } from "next/cache";
import { requireBrand } from "@/lib/auth";
import { runAction } from "@/lib/actions";
import { reschedulePost } from "@/server/posts";
import { ensureCalendar } from "@/server/automation/planner";
import { ensureBrandDefaults } from "@/server/brand";
import { audit } from "@/server/audit";
import { db } from "@/lib/db";
import { zonedParts, zonedTimeToUtc } from "@/lib/time";

/** Arrastar e soltar: move para outro dia mantendo o horário local. */
export async function movePostAction(postId: string, dateKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { auth, brand } = await requireBrand("EDITOR");
    const post = await db.post.findFirst({ where: { id: postId, brandId: brand.id } });
    if (!post) throw new Error("Publicação não encontrada.");
    const [y, m, d] = dateKey.split("-").map(Number);
    const base = post.scheduledAt ?? new Date();
    const p = zonedParts(base, brand.timezone);
    const at = zonedTimeToUtc(y, m, d, p.hour, p.minute, brand.timezone);
    if (at < new Date()) throw new Error("Não é possível mover para o passado.");
    await reschedulePost(auth.orgId, auth.user.id, postId, at);
    revalidatePath("/calendar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function planCalendarAction() {
  const { auth, brand } = await requireBrand("ADMIN");
  return runAction("/calendar", async () => {
    await ensureBrandDefaults(brand.id);
    const r = await ensureCalendar(brand.id);
    await audit(auth.orgId, "calendar.plan", { userId: auth.user.id, meta: r });
    return r.created ? `${r.created} publicações planejadas pela IA para os próximos dias.` : "O calendário já está completo para o horizonte configurado.";
  });
}
