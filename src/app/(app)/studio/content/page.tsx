import { requireBrand } from "@/lib/auth";
import { PageHeader, Flash, Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { IdeasPanel } from "./ideas";
import { createPostAction } from "../../posts/actions";
import { planCalendarAction } from "../../calendar/actions";
import { validOffers } from "@/server/brand";
import { PILLARS, PILLAR_LABEL, FORMATS, FORMAT_LABEL } from "@/lib/labels";
import { formatBRL } from "@/server/guard";
import { localDateKey, formatDate } from "@/lib/time";
import { db } from "@/lib/db";
import { addTrendAction, deleteTrendAction } from "./trend-actions";

export default async function ContentStudio({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; date?: string }> }) {
  const { brand } = await requireBrand("EDITOR");
  const sp = await searchParams;
  const offers = await validOffers(brand.id);
  const trends = await db.trendNote.findMany({ where: { brandId: brand.id, validUntil: { gte: new Date() } }, orderBy: { createdAt: "desc" } });
  const date = sp.date ?? localDateKey(new Date(Date.now() + 86400_000), brand.timezone);

  return (
    <div>
      <PageHeader title="AI Content Studio" subtitle="Ideias, legendas, títulos e planejamento editorial gerados pelo agente de IA." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <IdeasPanel defaultDate={date} />
          <form action={createPostAction} className="card space-y-4 p-5">
            <input type="hidden" name="back" value="/studio/content" />
            <h2 className="font-semibold">Criar publicação a partir de um tema</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pilar"><select name="pillar" className="input">{PILLARS.map((p) => <option key={p} value={p}>{PILLAR_LABEL[p]}</option>)}</select></Field>
              <Field label="Formato"><select name="format" className="input">{FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}</select></Field>
            </div>
            <Field label="Tema"><input name="theme" className="input" placeholder="Ex.: Como escolher a velocidade ideal para sua casa" required /></Field>
            <Field label="Objetivo (opcional)"><input name="objective" className="input" placeholder="Ex.: educar e gerar conversas no WhatsApp" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data e hora"><input type="datetime-local" name="scheduledAt" className="input" defaultValue={`${date}T12:00`} /></Field>
              <Field label="Oferta (somente para o pilar Ofertas)">
                <select name="offerId" className="input" defaultValue="">
                  <option value="">—</option>
                  {offers.map((o) => <option key={o.id} value={o.id}>{o.operator} {o.speedMbps} Mega · {formatBRL(o.priceCents)}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="networks" value="INSTAGRAM" defaultChecked /> Instagram</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="networks" value="FACEBOOK" defaultChecked /> Facebook</label>
            </div>
            <Field label="Instruções para a IA (opcional)"><textarea name="instructions" className="input min-h-16" /></Field>
            <input type="hidden" name="generate" value="1" />
            <SubmitButton pendingText="Gerando texto e arte (até 2 min)…">Criar e gerar com IA</SubmitButton>
          </form>
        </div>
        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold">Pautas da internet (verificadas)</h2>
            <p className="mt-1 text-sm text-ink-soft">O agente só cita acontecimentos reais, trends e virais que você cadastrar aqui. Sem pautas, usa situações cotidianas genéricas.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {trends.map((t) => (
                <li key={t.id} className="rounded-lg bg-slate-50 p-2">
                  <div>{t.text}</div>
                  <div className="mt-1 flex justify-between text-[11px] text-ink-mute">
                    <span>até {formatDate(t.validUntil, brand.timezone)}{t.sourceUrl ? " · fonte" : ""}</span>
                    <form action={deleteTrendAction}><input type="hidden" name="id" value={t.id} /><button className="text-red-600">remover</button></form>
                  </div>
                </li>
              ))}
            </ul>
            <form action={addTrendAction} className="mt-3 space-y-2">
              <textarea name="text" className="input min-h-16" placeholder="Ex.: trend de áudios “plot twist” está em alta no Reels esta semana" required />
              <input name="sourceUrl" className="input" placeholder="Link da fonte (opcional)" />
              <div className="flex gap-2"><select name="days" className="input" defaultValue="7">{[3, 7, 14, 30].map((d) => <option key={d} value={d}>válida por {d} dias</option>)}</select><SubmitButton className="btn-ghost">Adicionar</SubmitButton></div>
            </form>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Planejamento automático</h2>
            <p className="mt-1 text-sm text-ink-soft">O agente preenche os próximos 30 dias respeitando frequência, horários, pilares, datas comemorativas e ofertas válidas. Com o piloto automático ligado, isso é renovado continuamente.</p>
            <form action={planCalendarAction} className="mt-3"><SubmitButton pendingText="Planejando…">Planejar próximos 30 dias</SubmitButton></form>
          </div>
          <div className="card p-5 text-sm">
            <h2 className="font-semibold">Ofertas válidas hoje</h2>
            {offers.length === 0 ? (
              <p className="mt-1 text-ink-soft">Nenhuma oferta aprovada e vigente. O pilar Ofertas fica fora do planejamento até que haja uma.</p>
            ) : (
              <ul className="mt-2 space-y-1">{offers.map((o) => <li key={o.id}>{o.operator} · {o.speedMbps} Mega · {formatBRL(o.priceCents)}{o.pricePeriod}</li>)}</ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
