import Link from "next/link";
import { requireBrand, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, Field, Empty } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { saveOfferAction, setOfferStatusAction } from "./actions";
import { formatBRL, isOfferValid } from "@/server/guard";
import { formatDate, localDateKey } from "@/lib/time";

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; edit?: string }> }) {
  const { auth, brand } = await requireBrand();
  const sp = await searchParams;
  const offers = await db.offer.findMany({ where: { brandId: brand.id }, orderBy: [{ status: "asc" }, { validUntil: "desc" }], include: { _count: { select: { posts: true } } } });
  const edit = offers.find((o) => o.id === sp.edit);
  const tz = brand.timezone;
  const admin = hasRole(auth, "ADMIN");

  return (
    <div>
      <PageHeader title="Ofertas comerciais" subtitle="Única fonte de preços, velocidades e benefícios usados nas publicações. A IA nunca inventa dados comerciais." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {offers.length === 0 ? (
            <Empty title="Nenhuma oferta cadastrada">Sem ofertas aprovadas e válidas, o pilar Ofertas não é planejado.</Empty>
          ) : (
            <ul className="space-y-3">
              {offers.map((o) => {
                const valid = isOfferValid(o);
                return (
                  <li key={o.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{o.operator}{o.planName ? ` — ${o.planName}` : ""}</div>
                        <div className="text-lg font-bold">{o.speedMbps} Mega · {formatBRL(o.priceCents)}<span className="text-sm font-normal">{o.pricePeriod}</span></div>
                        <div className="text-xs text-ink-mute">Validade: {formatDate(o.validFrom, tz)} a {formatDate(o.validUntil, tz)} · {o._count.posts} publicação(ões)</div>
                      </div>
                      <span className={`badge ${o.status === "APPROVED" ? (valid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900") : o.status === "ARCHIVED" ? "bg-slate-100 text-slate-500" : "bg-slate-200"}`}>
                        {o.status === "APPROVED" ? (valid ? "Aprovada e vigente" : "Aprovada, fora da validade") : o.status === "ARCHIVED" ? "Arquivada" : "Rascunho"}
                      </span>
                    </div>
                    {o.benefits.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{o.benefits.map((b) => <li key={b}>{b}</li>)}</ul>}
                    <div className="mt-2 text-xs text-ink-soft">
                      {o.regions.length > 0 && <div>Regiões: {o.regions.join(", ")}</div>}
                      {o.conditions && <div>Condições: {o.conditions}</div>}
                      {o.restrictions && <div>Restrições: {o.restrictions}</div>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/offers?edit=${o.id}`} className="btn-ghost btn-sm">Editar</Link>
                      {admin && o.status !== "APPROVED" && (
                        <form action={setOfferStatusAction}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="APPROVED" /><SubmitButton className="btn-accent btn-sm" confirm="Confirmo que preço, benefícios, condições e validade estão corretos e autorizados.">Aprovar</SubmitButton></form>
                      )}
                      {admin && o.status !== "ARCHIVED" && (
                        <form action={setOfferStatusAction}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="ARCHIVED" /><SubmitButton className="btn-danger btn-sm">Arquivar</SubmitButton></form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <form action={saveOfferAction} className="card space-y-3 p-5 lg:col-span-2">
          <h2 className="font-semibold">{edit ? "Editar oferta" : "Nova oferta"}</h2>
          {edit && <input type="hidden" name="id" value={edit.id} />}
          <Field label="Operadora"><input className="input" name="operator" defaultValue={edit?.operator} required /></Field>
          <Field label="Nome do plano (opcional)"><input className="input" name="planName" defaultValue={edit?.planName ?? ""} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Velocidade (Mega)"><input className="input" name="speedMbps" type="number" defaultValue={edit?.speedMbps} required /></Field>
            <Field label="Preço (R$)"><input className="input" name="price" placeholder="99,90" defaultValue={edit ? (edit.priceCents / 100).toFixed(2).replace(".", ",") : ""} required /></Field>
            <Field label="Período"><input className="input" name="pricePeriod" defaultValue={edit?.pricePeriod ?? "/mês"} /></Field>
          </div>
          <Field label="Benefícios (um por linha)"><textarea className="input min-h-20" name="benefits" defaultValue={edit?.benefits.join("\n")} /></Field>
          <Field label="Condições comerciais"><textarea className="input min-h-16" name="conditions" defaultValue={edit?.conditions ?? ""} /></Field>
          <Field label="Regiões de disponibilidade (uma por linha)"><textarea className="input min-h-16" name="regions" defaultValue={edit?.regions.join("\n")} /></Field>
          <Field label="Restrições aplicáveis"><textarea className="input min-h-16" name="restrictions" defaultValue={edit?.restrictions ?? ""} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Válida de"><input className="input" type="date" name="validFrom" defaultValue={edit ? localDateKey(edit.validFrom, tz) : localDateKey(new Date(), tz)} required /></Field>
            <Field label="Válida até"><input className="input" type="date" name="validUntil" defaultValue={edit ? localDateKey(edit.validUntil, tz) : ""} required /></Field>
          </div>
          <SubmitButton>{edit ? "Salvar (volta para rascunho)" : "Cadastrar"}</SubmitButton>
        </form>
      </div>
    </div>
  );
}
