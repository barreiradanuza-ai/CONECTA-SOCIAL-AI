import Link from "next/link";
import { requireAuth, getActiveBrand } from "@/lib/auth";
import { setupStatus } from "@/server/status";
import { PageHeader, Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createBrandAction } from "../settings/actions";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const auth = await requireAuth();
  const { brand } = await getActiveBrand(auth);
  const sp = await searchParams;

  if (!brand) {
    return (
      <div className="max-w-lg">
        <PageHeader title="Cadastre sua primeira marca" />
        <Flash {...sp} />
        <form action={createBrandAction} className="card space-y-4 p-6">
          <input className="input" name="name" placeholder="Nome da marca" required />
          <input className="input" name="website" placeholder="Site (opcional)" />
          <SubmitButton>Criar marca</SubmitButton>
        </form>
      </div>
    );
  }

  const status = await setupStatus(auth.orgId, brand);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Configuração guiada" subtitle={`Siga os passos para colocar ${brand.name} no piloto automático.`} />
      <Flash {...sp} />
      <ol className="space-y-3">
        {status.steps.map((s, i) => (
          <li key={s.key} className="card flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-ink-soft"}`}>{s.done ? "✓" : i + 1}</span>
              <span className="font-medium">{s.label}</span>
            </div>
            <Link href={s.href} className={s.done ? "btn-ghost btn-sm" : "btn-primary btn-sm"}>{s.done ? "Revisar" : "Configurar"}</Link>
          </li>
        ))}
      </ol>
      <div className="card mt-6 p-5 text-sm text-ink-soft">
        <p className="font-semibold text-ink">O que depende de terceiros</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Publicação no Facebook/Instagram exige um App da Meta com as permissões aprovadas (App Review) para uso em produção. Em modo de desenvolvimento, só funciona para contas com papel no app.</li>
          <li>Geração de textos e imagens exige chaves válidas da Anthropic e da OpenAI com créditos.</li>
          <li>Reels são publicados a partir de vídeos enviados à biblioteca — o app não gera vídeo por IA.</li>
        </ul>
      </div>
    </div>
  );
}
