"use server";
import { requireBrand } from "@/lib/auth";
import { runAction } from "@/lib/actions";
import { analyzeBrand } from "@/server/automation/metrics";

export async function analyzeNowAction() {
  const { brand } = await requireBrand("ADMIN");
  return runAction("/reports", async () => {
    const r = await analyzeBrand(brand.id);
    return r ? "Análise gerada." : "Ainda não há publicações suficientes com métricas (mínimo 5).";
  });
}
