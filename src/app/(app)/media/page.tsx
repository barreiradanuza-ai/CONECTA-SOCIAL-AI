import Link from "next/link";
import type { AssetRole, Prisma } from "@prisma/client";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, Empty, Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { uploadAssetAction, deleteAssetAction, toggleAssetApprovalAction } from "../settings/actions";
import { mediaPath } from "@/server/storage";

const FILTERS: { key: string; label: string; roles?: AssetRole[] }[] = [
  { key: "all", label: "Tudo" },
  { key: "LOGO", label: "Logotipos", roles: ["LOGO_PRIMARY", "LOGO_TRANSPARENT", "LOGO_ALT"] },
  { key: "PHOTO", label: "Fotografias", roles: ["PHOTO", "REFERENCE"] },
  { key: "CHARACTER", label: "Personagem", roles: ["CHARACTER_REFERENCE"] },
  { key: "GENERATED", label: "Imagens de IA", roles: ["GENERATED"] },
  { key: "COMPOSED", label: "Peças finais", roles: ["COMPOSED", "APPROVED_PIECE"] },
  { key: "VIDEO", label: "Vídeos", roles: ["VIDEO"] },
  { key: "OTHER", label: "Elementos e fontes", roles: ["GRAPHIC_ELEMENT", "FONT"] },
];

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ role?: string; ok?: string; error?: string }> }) {
  const { brand } = await requireBrand();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.role) ?? FILTERS[0];
  const where: Prisma.MediaAssetWhereInput = { brandId: brand.id };
  if (filter.roles) where.role = { in: filter.roles };
  const assets = await db.mediaAsset.findMany({ where, orderBy: { createdAt: "desc" }, take: 120, include: { _count: { select: { postMedia: true } } } });
  const back = `/media?role=${filter.key}`;

  return (
    <div>
      <PageHeader title="Biblioteca de mídia" subtitle="Logotipos, fotografias, vídeos, templates e peças aprovadas. Vídeos aprovados alimentam os Reels automáticos." />
      <Flash ok={sp.ok} error={sp.error} />
      <form action={uploadAssetAction} className="card mb-6 grid gap-3 p-4 sm:grid-cols-5 sm:items-end">
        <input type="hidden" name="back" value={back} />
        <Field label="Arquivos"><input type="file" name="files" multiple className="input" accept="image/*,video/mp4,video/quicktime,.ttf,.otf" /></Field>
        <Field label="Tipo">
          <select name="role" className="input" defaultValue="PHOTO">
            <option value="PHOTO">Fotografia</option>
            <option value="REFERENCE">Referência visual</option>
            <option value="CHARACTER_REFERENCE">Referência do personagem</option>
            <option value="APPROVED_PIECE">Peça aprovada</option>
            <option value="GRAPHIC_ELEMENT">Elemento gráfico</option>
            <option value="LOGO_TRANSPARENT">Logotipo (transparente)</option>
            <option value="LOGO_PRIMARY">Logotipo principal</option>
          </select>
        </Field>
        <Field label="Tags"><input name="tags" className="input" placeholder="família, home office" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="approved" /> Aprovado para uso automático</label>
        <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/media?role=${f.key}`} className={`rounded-full px-3 py-1.5 text-sm ${f.key === filter.key ? "bg-navy text-white" : "bg-white ring-1 ring-slate-200"}`}>{f.label}</Link>
        ))}
      </div>
      {assets.length === 0 ? (
        <Empty title="Nada por aqui ainda" />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((a) => (
            <li key={a.id} className="card overflow-hidden">
              {a.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaPath(a.storageKey)} alt={a.title ?? ""} className="aspect-square w-full bg-slate-100 object-contain" />
              ) : a.kind === "VIDEO" ? (
                <video src={mediaPath(a.storageKey)} className="aspect-square w-full bg-black object-contain" controls preload="metadata" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-slate-100 text-sm">{a.mimeType}</div>
              )}
              <div className="space-y-1 p-2 text-xs">
                <div className="truncate font-medium">{a.title ?? a.originalName}</div>
                <div className="text-ink-mute">{a.role} · {a.width && a.height ? `${a.width}×${a.height}` : ""} · {a._count.postMedia} uso(s)</div>
                <div className="flex gap-2">
                  <form action={toggleAssetApprovalAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value={back} /><button className={a.isApproved ? "text-emerald-700" : "text-accent"}>{a.isApproved ? "✓ aprovado" : "aprovar"}</button></form>
                  <a href={mediaPath(a.storageKey)} download className="text-accent">baixar</a>
                  <form action={deleteAssetAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value={back} /><SubmitButton className="text-red-600" confirm="Excluir este arquivo?">excluir</SubmitButton></form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
