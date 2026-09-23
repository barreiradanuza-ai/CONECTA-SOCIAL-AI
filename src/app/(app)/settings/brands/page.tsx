import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SettingsTabs } from "../tabs";
import { createBrandAction } from "../actions";

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const auth = await requireAuth("ADMIN");
  const sp = await searchParams;
  const brands = await db.brand.findMany({
    where: { orgId: auth.orgId },
    include: { _count: { select: { posts: true, socialAccounts: true } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div>
      <PageHeader title="Configurações" subtitle="Cada marca tem identidade, contas, campanhas e calendário independentes. Conteúdos nunca misturam marcas." />
      <SettingsTabs current="brands" />
      <Flash {...sp} />
      <div className="grid gap-6 lg:grid-cols-3">
        <ul className="card divide-y divide-slate-100 lg:col-span-2">
          {brands.map((b) => (
            <li key={b.id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-ink-mute">{b.website ?? "sem site"} · {b._count.socialAccounts} conta(s) · {b._count.posts} publicação(ões)</div>
              </div>
              <span className="text-xs text-ink-mute">Use o seletor “Marca” no menu para gerenciar</span>
            </li>
          ))}
        </ul>
        <form action={createBrandAction} className="card space-y-3 p-5">
          <h2 className="font-semibold">Cadastrar outra marca</h2>
          <Field label="Nome"><input className="input" name="name" required /></Field>
          <Field label="Site"><input className="input" name="website" /></Field>
          <SubmitButton>Criar marca</SubmitButton>
        </form>
      </div>
    </div>
  );
}
