"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { BRAND_COOKIE, requireAuth, assertBrandAccess } from "@/lib/auth";

export async function switchBrandAction(form: FormData) {
  const auth = await requireAuth();
  const brandId = String(form.get("brandId") ?? "");
  await assertBrandAccess(auth, brandId);
  (await cookies()).set(BRAND_COOKIE, brandId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
