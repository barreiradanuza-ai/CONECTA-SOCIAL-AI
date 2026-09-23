import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, Stat, PillarBadge, FormatBadge } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { BarChart, LineChart } from "@/components/charts";
import { PILLAR_LABEL, FORMAT_LABEL, NETWORK_LABEL, PILLARS, FORMATS } from "@/lib/labels";
import { formatDate, formatDateTime, zonedParts, localDateKey } from "@/lib/time";
import { analyzeNowAction } from "./actions";

type Row = {
  targetId: string;
  postId: string;
  title: string;
  pillar: string;
  format: string;
  network: string;
  publishedAt: Date;
  permalink: string | null;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  interactions: number;
  clicks: number;
};

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(2)}%`);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { brand } = await requireBrand();
  const sp = await searchParams;
  const days = Math.min(365, Math.max(7, Number(sp.days ?? 30)));
  const since = new Date(Date.now() - days * 86400_000);
  const tz = brand.timezone;

  const where: Prisma.PostTargetWhereInput = { status: "PUBLISHED", publishedAt: { gte: since }, post: { brandId: brand.id } };
  if (sp.network === "INSTAGRAM" || sp.network === "FACEBOOK") where.network = sp.network;
  const postWhere: Prisma.PostWhereInput = { brandId: brand.id };
  if (sp.pillar && (PILLARS as readonly string[]).includes(sp.pillar)) postWhere.pillar = sp.pillar as any;
  if (sp.format && (FORMATS as readonly string[]).includes(sp.format)) postWhere.format = sp.format as any;
  if (sp.campaign) postWhere.campaignId = sp.campaign;
  where.post = postWhere;

  const [targets, campaigns, insight, followers] = await Promise.all([
    db.postTarget.findMany({ where, include: { post: true, metrics: { orderBy: { collectedAt: "desc" }, take: 1 } }, orderBy: { publishedAt: "desc" } }),
    db.campaign.findMany({ where: { brandId: brand.id } }),
    db.performanceInsight.findFirst({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" } }),
    db.accountMetricSnapshot.findMany({ where: { account: { brandId: brand.id }, date: { gte: since } }, include: { account: true }, orderBy: { date: "asc" } }),
  ]);
  const clickCounts = await db.linkClick.groupBy({ by: ["linkId"], where: { createdAt: { gte: since }, converted: false, link: { brandId: brand.id, postId: { not: null } } }, _count: true });
  const links = await db.trackingLink.findMany({ where: { id: { in: clickCounts.map((c) => c.linkId) } } });
  const clicksByPost = new Map<string, number>();
  for (const c of clickCounts) {
    const l = links.find((x) => x.id === c.linkId);
    if (l?.postId) clicksByPost.set(l.postId, (clicksByPost.get(l.postId) ?? 0) + c._count);
  }

  const rows: Row[] = targets.map((t) => {
    const m = t.metrics[0];
    return {
      targetId: t.id,
      postId: t.postId,
      title: t.post.title ?? t.post.theme,
      pillar: t.post.pillar,
      format: t.post.format,
      network: t.network,
      publishedAt: t.publishedAt!,
      permalink: t.permalink,
      views: m?.views ?? 0,
      reach: m?.reach ?? 0,
      likes: m?.likes ?? 0,
      comments: m?.comments ?? 0,
      shares: m?.shares ?? 0,
      saves: m?.saves ?? 0,
      interactions: m?.interactions ?? 0,
      clicks: t.network === "FACEBOOK" ? clicksByPost.get(t.postId) ?? 0 : 0,
    };
  });
  const withMetrics = targets.filter((t) => t.metrics[0]).length;
  const sum = (k: keyof Row) => rows.reduce((a, r) => a + (r[k] as number), 0);
  const totalViews = sum("views");
  const totalInteractions = sum("interactions");
  const totalClicks = await db.linkClick.count({ where: { createdAt: { gte: since }, converted: false, link: { brandId: brand.id } } });

  const group = (key: "pillar" | "format" | "network" | "hour", labels?: Record<string, string>) => {
    const map = new Map<string, { n: number; views: number; interactions: number; comments: number; clicks: number }>();
    for (const r of rows) {
      const k = key === "hour" ? String(zonedParts(r.publishedAt, tz).hour).padStart(2, "0") + "h" : r[key];
      const cur = map.get(k) ?? { n: 0, views: 0, interactions: 0, comments: 0, clicks: 0 };
      cur.n++;
      cur.views += r.views;
      cur.interactions += r.interactions;
      cur.comments += r.comments;
      cur.clicks += r.clicks;
      map.set(k, cur);
    }
    return [...map.entries()]
      .map(([k, v]) => ({ key: k, label: labels?.[k] ?? k, ...v, rate: v.views ? v.interactions / v.views : null }))
      .sort((a, b) => (key === "hour" ? a.key.localeCompare(b.key) : b.interactions - a.interactions));
  };

  // Série semanal
  const weekly = new Map<string, number>();
  for (const r of rows) {
    const p = zonedParts(r.publishedAt, tz);
    const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - ((p.weekday + 6) % 7)));
    const k = monday.toISOString().slice(0, 10);
    weekly.set(k, (weekly.get(k) ?? 0) + r.interactions);
  }
  const weeklyData = [...weekly.entries()].sort().map(([k, v]) => ({ label: `${k.slice(8, 10)}/${k.slice(5, 7)}`, value: v }));

  const followerSeries = (network: string) => {
    const pts = followers.filter((f) => f.account.network === network);
    return pts.map((p) => ({ label: formatDate(p.date, "UTC"), value: p.followers }));
  };
  const recs = (insight?.recommendations ?? []) as { title: string; detail: string; confidence: string }[];
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([k, v]) => v && k !== "ok" && k !== "error") as [string, string][]);
    return `/reports?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Relatórios" subtitle={`Métricas das APIs oficiais da Meta. Dados de ${withMetrics} de ${targets.length} publicações com coleta disponível.`} />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-6">
        <select name="days" defaultValue={String(days)} className="input">{[7, 30, 90, 180, 365].map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}</select>
        <select name="network" defaultValue={sp.network ?? ""} className="input"><option value="">Todas as redes</option><option value="INSTAGRAM">Instagram</option><option value="FACEBOOK">Facebook</option></select>
        <select name="format" defaultValue={sp.format ?? ""} className="input"><option value="">Todos os formatos</option>{FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}</select>
        <select name="pillar" defaultValue={sp.pillar ?? ""} className="input"><option value="">Todos os pilares</option>{PILLARS.map((p) => <option key={p} value={p}>{PILLAR_LABEL[p]}</option>)}</select>
        <select name="campaign" defaultValue={sp.campaign ?? ""} className="input"><option value="">Todas as campanhas</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="btn-primary">Filtrar</button>
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Publicações" value={targets.length} />
        <Stat label="Visualizações" value={totalViews.toLocaleString("pt-BR")} />
        <Stat label="Curtidas" value={sum("likes").toLocaleString("pt-BR")} />
        <Stat label="Comentários" value={sum("comments").toLocaleString("pt-BR")} />
        <Stat label="Compart. + salvos" value={(sum("shares") + sum("saves")).toLocaleString("pt-BR")} />
        <Stat label="Taxa de engajamento" value={pct(totalViews ? totalInteractions / totalViews : null)} hint="interações ÷ visualizações" />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Interações por semana</h2>
          {weeklyData.length ? <BarChart data={weeklyData} /> : <p className="text-sm text-ink-soft">Sem dados no período.</p>}
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Seguidores</h2>
          <div className="space-y-4">
            {(["INSTAGRAM", "FACEBOOK"] as const).map((n) => (
              <div key={n}><div className="mb-1 text-xs font-semibold text-ink-soft">{NETWORK_LABEL[n]}</div><LineChart points={followerSeries(n)} height={70} /></div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-mute">Cliques rastreáveis no WhatsApp no período: <strong>{totalClicks}</strong></p>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        {([
          ["Por pilar", group("pillar", PILLAR_LABEL)],
          ["Por formato", group("format", FORMAT_LABEL)],
          ["Por horário de publicação", group("hour")],
        ] as const).map(([title, data]) => (
          <div key={title} className="card overflow-x-auto p-4">
            <h2 className="mb-2 font-semibold">{title}</h2>
            <table className="table text-xs">
              <thead><tr><th /><th>Posts</th><th>Interações</th><th>Coment.</th><th>Engaj.</th></tr></thead>
              <tbody>
                {data.map((d) => <tr key={d.key}><td className="font-medium">{d.label}</td><td>{d.n}</td><td>{d.interactions}</td><td>{d.comments}</td><td>{pct(d.rate)}</td></tr>)}
                {data.length === 0 && <tr><td colSpan={5} className="text-ink-soft">Sem dados.</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="card overflow-x-auto p-4 lg:col-span-2">
          <h2 className="mb-2 font-semibold">Comparativo entre publicações</h2>
          <table className="table text-xs">
            <thead><tr><th>Publicação</th><th>Rede</th><th>Data</th><th>Visualiz.</th><th>Interações</th><th>Coment.</th><th>Cliques WA</th><th>Engaj.</th></tr></thead>
            <tbody>
              {[...rows].sort((a, b) => b.interactions - a.interactions).slice(0, 40).map((r) => (
                <tr key={r.targetId}>
                  <td className="max-w-xs"><Link href={`/posts/${r.postId}`} className="font-medium hover:text-accent">{r.title}</Link><div className="mt-0.5 flex gap-1"><PillarBadge pillar={r.pillar} /><FormatBadge format={r.format} /></div></td>
                  <td>{NETWORK_LABEL[r.network]}</td>
                  <td className="whitespace-nowrap">{formatDateTime(r.publishedAt, tz)}</td>
                  <td>{r.views}</td><td>{r.interactions}</td><td>{r.comments}</td><td>{r.clicks || "—"}</td>
                  <td>{pct(r.views ? r.interactions / r.views : null)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="text-ink-soft">Nenhuma publicação no período.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Inteligência de desempenho</h2>
            <form action={analyzeNowAction}><SubmitButton className="btn-ghost btn-sm" pendingText="Analisando…">Analisar agora</SubmitButton></form>
          </div>
          {insight ? (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-ink-mute">Gerada em {formatDateTime(insight.createdAt, tz)} · período {localDateKey(insight.periodStart, tz)} a {localDateKey(insight.periodEnd, tz)}</p>
              <p className="whitespace-pre-line">{insight.summary}</p>
              <ul className="space-y-2">
                {recs.map((r) => (
                  <li key={r.title} className="rounded-lg bg-slate-50 p-2"><div className="font-semibold">{r.title} <span className="badge bg-white">confiança {r.confidence}</span></div><div className="text-ink-soft">{r.detail}</div></li>
                ))}
              </ul>
              <p className="text-[11px] text-ink-mute">Padrões observados são correlações, não prova de causa. As recomendações orientam o próximo planejamento automático.</p>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">A análise é gerada semanalmente quando houver ao menos 5 publicações com métricas.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-ink-mute">
        Definições: <strong>Interações</strong> = total_interactions (Instagram) ou reações + comentários + compartilhamentos (Facebook). <strong>Taxa de engajamento</strong> = interações ÷ visualizações (views) da própria publicação. Métricas indisponíveis na API aparecem como 0 ou “—”. Stories só têm métricas nas primeiras 24h.{" "}
        <Link href={qs({ days: "90" })} className="text-accent">Ver 90 dias</Link>
      </p>
    </div>
  );
}
