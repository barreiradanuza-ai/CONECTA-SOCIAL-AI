import Link from "next/link";
import { requireAuth, getActiveBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { NavLinks, AutoSubmitSelect } from "@/components/client";
import { switchBrandAction } from "./shell-actions";
import { logoutAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { brand, brands } = await getActiveBrand(auth);
  const [unread, pending] = await Promise.all([
    db.notification.count({ where: { orgId: auth.orgId, readAt: null, level: { in: ["WARNING", "ERROR"] } } }),
    brand ? db.post.count({ where: { brandId: brand.id, status: "PENDING_APPROVAL" } }) : 0,
  ]);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard" className="px-3 pt-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Conecta</div>
        <div className="text-lg font-bold leading-tight text-white">Social AI</div>
      </Link>
      {brands.length > 0 && (
        <form action={switchBrandAction} className="px-1">
          <label className="mb-1 block px-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Marca</label>
          <AutoSubmitSelect
            name="brandId"
            defaultValue={brand?.id ?? ""}
            options={brands.map((b) => ({ value: b.id, label: b.name }))}
            className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white [&>option]:text-ink"
          />
        </form>
      )}
      <NavLinks />
      <div className="mt-auto space-y-2 px-3 text-xs text-white/60">
        <div className="truncate">{auth.user.name}</div>
        <form action={logoutAction}>
          <button className="text-white/80 underline-offset-2 hover:underline">Sair</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-navy lg:block">{sidebar}</aside>
      <details className="group bg-navy lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-white">
          <span className="font-bold">Conecta Social AI</span>
          <span className="rounded-lg border border-white/30 px-2 py-1 text-xs">Menu</span>
        </summary>
        <div className="border-t border-white/10">{sidebar}</div>
      </details>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-2.5 text-sm lg:px-8">
          {pending > 0 && (
            <Link href="/posts?status=PENDING_APPROVAL" className="badge bg-amber-100 text-amber-900">
              {pending} aguardando aprovação
            </Link>
          )}
          <Link href="/notifications" className={`badge ${unread ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>
            {unread ? `${unread} alerta(s)` : "Sem alertas"}
          </Link>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
