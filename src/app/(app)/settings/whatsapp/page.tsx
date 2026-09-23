import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SettingsTabs } from "../tabs";
import { updateWhatsappAction, createCampaignLinkAction } from "../actions";
import { ensureBrandDefaults } from "@/server/brand";
import { trackingUrl, waMeLink } from "@/server/whatsapp";
import { formatDate } from "@/lib/time";

export default async function WhatsappPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { brand } = await requireBrand("ADMIN");
  const sp = await searchParams;
  await ensureBrandDefaults(brand.id);
  const w = await db.whatsAppConfig.findUniqueOrThrow({ where: { brandId: brand.id } });
  const links = await db.trackingLink.findMany({
    where: { brandId: brand.id, postId: null },
    include: { campaign: true, _count: { select: { clicks: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Transforme interesse em conversas: links rastreáveis por publicação e campanha, com página intermediária própria." />
      <SettingsTabs current="whatsapp" />
      <Flash {...sp} />
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={updateWhatsappAction} className="card space-y-4 p-5">
          <Field label="Número de atendimento (DDI+DDD+número)"><input className="input" name="phoneE164" defaultValue={w.phoneE164 ?? ""} placeholder="5511999998888" /></Field>
          <Field label="Mensagem inicial"><textarea className="input min-h-20" name="defaultMessage" defaultValue={w.defaultMessage} /></Field>
          <Field label="Chamada para ação usada nas legendas"><textarea className="input min-h-16" name="ctaText" defaultValue={w.ctaText} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="utm_source"><input className="input" name="utmSource" defaultValue={w.utmSource} /></Field>
            <Field label="utm_medium"><input className="input" name="utmMedium" defaultValue={w.utmMedium} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="landingEnabled" defaultChecked={w.landingEnabled} /> Mostrar página intermediária (aviso de privacidade) antes do WhatsApp</label>
          <Field label="Webhook do CRM (futuro: Data Crazy)" hint="Opcional. Recebe um JSON a cada clique em “Continuar para o WhatsApp”, com código de origem, sem dados pessoais."><input className="input" name="crmWebhookUrl" type="url" defaultValue={w.crmWebhookUrl ?? ""} /></Field>
          <SubmitButton>Salvar</SubmitButton>
          {w.phoneE164 && <p className="break-all text-xs text-ink-mute">Link direto: {waMeLink(w.phoneE164, w.defaultMessage)}</p>}
        </form>

        <div className="space-y-6">
          <form action={createCampaignLinkAction} className="card space-y-3 p-5">
            <h2 className="font-semibold">Novo link de campanha</h2>
            <Field label="Campanha"><input className="input" name="campaign" placeholder="Ex.: Volta às aulas 2027" required /></Field>
            <Field label="Rótulo"><input className="input" name="label" placeholder="Ex.: bio, anúncio, QR code" /></Field>
            <Field label="Mensagem inicial específica (opcional)"><input className="input" name="message" /></Field>
            <SubmitButton>Gerar link</SubmitButton>
          </form>
          <div className="card overflow-x-auto p-2">
            <table className="table">
              <thead><tr><th>Link</th><th>Campanha</th><th>Cliques</th><th>Criado</th></tr></thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id}>
                    <td className="break-all font-mono text-xs">{trackingUrl(l.code)}<div className="font-sans text-ink-mute">{l.label}</div></td>
                    <td className="text-sm">{l.campaign?.name ?? "—"}</td>
                    <td>{l._count.clicks}</td>
                    <td className="text-xs">{formatDate(l.createdAt)}</td>
                  </tr>
                ))}
                {links.length === 0 && <tr><td colSpan={4} className="text-sm text-ink-soft">O link da bio é criado automaticamente na primeira publicação.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-mute">Atribuição: contamos cliques nos links e cliques em “Continuar para o WhatsApp”. A mensagem enviada inclui um código de referência (ref) que o atendimento/CRM pode registrar. Vendas só podem ser atribuídas a uma publicação quando o CRM confirmar esse código — o app não presume conversões.</p>
        </div>
      </div>
    </div>
  );
}
