"use client";
import { useActionState } from "react";
import { generateIdeasAction, type IdeasState } from "./actions";
import { createPostAction } from "../../posts/actions";
import { SubmitButton } from "@/components/client";
import { PILLAR_LABEL, FORMAT_LABEL, PILLARS } from "@/lib/labels";

export function IdeasPanel({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState<IdeasState, FormData>(generateIdeasAction, { ideas: [] });
  return (
    <div className="card p-5">
      <h2 className="font-semibold">Ideias de conteúdo com IA</h2>
      <p className="mb-4 text-sm text-ink-soft">O agente considera a identidade da marca, o histórico e os aprendizados de desempenho.</p>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <select name="pillar" className="input" defaultValue="">
          <option value="">Todos os pilares</option>
          {PILLARS.map((p) => <option key={p} value={p}>{PILLAR_LABEL[p]}</option>)}
        </select>
        <select name="count" className="input" defaultValue="6">{[3, 6, 9, 12].map((n) => <option key={n} value={n}>{n} ideias</option>)}</select>
        <input name="hint" className="input" placeholder="Direcionamento (opcional)" />
        <button className="btn-primary" disabled={pending}>{pending ? "Gerando…" : "Gerar ideias"}</button>
      </form>
      {state.error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.ideas.length > 0 && (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {state.ideas.map((i, idx) => (
            <li key={idx} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap gap-1 text-[11px]">
                <span className="badge bg-slate-100">{PILLAR_LABEL[i.pillar]}</span>
                <span className="badge bg-slate-100">{FORMAT_LABEL[i.format]}</span>
              </div>
              <div className="mt-1 font-semibold">{i.hook}</div>
              <div className="text-sm text-ink-soft">{i.theme}</div>
              <div className="mt-1 text-xs text-ink-mute">Objetivo: {i.objective}</div>
              <form action={createPostAction} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="theme" value={i.theme} />
                <input type="hidden" name="objective" value={i.objective} />
                <input type="hidden" name="pillar" value={i.pillar} />
                <input type="hidden" name="format" value={i.format} />
                <input type="hidden" name="networks" value="INSTAGRAM" />
                {i.format !== "STORY" && <input type="hidden" name="networks" value="FACEBOOK" />}
                <input type="hidden" name="generate" value="1" />
                <input type="datetime-local" name="scheduledAt" className="input w-auto py-1 text-xs" defaultValue={`${defaultDate}T12:00`} />
                <SubmitButton className="btn-accent btn-sm" pendingText="Criando (até 2 min)…">Criar publicação</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
