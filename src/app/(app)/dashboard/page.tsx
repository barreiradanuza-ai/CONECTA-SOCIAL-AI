import Link from "next/link";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { setupStatus } from "@/server/status";
import { PageHeader, Stat, StatusBadge, PillarBadge, FormatBadge, IntegrationState } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { NETWORK_LABEL } from "@/lib/labels";

export default async function DashboardPage() {
  const { auth, brand } = await requireBrand();
  const since = new Date(Date.now() - 30 * 86400_000);
  const now = new Date();
  const [status, automation, upcoming, pending, failed, published, snapshots, clicks, planned, alerts, tasks] = await Promise.all([
    setupStatus(auth.orgId, brand),
    db.automationSettings.findUnique({ where: { brandId: brand.id } }),
    db.post.findMany({ where: { brandId: brand.id, scheduledAt: { gte: now }, status: { notIn: ["CANCELED"] } }, orderBy: { scheduledAt: "asc" }, take: 8 }),
    db.post.count({ where: { brandId: brand.id, status: "PENDING_APPROVAL" } }),
    db.postTarget.findMany({ where: { post: { brandId: brand.id }, status: "FAILED" }, include: { post: true }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.postTarget.count({ where: { post: { brandId: brand.id }, status: "PUBLISHED", publishedAt: { gte: since } } }),
    db.metricSnapshot.findMany({
      where: { target: { post: { brandId: brand.id }, publishedAt: { gte: since } } },
      orderBy: { collectedAt: "desc" },
      select: { targetId: true, views: true, interactions: true },
    }),
    db.linkClick.count({ where: { link: { brandId: brand.id }, createdAt: { gte: since }, converted: false } }),
    db.post.count({ where: { brandId: brand.id, scheduledAt: { gte: now, lte: new Date(now.getTime() + 30 * 86400_000) }, status: { not: "CANCELED" } } }),
    db.notification.findMany({ where: { orgId: auth.orgId, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.taskState.findMany({ orderBy: { name: "asc" } }),
  ]);
  const latest = new Map<string, { views: number | null; interactions: number | null }>();
  for (const s of snapshots) if (!latest.has(s.targetId)) latest.set(s.targetId, s);
  const views = [...latest.values()].reduce((a, b) => a + (b.views ?? 0), 0);
  const interactions = [...latest.values()].reduce((a, b) => a + (b.interactions ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={`Olá, ${auth.user.name.split(" ")[0]}`}
        subtitle={<>Operação de <strong>{brand.name}</strong> · piloto automático {automation?.autopilotEnabled ? <span className="font-semibold text-emerald-700">ativo ({automation.mode === "AUTOMATIC" ? "automático" : "supervisionado"})</span> : <span className="font-semibold text-slate-600">desligado</span>}</>}
        actions={
          <>
            <Link href="/studio/content" className="btn-ghost">Gerar conteúdo</Link>
            <Link href="/calendar" className="btn-primary">Abrir calendário</Link>
          </>
        }
      />

      {!status.complete && (
        <div className="card mb-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Configuração guiada</h2>
            <span className="text-xs text-ink-mute">{status.steps.filter((s) => s.done).length}/{status.steps.length} concluídas</span>
          </div>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {status.steps.map((s, i) => (
              <li key={s.key}>
                <Link href={s.href} className={`block rounded-xl border p-3 text-sm ${s.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 hover:border-accent"}`}>
                  <div className="text-xs font-bold text-ink-mute">{s.done ? "✓ Concluído" : `Passo ${i + 1}`}</div>
                  <div className="mt-1 font-medium">{s.label}</div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Publicações (30 dias)" value={published} hint="destinos publicados" />
        <Stat label="Visualizações" value={views.toLocaleString("pt-BR")} hint="última coleta por publicação" />
        <Stat label="Interações" value={interactions.toLocaleString("pt-BR")} />
        <Stat label="Cliques WhatsApp" value={clicks.toLocaleString("pt-BR")} hint="links rastreáveis" />
        <Stat label="Planejado (30 dias)" value={planned} hint={pending ? `${pending} aguardando aprovação` : "nenhuma pendência"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Próximas publicações</h2>
            <Link href="/posts" className="text-sm text-accent">Ver todas</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-soft">Nada agendado. Ative o piloto automático ou gere o calendário em AI Content Studio.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="w-36 text-xs text-ink-mute">{formatDateTime(p.scheduledAt, brand.timezone)}</span>
                  <Link href={`/posts/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">{p.title ?? p.theme}</Link>
                  <FormatBadge format={p.format} />
                  <PillarBadge pillar={p.pillar} />
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Integrações</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span>Worker de automação</span><IntegrationState state={status.integrations.worker as any} /></li>
              <li className="flex justify-between"><span>App Meta (credenciais)</span><IntegrationState state={status.integrations.metaApp as any} /></li>
              <li className="flex justify-between"><span>Instagram</span><IntegrationState state={status.integrations.instagram as any} /></li>
              <li className="flex justify-between"><span>Facebook</span><IntegrationState state={status.integrations.facebook as any} /></li>
              <li className="flex justify-between"><span>Claude (textos)</span><IntegrationState state={status.integrations.anthropic as any} /></li>
              <li className="flex justify-between"><span>OpenAI (imagens)</span><IntegrationState state={status.integrations.openai as any} /></li>
              <li className="flex justify-between"><span>Armazenamento</span><span className="badge bg-slate-100">{status.integrations.storage === "s3" ? "Bucket S3" : "Disco local"}</span></li>
            </ul>
            {status.workerLastRun && <p className="mt-3 text-xs text-ink-mute">Último ciclo do worker: {formatDateTime(status.workerLastRun, brand.timezone)}</p>}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Alertas</h2>
            {failed.length === 0 && alerts.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhum alerta.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {failed.map((t) => (
                  <li key={t.id} className="rounded-lg bg-red-50 p-2">
                    <Link href={`/posts/${t.postId}`} className="font-medium text-red-800">Falha no {NETWORK_LABEL[t.network]}: {t.post.title ?? t.post.theme}</Link>
                    <div className="text-xs text-red-700">{t.lastError}</div>
                  </li>
                ))}
                {alerts.map((a) => (
                  <li key={a.id} className={`rounded-lg p-2 ${a.level === "ERROR" ? "bg-red-50" : a.level === "WARNING" ? "bg-amber-50" : "bg-slate-50"}`}>
                    {a.link ? <Link href={a.link} className="font-medium">{a.title}</Link> : <span className="font-medium">{a.title}</span>}
                    {a.body && <div className="text-xs text-ink-soft">{a.body}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <details className="card mt-6 p-5">
        <summary className="cursor-pointer font-semibold">Tarefas automáticas do servidor</summary>
        <table className="table mt-3">
          <thead><tr><th>Tarefa</th><th>Última execução</th><th>Resultado</th><th>Mensagem</th></tr></thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.name}>
                <td className="font-mono text-xs">{t.name}</td>
                <td className="text-xs">{formatDateTime(t.lastRunAt, brand.timezone)}</td>
                <td>{t.lastOk == null ? "—" : t.lastOk ? <span className="badge bg-emerald-100 text-emerald-800">ok</span> : <span className="badge bg-red-100 text-red-800">erro</span>}</td>
                <td className="max-w-md truncate text-xs text-ink-soft">{t.lastMessage}</td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={4} className="text-sm text-ink-soft">O worker ainda não executou nenhuma tarefa. Verifique se o serviço “worker” está rodando.</td></tr>}
          </tbody>
        </table>
      </details>
    </div>
  );
}
