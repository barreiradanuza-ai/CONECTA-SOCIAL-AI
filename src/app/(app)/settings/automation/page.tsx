import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SettingsTabs } from "../tabs";
import { updateAutomationAction } from "../actions";
import { PILLARS, PILLAR_LABEL, FORMATS, FORMAT_LABEL } from "@/lib/labels";
import { DEFAULT_PILLAR_WEIGHTS } from "@/server/planner-core";
import { formatDateTime } from "@/lib/time";
import { ensureBrandDefaults } from "@/server/brand";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function AutomationPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { brand } = await requireBrand("ADMIN");
  const sp = await searchParams;
  await ensureBrandDefaults(brand.id);
  const s = await db.automationSettings.findUniqueOrThrow({ where: { brandId: brand.id } });
  const w = { ...DEFAULT_PILLAR_WEIGHTS, ...((s.pillarWeights ?? {}) as Record<string, number>) };

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Piloto automático: o agente planeja 30 dias, gera textos e imagens, agenda e publica — sem prompts diários." />
      <SettingsTabs current="automation" />
      <Flash {...sp} />
      <form action={updateAutomationAction} className="space-y-6">
        <section className="card grid gap-4 p-5 md:grid-cols-3">
          <label className="flex items-start gap-3 md:col-span-3">
            <input type="checkbox" name="autopilotEnabled" defaultChecked={s.autopilotEnabled} className="mt-1 h-5 w-5" />
            <span>
              <span className="font-semibold">Piloto automático ativo</span>
              <span className="block text-sm text-ink-soft">Mantém o calendário sempre com {s.planningHorizonDays} dias planejados e produz o conteúdo {s.productionLeadDays} dias antes de cada publicação.</span>
            </span>
          </label>
          <Field label="Modo de operação" hint="Supervisionado: tudo passa por aprovação. Automático: publica o que se enquadra nas regras abaixo.">
            <select name="mode" className="input" defaultValue={s.mode}>
              <option value="SUPERVISED">Supervisionado</option>
              <option value="AUTOMATIC">Automático</option>
            </select>
          </Field>
          <Field label="Horizonte de planejamento (dias)"><input className="input" name="planningHorizonDays" type="number" defaultValue={s.planningHorizonDays} /></Field>
          <Field label="Antecedência de produção (dias)"><input className="input" name="productionLeadDays" type="number" defaultValue={s.productionLeadDays} /></Field>
          <Field label="Gerações por ciclo (15 min)" hint="Controla o custo de IA."><input className="input" name="maxGenerationsPerRun" type="number" defaultValue={s.maxGenerationsPerRun} /></Field>
          <Field label="Pausar por (dias)" hint={s.pausedUntil ? `Pausado até ${formatDateTime(s.pausedUntil, brand.timezone)}` : "0 = sem pausa"}>
            <input className="input" name="pauseDays" type="number" defaultValue={0} />
            {s.pausedUntil && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="clearPause" /> retomar agora</label>}
          </Field>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Frequência e horários</h2>
          <div className="grid gap-4 md:grid-cols-5">
            <Field label="Feed Instagram/dia"><input className="input" name="igFeedPerDay" type="number" defaultValue={s.igFeedPerDay} /></Field>
            <Field label="Facebook/dia"><input className="input" name="fbFeedPerDay" type="number" defaultValue={s.fbFeedPerDay} /></Field>
            <Field label="Stories/dia"><input className="input" name="storiesPerDay" type="number" defaultValue={s.storiesPerDay} /></Field>
            <Field label="Reels/semana"><input className="input" name="reelsPerWeek" type="number" defaultValue={s.reelsPerWeek} /></Field>
            <Field label="Carrosséis/semana"><input className="input" name="carouselsPerWeek" type="number" defaultValue={s.carouselsPerWeek} /></Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Field label="Horários do feed" hint="HH:mm, separados por vírgula"><input className="input" name="feedTimes" defaultValue={s.feedTimes.join(", ")} /></Field>
            <Field label="Horários só Facebook"><input className="input" name="fbOnlyTimes" defaultValue={s.fbOnlyTimes.join(", ")} /></Field>
            <Field label="Horários dos stories"><input className="input" name="storyTimes" defaultValue={s.storyTimes.join(", ")} /></Field>
            <Field label="Horário dos Reels"><input className="input" name="reelTimes" defaultValue={s.reelTimes.join(", ")} /></Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="label mb-0">Dias de Reels:</span>
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-1"><input type="checkbox" name="reelWeekdays" value={i} defaultChecked={s.reelWeekdays.includes(i)} /> {d}</label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="storiesToFacebook" defaultChecked={s.storiesToFacebook} /> Publicar stories também no Facebook</label>
          <p className="mt-3 text-xs text-ink-mute">Feed com mesma quantidade no Instagram e Facebook vira uma publicação com legendas adaptadas para cada rede. Reels só entram no calendário quando há vídeos aprovados na biblioteca. Quando houver histórico suficiente, o horário do feed é ajustado automaticamente e o motivo aparece em cada publicação.</p>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold">Distribuição dos pilares editoriais</h2>
          <p className="mb-4 text-xs text-ink-mute">Pesos relativos. Ofertas só entram quando existem ofertas aprovadas e válidas.</p>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {PILLARS.map((p) => (
              <Field key={p} label={PILLAR_LABEL[p]}><input className="input" type="number" name={`w_${p}`} defaultValue={w[p]} /></Field>
            ))}
          </div>
        </section>

        <section className="card grid gap-6 p-5 md:grid-cols-2">
          <div>
            <h2 className="mb-2 font-semibold">Exigir aprovação humana para</h2>
            <p className="mb-3 text-xs text-ink-mute">No modo automático, o restante é publicado sem intervenção se passar em todas as validações.</p>
            <div className="grid gap-2">
              {PILLARS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" name="approvalPillars" value={p} defaultChecked={s.approvalRequiredPillars.includes(p)} /> {PILLAR_LABEL[p]}</label>
              ))}
              <hr className="my-1" />
              {FORMATS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" name="approvalFormats" value={f} defaultChecked={s.approvalRequiredFormats.includes(f)} /> Formato {FORMAT_LABEL[f]}</label>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="font-semibold">Alertas e limites</h2>
            <Field label="E-mail para alertas" hint="Requer RESEND_API_KEY no servidor."><input className="input" name="notifyEmail" type="email" defaultValue={s.notifyEmail ?? ""} /></Field>
            <Field label="Webhook de alertas" hint="Slack, Discord, Make, n8n… recebe JSON com o texto do alerta."><input className="input" name="notifyWebhookUrl" type="url" defaultValue={s.notifyWebhookUrl ?? ""} /></Field>
            <Field label="Máximo de hashtags no Instagram"><input className="input" name="maxHashtagsInstagram" type="number" defaultValue={s.maxHashtagsInstagram} /></Field>
          </div>
        </section>
        <SubmitButton>Salvar automação</SubmitButton>
      </form>
    </div>
  );
}
