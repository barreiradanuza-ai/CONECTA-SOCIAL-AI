import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrand, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Flash, StatusBadge, PillarBadge, FormatBadge, Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { formatDateTime, toDatetimeLocal, formatDate } from "@/lib/time";
import { NETWORK_LABEL, TARGET_STATUS_LABEL } from "@/lib/labels";
import { mediaPath } from "@/server/storage";
import { formatBRL } from "@/server/guard";
import { approveAction, unapproveAction, cancelAction, publishNowAction, rescheduleAction, retryAction, saveContentAction, regenerateAction, attachVideoAction } from "../actions";

const LAYOUTS = [
  { v: "hero-bottom", l: "Foto com título sobreposto" },
  { v: "split-panel", l: "Foto + painel" },
  { v: "question-card", l: "Pergunta em destaque" },
  { v: "offer", l: "Oferta (preço da oferta cadastrada)" },
  { v: "story", l: "Story" },
  { v: "carousel", l: "Carrossel" },
];

export default async function PostDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { auth, brand } = await requireBrand();
  const { id } = await params;
  const sp = await searchParams;
  const post = await db.post.findFirst({
    where: { id, orgId: auth.orgId, brandId: brand.id },
    include: {
      offer: true,
      targets: { include: { attemptsLog: { orderBy: { startedAt: "desc" }, take: 10 }, metrics: { orderBy: { collectedAt: "desc" }, take: 1 }, socialAccount: true } },
      media: { include: { asset: true }, orderBy: { position: "asc" } },
      links: { include: { _count: { select: { clicks: true } } } },
    },
  });
  if (!post) notFound();
  const admin = hasRole(auth, "ADMIN");
  const validation = (post.validation ?? null) as { ok: boolean; errors: string[]; warnings: string[] } | null;
  const finals = post.media.filter((m) => ["COMPOSED", "SLIDE", "COVER"].includes(m.purpose));
  const background = post.media.find((m) => m.purpose === "BACKGROUND");
  const video = post.media.find((m) => m.purpose === "VIDEO");
  const slides = (post.slides as { title: string; body: string }[] | null) ?? [];
  const library = await db.mediaAsset.findMany({ where: { brandId: brand.id, kind: "IMAGE", role: { in: ["PHOTO", "GENERATED", "REFERENCE"] } }, orderBy: { createdAt: "desc" }, take: 24 });
  const videos = post.format === "REEL" ? await db.mediaAsset.findMany({ where: { brandId: brand.id, kind: "VIDEO" }, orderBy: { createdAt: "desc" }, take: 30 }) : [];
  const locked = ["PUBLISHED", "PUBLISHING"].includes(post.status);
  const ig = post.targets.find((t) => t.network === "INSTAGRAM");
  const fb = post.targets.find((t) => t.network === "FACEBOOK");

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/posts" className="text-accent">← Publicações</Link></div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{post.title ?? post.theme}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={post.status} />
            <FormatBadge format={post.format} />
            <PillarBadge pillar={post.pillar} />
            {post.episodeNumber && <span className="badge bg-fuchsia-100 text-fuchsia-800">Ep. {post.episodeNumber}</span>}
            <span className="text-ink-soft">{formatDateTime(post.scheduledAt, brand.timezone)}</span>
            <span className="text-ink-mute">· {post.targets.map((t) => NETWORK_LABEL[t.network]).join(" + ")}</span>
          </div>
          {post.timeReason && <p className="mt-1 text-xs text-ink-mute">Horário: {post.timeReason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {admin && post.status === "PENDING_APPROVAL" && (
            <form action={approveAction}><input type="hidden" name="id" value={post.id} /><SubmitButton className="btn-accent" pendingText="Aprovando…">Aprovar e agendar</SubmitButton></form>
          )}
          {admin && ["SCHEDULED", "APPROVED"].includes(post.status) && (
            <>
              <form action={publishNowAction}><input type="hidden" name="id" value={post.id} /><SubmitButton className="btn-primary" confirm="Publicar agora nas redes selecionadas?">Publicar agora</SubmitButton></form>
              <form action={unapproveAction}><input type="hidden" name="id" value={post.id} /><SubmitButton className="btn-ghost">Voltar para rascunho</SubmitButton></form>
            </>
          )}
          {!locked && post.status !== "CANCELED" && (
            <form action={cancelAction}><input type="hidden" name="id" value={post.id} /><SubmitButton className="btn-danger" confirm="Cancelar este agendamento? O conteúdo será mantido.">Cancelar</SubmitButton></form>
          )}
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      {post.status === "GENERATING" && <div className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Gerando conteúdo… atualize a página em instantes.</div>}
      {post.generationError && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">Última geração falhou: {post.generationError}</div>}

      <div className="grid gap-6 xl:grid-cols-5">
        {/* Prévia */}
        <section className="space-y-4 xl:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 p-3 text-sm font-semibold">
              <div className="h-7 w-7 rounded-full bg-navy" />
              {brand.name}
              <span className="ml-auto text-xs font-normal text-ink-mute">Prévia</span>
            </div>
            {finals.length ? (
              <div className="flex snap-x snap-mandatory overflow-x-auto">
                {finals.map((m) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m.id} src={mediaPath(m.asset.storageKey)} alt="" className="w-full shrink-0 snap-center" />
                ))}
              </div>
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center bg-slate-100 text-sm text-ink-mute">Sem arte gerada</div>
            )}
            {finals.length > 1 && <div className="px-3 pt-2 text-xs text-ink-mute">{finals.length} slides — role para o lado</div>}
            {video && <video src={mediaPath(video.asset.storageKey)} controls className="w-full" />}
            <div className="whitespace-pre-line p-3 text-sm">{ig?.caption ?? fb?.caption ?? <span className="text-ink-mute">Sem legenda</span>}</div>
          </div>
          {validation && (
            <div className={`card p-4 text-sm ${validation.errors.length ? "border-red-200" : ""}`}>
              <div className="mb-2 font-semibold">Validação pré-publicação {validation.errors.length ? <span className="badge bg-red-100 text-red-800">com problemas</span> : <span className="badge bg-emerald-100 text-emerald-800">aprovada</span>}</div>
              {validation.errors.map((e) => <div key={e} className="text-red-700">• {e}</div>)}
              {validation.warnings.map((w) => <div key={w} className="text-amber-700">• {w}</div>)}
              {!validation.errors.length && !validation.warnings.length && <div className="text-ink-soft">Dimensões, formato, legibilidade, marca e dados comerciais verificados.</div>}
            </div>
          )}
          {post.approvalReasons.length > 0 && post.status === "PENDING_APPROVAL" && (
            <div className="card p-4 text-sm"><div className="mb-1 font-semibold">Por que precisa de aprovação</div>{post.approvalReasons.map((r) => <div key={r}>• {r}</div>)}</div>
          )}
          {post.offer && (
            <div className="card p-4 text-sm">
              <div className="font-semibold">Oferta vinculada</div>
              <div>{post.offer.operator} · {post.offer.speedMbps} Mega · {formatBRL(post.offer.priceCents)}{post.offer.pricePeriod}</div>
              <div className="text-xs text-ink-mute">Válida até {formatDate(post.offer.validUntil, brand.timezone)} · status {post.offer.status}</div>
            </div>
          )}
        </section>

        {/* Edição */}
        <section className="space-y-6 xl:col-span-3">
          {!locked && (
            <form action={regenerateAction} className="card space-y-3 p-5">
              <input type="hidden" name="id" value={post.id} />
              <h2 className="font-semibold">Gerar com IA</h2>
              <Field label="Instruções adicionais (opcional)"><textarea className="input min-h-16" name="instructions" placeholder="Ex.: foque em quem trabalha em home office; tom mais descontraído." /></Field>
              <Field label="Usar imagem da biblioteca como fundo (opcional)">
                <select name="backgroundAssetId" className="input" defaultValue="">
                  <option value="">— gerar/usar imagem da IA —</option>
                  {library.map((a) => <option key={a.id} value={a.id}>{a.title ?? a.originalName ?? a.id} ({a.role === "GENERATED" ? "IA" : a.role === "PHOTO" ? "foto" : "referência"})</option>)}
                </select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton name="mode" value="all" className="btn-primary" pendingText="Gerando (até 2 min)…">{post.title ? "Regerar tudo" : "Gerar conteúdo e arte"}</SubmitButton>
                {post.title && <SubmitButton name="mode" value="text" className="btn-ghost" pendingText="Gerando…">Só texto</SubmitButton>}
                {post.title && <SubmitButton name="mode" value="image" className="btn-ghost" pendingText="Gerando…">Nova imagem</SubmitButton>}
                {post.title && <SubmitButton name="mode" value="compose" className="btn-ghost" pendingText="Recompondo…">Aplicar fundo/recompor</SubmitButton>}
              </div>
            </form>
          )}

          {post.format === "REEL" && (
            <div className="card space-y-3 p-5">
              <h2 className="font-semibold">Reels</h2>
              {post.reelScript && <div className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm">{post.reelScript}</div>}
              <p className="text-xs text-ink-mute">O app não gera vídeo por IA. Grave a partir do roteiro, envie o vídeo (MP4, 9:16, até 90s) à biblioteca e vincule aqui. A arte acima é usada como capa.</p>
              {!locked && (
                <form action={attachVideoAction} className="flex gap-2">
                  <input type="hidden" name="id" value={post.id} />
                  <select name="videoId" className="input" required defaultValue={video?.assetId ?? ""}>
                    <option value="" disabled>Selecione um vídeo…</option>
                    {videos.map((v) => <option key={v.id} value={v.id}>{v.title ?? v.originalName}</option>)}
                  </select>
                  <SubmitButton className="btn-ghost">Vincular</SubmitButton>
                </form>
              )}
            </div>
          )}

          <form action={saveContentAction} className="card space-y-4 p-5">
            <input type="hidden" name="id" value={post.id} />
            <h2 className="font-semibold">Conteúdo</h2>
            <fieldset disabled={locked} className="space-y-4">
              <Field label="Tema"><input className="input" name="theme" defaultValue={post.theme} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Título da arte"><input className="input" name="title" defaultValue={post.title ?? ""} /></Field>
                <Field label="Chamada para ação"><input className="input" name="cta" defaultValue={post.cta ?? ""} /></Field>
              </div>
              <Field label="Texto secundário"><input className="input" name="subtitle" defaultValue={post.subtitle ?? ""} /></Field>
              <Field label="Layout">
                <select className="input" name="layout" defaultValue={post.layout ?? "hero-bottom"}>{LAYOUTS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}</select>
              </Field>
              {post.format === "CAROUSEL" && (
                <Field label="Slides (título na 1ª linha; separe slides com ---)">
                  <textarea className="input min-h-40 font-mono text-xs" name="slides" defaultValue={slides.map((s) => `${s.title}\n${s.body}`).join("\n---\n")} />
                </Field>
              )}
              {post.targets.map((t) => (
                <Field key={t.id} label={`Legenda ${NETWORK_LABEL[t.network]}`} hint={t.network === "INSTAGRAM" ? `${(t.caption ?? "").length}/2200 caracteres` : undefined}>
                  <textarea className="input min-h-36" name={`caption_${t.network}`} defaultValue={t.caption ?? ""} />
                </Field>
              ))}
              <Field label="Hashtags (sem #, separadas por vírgula)"><input className="input" name="hashtags" defaultValue={post.hashtags.join(", ")} /></Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton className="btn-primary">Salvar texto</SubmitButton>
                <SubmitButton className="btn-ghost" name="recompose" value="1" pendingText="Recompondo…">Salvar e recompor arte</SubmitButton>
              </div>
            </fieldset>
          </form>

          <form action={rescheduleAction} className="card flex flex-wrap items-end gap-3 p-5">
            <input type="hidden" name="id" value={post.id} />
            <Field label={`Data e hora (${brand.timezone})`}><input className="input" type="datetime-local" name="scheduledAt" defaultValue={toDatetimeLocal(post.scheduledAt, brand.timezone)} required disabled={locked} /></Field>
            <SubmitButton className="btn-ghost">Reagendar</SubmitButton>
          </form>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Destinos, resultado e tentativas</h2>
            <div className="space-y-4">
              {post.targets.map((t) => {
                const m = t.metrics[0];
                return (
                  <div key={t.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{NETWORK_LABEL[t.network]}</span>
                      <span className="badge bg-slate-100">{TARGET_STATUS_LABEL[t.status]}</span>
                      {t.socialAccount && <span className="text-xs text-ink-mute">{t.socialAccount.username ? `@${t.socialAccount.username}` : t.socialAccount.name}</span>}
                      {t.permalink && <a href={t.permalink} target="_blank" rel="noreferrer" className="text-xs text-accent">ver publicação ↗</a>}
                      {t.externalId && <span className="font-mono text-[11px] text-ink-mute">ID {t.externalId}</span>}
                      {admin && t.status === "FAILED" && !t.externalId && (
                        <form action={retryAction} className="ml-auto"><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="targetId" value={t.id} /><SubmitButton className="btn-ghost btn-sm">Tentar novamente</SubmitButton></form>
                      )}
                    </div>
                    {t.lastError && <div className="mt-1 text-xs text-red-700">{t.lastError}</div>}
                    {m && (
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm:grid-cols-7">
                        {([["Visualizações", m.views], ["Alcance", m.reach], ["Curtidas", m.likes], ["Comentários", m.comments], ["Compart.", m.shares], ["Salvos", m.saves], ["Cliques", m.clicks]] as const).map(([k, v]) => (
                          <div key={k} className="rounded-lg bg-slate-50 p-2"><div className="text-ink-mute">{k}</div><div className="font-semibold">{v ?? "—"}</div></div>
                        ))}
                      </div>
                    )}
                    {t.attemptsLog.length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-ink-soft">{t.attemptsLog.length} tentativa(s)</summary>
                        <ul className="mt-1 space-y-1">
                          {t.attemptsLog.map((a) => (
                            <li key={a.id} className={a.success ? "text-emerald-700" : "text-red-700"}>
                              {formatDateTime(a.startedAt, brand.timezone)} — {a.success ? "sucesso" : `falha ${a.errorCode ?? ""}: ${a.errorMessage ?? ""}`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            {post.links.length > 0 && <p className="mt-3 text-xs text-ink-mute">Cliques rastreados no WhatsApp: {post.links.reduce((a, l) => a + l._count.clicks, 0)}</p>}
          </div>

          <details className="card p-5 text-sm">
            <summary className="cursor-pointer font-semibold">Direção de arte e prompt interno</summary>
            <p className="mt-2"><span className="font-semibold">Objetivo:</span> {post.objective ?? "—"}</p>
            {post.episodeSummary && <p className="mt-2"><span className="font-semibold">Resumo do episódio (memória da série):</span> {post.episodeSummary}</p>}
            <p className="mt-2"><span className="font-semibold">Direção de arte:</span> {post.artDirection ?? "—"}</p>
            <p className="mt-2 font-mono text-xs text-ink-soft">{post.imagePrompt ?? "—"}</p>
            {background && <p className="mt-2 text-xs text-ink-mute">Fundo: {background.asset.source === "AI" ? "gerado por IA" : "biblioteca"} ({background.asset.width}×{background.asset.height})</p>}
            <p className="mt-2 text-xs text-ink-mute">Modelo: {post.aiModel ?? "—"} · Origem: {post.origin === "AI" ? "agente de IA" : "manual"}</p>
          </details>
        </section>
      </div>
    </div>
  );
}
