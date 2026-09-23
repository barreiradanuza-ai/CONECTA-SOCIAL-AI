import Link from "next/link";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { composeStudioAction, saveTemplateAction, deleteTemplateAction } from "./actions";
import { toggleAssetApprovalAction, deleteAssetAction } from "../../settings/actions";
import { validOffers } from "@/server/brand";
import { mediaPath } from "@/server/storage";
import { formatBRL } from "@/server/guard";
import { formatDateTime } from "@/lib/time";

const LAYOUTS = [
  { v: "hero-bottom", l: "Foto com título sobreposto" },
  { v: "split-panel", l: "Foto + painel da marca" },
  { v: "question-card", l: "Pergunta em destaque" },
  { v: "offer", l: "Oferta (dados da oferta cadastrada)" },
];

export default async function CreativeStudio({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; tpl?: string }> }) {
  const { brand } = await requireBrand("EDITOR");
  const sp = await searchParams;
  const [offers, library, recent, templates] = await Promise.all([
    validOffers(brand.id),
    db.mediaAsset.findMany({ where: { brandId: brand.id, kind: "IMAGE", role: { in: ["PHOTO", "GENERATED", "REFERENCE"] } }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.mediaAsset.findMany({ where: { brandId: brand.id, role: "COMPOSED", tags: { has: "studio" } }, orderBy: { createdAt: "desc" }, take: 24 }),
    db.template.findMany({ where: { brandId: brand.id, isActive: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const tpl = templates.find((t) => t.id === sp.tpl);
  const cfg = (tpl?.config ?? {}) as { creativeFormat?: string; cta?: string; subtitle?: string; prompt?: string };

  return (
    <div>
      <PageHeader title="AI Creative Studio" subtitle="A IA cria a fotografia; o motor de composição aplica textos, logotipo, preço e CTA com ortografia e números exatos." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 lg:grid-cols-5">
        <form action={composeStudioAction} className="card space-y-4 p-5 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Formato">
              <select name="format" className="input" defaultValue={cfg.creativeFormat ?? "FEED"}>
                <option value="FEED">Feed 4:5 (1080×1350)</option>
                <option value="SQUARE">Feed 1:1 (1080×1080)</option>
                <option value="STORY">Stories/Reels 9:16 (1080×1920)</option>
              </select>
            </Field>
            <Field label="Layout">
              <select name="layout" className="input" defaultValue={tpl?.layout ?? "hero-bottom"}>{LAYOUTS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}</select>
            </Field>
          </div>
          <Field label="Título"><input name="title" className="input" required maxLength={80} /></Field>
          <Field label="Texto secundário"><input name="subtitle" className="input" maxLength={140} defaultValue={cfg.subtitle} /></Field>
          <Field label="Chamada para ação"><input name="cta" className="input" maxLength={40} defaultValue={cfg.cta ?? "Fale com um especialista"} /></Field>
          <Field label="Oferta (para layout Oferta)">
            <select name="offerId" className="input" defaultValue="">
              <option value="">—</option>
              {offers.map((o) => <option key={o.id} value={o.id}>{o.operator} {o.speedMbps} Mega · {formatBRL(o.priceCents)}</option>)}
            </select>
          </Field>
          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-ink-soft">Fundo</legend>
            <Field label="Descrição para a IA gerar a imagem" hint="Sem texto na imagem — os textos entram pela composição.">
              <textarea name="prompt" className="input min-h-16" defaultValue={cfg.prompt} placeholder="Família brasileira na sala assistindo streaming, luz natural, moderno" />
            </Field>
            <Field label="ou imagem da biblioteca">
              <select name="backgroundAssetId" className="input" defaultValue="">
                <option value="">—</option>
                {library.map((a) => <option key={a.id} value={a.id}>{a.title ?? a.originalName ?? a.id}</option>)}
              </select>
            </Field>
            <Field label="ou enviar imagem"><input type="file" name="upload" accept="image/*" className="input" /></Field>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Variações"><select name="variations" className="input" defaultValue="1">{[1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></Field>
            <Field label="Variar">
              <select name="variationMode" className="input" defaultValue="layouts"><option value="layouts">Layouts</option><option value="images">Imagens (IA)</option></select>
            </Field>
          </div>
          <Field label="Carrossel (opcional): um slide por bloco — título na 1ª linha, texto abaixo, separados por ---">
            <textarea name="slides" className="input min-h-24 font-mono text-xs" placeholder={"300 Mega\nIdeal para casal com streaming e home office.\n---\n500 Mega\nFamílias com vários dispositivos."} />
          </Field>
          <SubmitButton pendingText="Criando peças…">Criar peças</SubmitButton>
        </form>

        <div className="space-y-6 lg:col-span-3">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Peças recentes</h2><Link href="/media?role=COMPOSED" className="text-sm text-accent">Biblioteca</Link></div>
            {recent.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhuma peça criada ainda.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {recent.map((a) => (
                  <li key={a.id} className="rounded-xl border border-slate-200 p-2">
                    <a href={mediaPath(a.storageKey)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaPath(a.storageKey)} alt={a.title ?? ""} className="w-full rounded-lg" />
                    </a>
                    <div className="mt-1 truncate text-xs font-medium">{a.title}</div>
                    <div className="text-[11px] text-ink-mute">{a.width}×{a.height} · {formatDateTime(a.createdAt, brand.timezone)}</div>
                    <div className="mt-1 flex gap-2 text-[11px]">
                      <a href={mediaPath(a.storageKey)} download className="text-accent">baixar</a>
                      <form action={toggleAssetApprovalAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value="/studio/creative" /><button className="text-accent">{a.isApproved ? "✓ aprovada" : "aprovar"}</button></form>
                      <form action={deleteAssetAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value="/studio/creative" /><button className="text-red-600">excluir</button></form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Templates reutilizáveis</h2>
            <ul className="mb-4 flex flex-wrap gap-2">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-1 rounded-full border border-slate-200 py-1 pl-3 pr-1 text-sm">
                  <Link href={`/studio/creative?tpl=${t.id}`} className={t.id === tpl?.id ? "font-semibold text-accent" : ""}>{t.name}</Link>
                  <form action={deleteTemplateAction}><input type="hidden" name="id" value={t.id} /><button className="px-2 text-ink-mute hover:text-red-600" aria-label="remover">×</button></form>
                </li>
              ))}
              {templates.length === 0 && <li className="text-sm text-ink-soft">Nenhum template salvo.</li>}
            </ul>
            <form action={saveTemplateAction} className="grid gap-2 sm:grid-cols-5">
              <input name="name" className="input sm:col-span-2" placeholder="Nome do template" required />
              <select name="format" className="input"><option value="FEED">Feed</option><option value="SQUARE">1:1</option><option value="STORY">Story</option></select>
              <select name="layout" className="input">{LAYOUTS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}</select>
              <input name="cta" className="input" placeholder="CTA padrão" />
              <input name="subtitle" className="input sm:col-span-2" placeholder="Texto secundário padrão (opcional)" />
              <input name="prompt" className="input sm:col-span-2" placeholder="Estilo de imagem padrão (opcional)" />
              <SubmitButton className="btn-ghost">Salvar template</SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
