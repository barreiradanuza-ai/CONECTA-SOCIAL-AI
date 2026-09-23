import Link from "next/link";
import type { PostStatus, Prisma } from "@prisma/client";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, StatusBadge, PillarBadge, FormatBadge, Empty } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { STATUS_LABEL, NETWORK_LABEL, TARGET_STATUS_LABEL } from "@/lib/labels";
import { mediaPath } from "@/server/storage";

const GROUPS: { key: string; label: string; statuses: PostStatus[] }[] = [
  { key: "all", label: "Todas", statuses: [] },
  { key: "DRAFT", label: "Rascunhos", statuses: ["PLANNED", "GENERATING", "DRAFT"] },
  { key: "PENDING_APPROVAL", label: "Aguardando aprovação", statuses: ["PENDING_APPROVAL"] },
  { key: "SCHEDULED", label: "Agendadas", statuses: ["APPROVED", "SCHEDULED", "PUBLISHING"] },
  { key: "PUBLISHED", label: "Publicadas", statuses: ["PUBLISHED", "PARTIALLY_PUBLISHED"] },
  { key: "FAILED", label: "Com erro", statuses: ["FAILED", "PARTIALLY_PUBLISHED"] },
  { key: "CANCELED", label: "Canceladas", statuses: ["CANCELED"] },
];

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; error?: string; q?: string }> }) {
  const { brand } = await requireBrand();
  const sp = await searchParams;
  const group = GROUPS.find((g) => g.key === sp.status) ?? GROUPS[0];
  const where: Prisma.PostWhereInput = { brandId: brand.id };
  if (group.statuses.length) where.status = { in: group.statuses };
  if (sp.q) where.OR = [{ title: { contains: sp.q, mode: "insensitive" } }, { theme: { contains: sp.q, mode: "insensitive" } }];
  const posts = await db.post.findMany({
    where,
    include: { targets: true, media: { where: { purpose: { in: ["COMPOSED", "SLIDE", "COVER"] } }, include: { asset: true }, orderBy: { position: "asc" }, take: 1 } },
    orderBy: group.key === "PUBLISHED" ? { scheduledAt: "desc" } : { scheduledAt: "asc" },
    take: 150,
  });
  const counts = await db.post.groupBy({ by: ["status"], where: { brandId: brand.id }, _count: true });
  const countFor = (g: (typeof GROUPS)[number]) => (g.statuses.length ? counts.filter((c) => g.statuses.includes(c.status)).reduce((a, b) => a + b._count, 0) : counts.reduce((a, b) => a + b._count, 0));

  return (
    <div>
      <PageHeader title="Publicações" subtitle="Rascunhos, aprovações, agendamentos, publicadas e erros." actions={<Link href="/studio/content" className="btn-primary">Nova publicação</Link>} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {GROUPS.map((g) => (
          <Link key={g.key} href={`/posts?status=${g.key}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ${g.key === group.key ? "bg-navy text-white" : "bg-white text-ink-soft ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {g.label} <span className="opacity-60">{countFor(g)}</span>
          </Link>
        ))}
        <form className="ml-auto"><input type="hidden" name="status" value={group.key} /><input className="input py-1.5" name="q" placeholder="Buscar…" defaultValue={sp.q} /></form>
      </div>
      {posts.length === 0 ? (
        <Empty title="Nenhuma publicação aqui">Ative o piloto automático ou crie uma publicação no AI Content Studio.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th /><th>Publicação</th><th>Data</th><th>Status</th><th>Redes</th></tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td className="w-16">
                    {p.media[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaPath(p.media[0].asset.storageKey)} alt="" className="h-14 w-12 rounded-md object-cover" />
                    ) : (
                      <div className="h-14 w-12 rounded-md bg-slate-100" />
                    )}
                  </td>
                  <td>
                    <Link href={`/posts/${p.id}`} className="font-medium hover:text-accent">{p.title ?? p.theme}</Link>
                    <div className="mt-1 flex flex-wrap gap-1"><FormatBadge format={p.format} /><PillarBadge pillar={p.pillar} />{p.origin === "AI" && <span className="badge bg-indigo-50 text-indigo-700">IA</span>}</div>
                    {p.generationError && <div className="mt-1 text-xs text-red-700">Erro de geração: {p.generationError.slice(0, 140)}</div>}
                  </td>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(p.scheduledAt, brand.timezone)}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="text-xs">
                    {p.targets.map((t) => (
                      <div key={t.id}>{NETWORK_LABEL[t.network]}: <span className={t.status === "FAILED" ? "text-red-700" : t.status === "PUBLISHED" ? "text-emerald-700" : ""}>{TARGET_STATUS_LABEL[t.status]}</span></div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-mute">Legenda de status: {Object.values(STATUS_LABEL).join(" · ")}</p>
    </div>
  );
}
