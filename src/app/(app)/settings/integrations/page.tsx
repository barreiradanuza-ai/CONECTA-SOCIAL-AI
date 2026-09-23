import { requireAuth } from "@/lib/auth";
import { PageHeader, Flash, IntegrationState } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SettingsTabs } from "../tabs";
import { setSecretAction } from "../actions";
import { secretStatus } from "@/server/integrations";
import { env } from "@/lib/env";
import { metaConfigured, redirectUri } from "@/server/meta/oauth";
import { storageDriver } from "@/server/storage";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const auth = await requireAuth("ADMIN");
  const sp = await searchParams;
  const secrets = await secretStatus(auth.orgId);

  return (
    <div>
      <PageHeader title="Configurações" subtitle="As chaves ficam criptografadas (AES-256-GCM) no servidor e nunca são enviadas ao navegador." />
      <SettingsTabs current="integrations" />
      <Flash {...sp} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          {secrets.map((s) => (
            <form key={s.key} action={setSecretAction} className="card space-y-3 p-5">
              <input type="hidden" name="key" value={s.key} />
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{s.label}</h2>
                <IntegrationState state={s.source ? "ok" : "missing"} />
              </div>
              <p className="text-xs text-ink-mute">{s.source ? `Chave configurada (${s.source}). Digite uma nova para substituir.` : "Nenhuma chave configurada."}</p>
              <input className="input font-mono" name="value" type="password" autoComplete="off" placeholder={s.key} />
              <div className="flex gap-2">
                <SubmitButton className="btn-primary btn-sm">Salvar</SubmitButton>
                {s.source === "painel" && <SubmitButton className="btn-danger btn-sm" name="remove" value="1">Remover</SubmitButton>}
              </div>
            </form>
          ))}
        </section>
        <section className="card space-y-3 p-5 text-sm">
          <h2 className="font-semibold">Configuração do servidor</h2>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
            <dt>App Meta (META_APP_ID/SECRET)</dt><dd><IntegrationState state={metaConfigured() ? "ok" : "missing"} /></dd>
            <dt>Graph API</dt><dd className="font-mono text-xs">{env.meta.graphVersion}</dd>
            <dt>Modelo de texto</dt><dd className="font-mono text-xs">{env.ai.anthropicModel}</dd>
            <dt>Modelo de imagem</dt><dd className="font-mono text-xs">{env.ai.openaiImageModel} ({env.ai.openaiImageQuality})</dd>
            <dt>Armazenamento</dt><dd>{storageDriver() === "s3" ? "Bucket S3" : "Disco local"}</dd>
            <dt>URL pública do app</dt><dd className="break-all font-mono text-xs">{env.appUrl}</dd>
          </dl>
          <p className="text-xs text-ink-mute">URL de redirecionamento OAuth para cadastrar no app da Meta: <code className="break-all">{redirectUri()}</code></p>
          <p className="text-xs text-ink-mute">A Meta baixa as imagens a partir da URL pública do app; em produção ela precisa ser HTTPS e acessível pela internet.</p>
        </section>
      </div>
    </div>
  );
}
