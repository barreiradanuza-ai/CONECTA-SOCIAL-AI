import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SettingsTabs } from "../tabs";
import { updateBrandAction, uploadAssetAction, deleteAssetAction } from "../actions";
import { mediaPath } from "@/server/storage";
import { normalizeColors } from "@/server/creative/color";

const ROLE_LABEL: Record<string, string> = {
  LOGO_PRIMARY: "Logotipo principal",
  LOGO_TRANSPARENT: "Logotipo fundo transparente",
  LOGO_ALT: "Logotipo alternativo",
  GRAPHIC_ELEMENT: "Elemento gráfico",
  REFERENCE: "Imagem de referência",
  APPROVED_PIECE: "Peça aprovada / exemplo",
  CHARACTER_REFERENCE: "Referência do personagem",
  FONT: "Fonte",
};

export default async function BrandSettings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { brand } = await requireBrand("ADMIN");
  const sp = await searchParams;
  const colors = normalizeColors(brand.colors);
  const assets = await db.mediaAsset.findMany({
    where: { brandId: brand.id, role: { in: ["LOGO_PRIMARY", "LOGO_TRANSPARENT", "LOGO_ALT", "GRAPHIC_ELEMENT", "REFERENCE", "APPROVED_PIECE", "FONT", "CHARACTER_REFERENCE"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Configurações" subtitle={`Identidade visual de ${brand.name}. A IA usa estes materiais como referência e nunca cria ou altera logotipos.`} />
      <SettingsTabs current="brand" />
      <Flash {...sp} />

      <div className="grid gap-6 lg:grid-cols-3">
        <form action={updateBrandAction} className="card space-y-4 p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><input className="input" name="name" defaultValue={brand.name} required /></Field>
            <Field label="Site"><input className="input" name="website" defaultValue={brand.website ?? ""} /></Field>
            <Field label="Slogan"><input className="input" name="slogan" defaultValue={brand.slogan ?? ""} /></Field>
            <Field label="Fuso horário"><input className="input" name="timezone" defaultValue={brand.timezone} /></Field>
          </div>
          <Field label="Descrição da empresa"><textarea className="input min-h-20" name="description" defaultValue={brand.description ?? ""} /></Field>
          <Field label="Posicionamento"><textarea className="input min-h-20" name="positioning" defaultValue={brand.positioning ?? ""} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tom de voz"><textarea className="input min-h-20" name="toneOfVoice" defaultValue={brand.toneOfVoice ?? ""} /></Field>
            <Field label="Público-alvo"><textarea className="input min-h-20" name="targetAudience" defaultValue={brand.targetAudience ?? ""} /></Field>
          </div>
          <Field label="Pilares de comunicação (um por linha)"><textarea className="input min-h-28" name="communicationPillars" defaultValue={brand.communicationPillars.join("\n")} /></Field>
          <Field label="Diretrizes visuais"><textarea className="input min-h-20" name="visualGuidelines" defaultValue={brand.visualGuidelines ?? ""} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Termos proibidos (um por linha)"><textarea className="input min-h-20" name="forbiddenTerms" defaultValue={brand.forbiddenTerms.join("\n")} /></Field>
            <Field label="Hashtags padrão"><textarea className="input min-h-20" name="defaultHashtags" defaultValue={brand.defaultHashtags.join("\n")} /></Field>
          </div>

          <div>
            <div className="label">Cores institucionais</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(["primary", "secondary", "accent", "background", "text"] as const).map((k) => (
                <div key={k}>
                  <div className="mb-1 h-10 rounded-lg border border-slate-200" style={{ background: colors[k] }} />
                  <input className="input font-mono text-xs" name={`color_${k}`} defaultValue={colors[k]} aria-label={k} />
                  <div className="mt-0.5 text-[11px] text-ink-mute">{{ primary: "Primária", secondary: "Secundária", accent: "Destaque/CTA", background: "Fundo claro", text: "Texto" }[k]}</div>
                </div>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" name="colorsConfirmed" defaultChecked={brand.colorsConfirmed} /> Confirmo que estas são as cores oficiais da marca
            </label>
            {!brand.colorsConfirmed && <p className="mt-1 text-xs text-amber-700">A cor primária #071b45 foi extraída do site oficial; as demais são provisórias até você confirmar.</p>}
          </div>
          <fieldset className="space-y-4 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/40 p-4">
            <legend className="px-2 text-sm font-semibold">Personagem da marca</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="personaEnabled" defaultChecked={brand.personaEnabled} className="mt-1" />
              <span>Usar o personagem: habilita o pilar “Universo do personagem” (mini-novelas em 7 atos) e a voz dele nos demais conteúdos.</span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do personagem"><input className="input" name="personaName" defaultValue={brand.personaName ?? ""} placeholder="Ainda sem nome" /></Field>
              <Field label="Nome da série (opcional)"><input className="input" name="seriesTitle" defaultValue={brand.seriesTitle ?? ""} /></Field>
            </div>
            <Field label="Bíblia do personagem" hint="Personalidade, humor, suspense, relação com a marca, formato dos episódios. O agente de IA segue este texto.">
              <textarea className="input min-h-48 font-mono text-xs" name="personaBible" defaultValue={brand.personaBible ?? ""} />
            </Field>
            <Field label="Aparência (para as imagens)" hint="Descreva idade aparente, cabelo, estilo de roupa, acessórios. Envie também imagens oficiais em “Referência do personagem” para manter o mesmo rosto em todos os episódios.">
              <textarea className="input min-h-16" name="personaVisual" defaultValue={brand.personaVisual ?? ""} />
            </Field>
          </fieldset>
          <SubmitButton>Salvar identidade</SubmitButton>
        </form>

        <div className="space-y-6">
          <form action={uploadAssetAction} className="card space-y-3 p-5">
            <input type="hidden" name="back" value="/settings/brand" />
            <h2 className="font-semibold">Enviar materiais da marca</h2>
            <Field label="Tipo">
              <select name="role" className="input" defaultValue="LOGO_TRANSPARENT">
                {Object.entries(ROLE_LABEL).filter(([k]) => k !== "FONT").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Arquivos" hint="PNG/SVG para logotipos (preferir fundo transparente). TTF/OTF para fontes.">
              <input className="input" type="file" name="files" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml,.ttf,.otf" />
            </Field>
            <Field label="Se for fonte, usar em">
              <select name="fontSlot" className="input"><option value="heading">Títulos</option><option value="body">Textos</option></select>
            </Field>
            <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
          </form>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Materiais cadastrados</h2>
            {assets.length === 0 && <p className="text-sm text-ink-soft">Nenhum material. Envie ao menos o logotipo com fundo transparente.</p>}
            <ul className="grid grid-cols-2 gap-3">
              {assets.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-200 p-2">
                  {a.kind === "IMAGE" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaPath(a.storageKey)} alt={a.title ?? ""} className="h-20 w-full rounded-lg bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] object-contain" />
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-lg bg-slate-100 text-xs">
                      {a.id === brand.fontHeadingAssetId ? "Fonte de títulos" : a.id === brand.fontBodyAssetId ? "Fonte de textos" : "Fonte"}
                    </div>
                  )}
                  <div className="mt-1 truncate text-[11px] font-semibold">{ROLE_LABEL[a.role] ?? a.role}</div>
                  <form action={deleteAssetAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="back" value="/settings/brand" />
                    <SubmitButton className="text-[11px] text-red-600 hover:underline" confirm="Remover este arquivo?">remover</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
