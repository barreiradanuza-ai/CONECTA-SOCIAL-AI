import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { PageHeader, Flash, IntegrationState, Empty } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SettingsTabs } from "../tabs";
import { connectPagesAction, disconnectAccountAction, testAccountAction } from "../actions";
import { metaConfigured, META_SCOPES, redirectUri } from "@/server/meta/oauth";
import type { DiscoveredPage } from "@/server/meta/oauth";
import { formatDateTime } from "@/lib/time";
import { env } from "@/lib/env";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; pending?: string }> }) {
  const { auth, brand } = await requireBrand("ADMIN");
  const sp = await searchParams;
  const accounts = await db.socialAccount.findMany({ where: { brandId: brand.id }, orderBy: [{ network: "asc" }, { createdAt: "asc" }] });

  let pendingPages: DiscoveredPage[] | null = null;
  if (sp.pending) {
    const p = await db.oAuthPending.findFirst({ where: { id: sp.pending, orgId: auth.orgId, userId: auth.user.id, expiresAt: { gt: new Date() } } });
    if (p) pendingPages = (JSON.parse(decrypt(p.payloadEnc)) as { pages: DiscoveredPage[] }).pages;
  }

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Conexão oficial com Facebook e Instagram (Facebook Login). Nenhuma senha pessoal é usada ou armazenada." />
      <SettingsTabs current="accounts" />
      <Flash ok={sp.ok} error={sp.error} />

      {!metaConfigured() && (
        <div className="card mb-6 border-amber-300 bg-amber-50 p-5 text-sm">
          <p className="font-semibold">App da Meta não configurado</p>
          <p className="mt-1">Defina <code>META_APP_ID</code> e <code>META_APP_SECRET</code> nas variáveis do servidor. No painel do app (developers.facebook.com), cadastre a URL de redirecionamento:</p>
          <code className="mt-2 block break-all rounded bg-white p-2">{redirectUri()}</code>
        </div>
      )}

      {pendingPages && (
        <form action={connectPagesAction} className="card mb-6 p-5">
          <input type="hidden" name="pendingId" value={sp.pending} />
          <h2 className="font-semibold">Selecione as contas para {brand.name}</h2>
          <p className="mb-4 text-sm text-ink-soft">Somente as contas marcadas serão vinculadas a esta marca.</p>
          <ul className="space-y-3">
            {pendingPages.map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-200 p-3">
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" name="fb" value={p.id} defaultChecked /> Página do Facebook: {p.name}
                </label>
                {p.instagram ? (
                  <label className="ml-6 mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" name="ig" value={p.instagram.id} defaultChecked /> Instagram profissional: @{p.instagram.username}
                  </label>
                ) : (
                  <p className="ml-6 mt-2 text-xs text-ink-mute">Sem conta profissional do Instagram vinculada a esta Página.</p>
                )}
              </li>
            ))}
          </ul>
          <SubmitButton className="btn-primary mt-4">Conectar selecionadas</SubmitButton>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <a href="/api/meta/oauth/start" className={`btn-primary ${metaConfigured() ? "" : "pointer-events-none opacity-50"}`}>Conectar Facebook e Instagram</a>
        <span className="text-xs text-ink-mute">Versão da Graph API: {env.meta.graphVersion}</span>
      </div>

      {accounts.length === 0 ? (
        <Empty title="Nenhuma conta conectada">Conecte a Página do Facebook e a conta profissional do Instagram vinculada a ela.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Rede</th><th>Conta</th><th>Estado</th><th>Última verificação</th><th>Permissões</th><th /></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.network === "INSTAGRAM" ? "Instagram" : "Facebook"}</td>
                  <td>{a.username ? `@${a.username}` : a.name}<div className="text-xs text-ink-mute">ID {a.externalId}</div></td>
                  <td>
                    <IntegrationState state={a.status === "ACTIVE" ? "ok" : a.status === "DISCONNECTED" ? "missing" : "error"} />
                    {a.lastError && <div className="mt-1 max-w-xs text-xs text-red-700">{a.lastError}</div>}
                  </td>
                  <td className="text-xs">{formatDateTime(a.lastCheckedAt, brand.timezone)}</td>
                  <td className="max-w-xs text-[11px] text-ink-mute">{a.scopes.length ? a.scopes.join(", ") : "—"}</td>
                  <td className="whitespace-nowrap">
                    <form action={testAccountAction} className="inline"><input type="hidden" name="id" value={a.id} /><SubmitButton className="btn-ghost btn-sm" pendingText="Testando…">Testar</SubmitButton></form>{" "}
                    {a.status !== "DISCONNECTED" && (
                      <form action={disconnectAccountAction} className="inline"><input type="hidden" name="id" value={a.id} /><SubmitButton className="btn-danger btn-sm" confirm="Desconectar esta conta? Publicações agendadas para ela falharão.">Desconectar</SubmitButton></form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="card mt-6 p-5 text-sm">
        <summary className="cursor-pointer font-semibold">Requisitos da Meta (leia antes de conectar)</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-soft">
          <li>A conta do Instagram precisa ser profissional (Empresa ou Criador) e estar vinculada à Página do Facebook.</li>
          <li>Permissões solicitadas: {META_SCOPES.join(", ")}.</li>
          <li>Enquanto o app estiver em modo de desenvolvimento, apenas usuários com papel no app conseguem autorizar. Para uso comercial contínuo, as permissões avançadas precisam passar pelo App Review e o negócio pela verificação da Meta.</li>
          <li>Limite do Instagram: 100 publicações via API a cada 24h por conta. O app consulta a cota antes de publicar.</li>
          <li>O token de Página obtido a partir do login de longa duração não expira por tempo, mas é invalidado se a senha mudar ou o acesso for revogado — o app verifica diariamente e alerta.</li>
        </ul>
      </details>
    </div>
  );
}
