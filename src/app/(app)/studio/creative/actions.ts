"use server";
import type { PostFormat } from "@prisma/client";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { runAction, str, int } from "@/lib/actions";
import { generateImage } from "@/server/ai/images";
import { loadBrandKit, prepareBackground, renderCreative } from "@/server/creative/composer";
import { FORMAT_SPEC, type CreativeFormat } from "@/server/creative/formats";
import { validateImage } from "@/server/creative/validate";
import { saveAsset } from "@/server/media";
import { getObject } from "@/server/storage";
import { formatBRL, isOfferValid } from "@/server/guard";
import { formatDate } from "@/lib/time";
import { audit } from "@/server/audit";

const LAYOUT_ROTATION = ["hero-bottom", "split-panel", "question-card"];

export async function composeStudioAction(form: FormData) {
  const { auth, brand } = await requireBrand("EDITOR");
  return runAction("/studio/creative", async () => {
    const format = (str(form, "format") || "FEED") as CreativeFormat;
    const spec = FORMAT_SPEC[format];
    if (!spec) throw new Error("Formato inválido.");
    const layout = str(form, "layout") || "hero-bottom";
    const variations = int(form, "variations", 1, 1, 3);
    const title = str(form, "title");
    if (!title) throw new Error("Informe o título da peça.");
    const kit = await loadBrandKit(brand);

    // Oferta: somente aprovada e válida
    let offerView = null;
    if (layout === "offer") {
      const offer = await db.offer.findFirst({ where: { id: str(form, "offerId"), brandId: brand.id } });
      if (!offer || !isOfferValid(offer)) throw new Error("Selecione uma oferta aprovada e dentro da validade.");
      offerView = {
        operator: offer.operator,
        speed: String(offer.speedMbps),
        price: formatBRL(offer.priceCents),
        period: offer.pricePeriod,
        benefits: offer.benefits,
        footnote: `Oferta válida até ${formatDate(offer.validUntil, brand.timezone)}. ${offer.restrictions ? offer.restrictions + " " : ""}Consulte a disponibilidade para seu endereço.`,
      };
    }

    // Fundo: upload, biblioteca ou IA
    const backgrounds: Buffer[] = [];
    const upload = form.get("upload");
    const libraryId = str(form, "backgroundAssetId");
    const prompt = str(form, "prompt");
    if (upload instanceof File && upload.size > 0) {
      const buf = Buffer.from(await upload.arrayBuffer());
      await saveAsset({ orgId: auth.orgId, brandId: brand.id, buffer: buf, mimeType: upload.type || "image/jpeg", kind: "IMAGE", role: "PHOTO", originalName: upload.name, title: upload.name });
      backgrounds.push(buf);
    } else if (libraryId) {
      const a = await db.mediaAsset.findFirst({ where: { id: libraryId, orgId: auth.orgId } });
      if (!a) throw new Error("Imagem não encontrada.");
      backgrounds.push(await getObject(a.storageKey));
    } else if (prompt) {
      const n = str(form, "variationMode") === "images" ? variations : 1;
      for (let i = 0; i < n; i++) {
        const img = await generateImage({ orgId: auth.orgId, prompt, orientation: format === "SQUARE" ? "square" : "portrait" });
        await saveAsset({ orgId: auth.orgId, brandId: brand.id, buffer: img.buffer, mimeType: "image/jpeg", kind: "IMAGE", role: "GENERATED", source: "AI", prompt: img.prompt, title: title });
        backgrounds.push(img.buffer);
      }
    }

    const slidesRaw = str(form, "slides");
    let created = 0;
    const warnings: string[] = [];
    if (slidesRaw) {
      // Carrossel
      const blocks = slidesRaw.split(/\n-{3,}\n/).map((b) => b.trim()).filter(Boolean);
      const total = blocks.length + 1;
      const bg = backgrounds[0] ? await prepareBackground(backgrounds[0], spec.width, spec.height) : null;
      const group = `studio-${Date.now().toString(36)}`;
      for (let i = 0; i < total; i++) {
        const [t, ...body] = i === 0 ? [title, str(form, "subtitle")] : blocks[i - 1].split("\n");
        const kind = i === 0 ? "cover" : i === total - 1 ? "final" : "content";
        const buf = await renderCreative(kit, {
          width: spec.width,
          height: spec.height,
          layout: "carousel",
          backgroundSrc: i === 0 ? bg : null,
          title,
          subtitle: str(form, "subtitle"),
          cta: kind === "final" ? str(form, "cta") : kind === "cover" ? "Arraste para o lado" : null,
          slide: { index: i + 1, total, title: t, body: body.join(" "), kind },
        });
        await saveAsset({ orgId: auth.orgId, brandId: brand.id, buffer: buf, mimeType: "image/jpeg", kind: "IMAGE", role: "COMPOSED", source: "COMPOSED", title: `${title} (${i + 1}/${total})`, tags: ["studio", group] });
        created++;
      }
    } else {
      for (let v = 0; v < variations; v++) {
        const bgBuf = backgrounds[v] ?? backgrounds[0];
        const bg = bgBuf ? await prepareBackground(bgBuf, spec.width, spec.height) : null;
        const lay = str(form, "variationMode") === "layouts" && layout !== "offer" ? LAYOUT_ROTATION[(LAYOUT_ROTATION.indexOf(layout) + v + LAYOUT_ROTATION.length) % LAYOUT_ROTATION.length] : layout;
        const buf = await renderCreative(kit, {
          width: spec.width,
          height: spec.height,
          layout: lay,
          backgroundSrc: bg,
          title,
          subtitle: str(form, "subtitle"),
          cta: str(form, "cta"),
          offer: offerView,
        });
        const report = await validateImage(buf, format, { hasLogo: kit.hasLogo, layout: lay, lightTextOverImage: lay === "hero-bottom" && !!bg });
        warnings.push(...report.errors, ...report.warnings);
        await saveAsset({ orgId: auth.orgId, brandId: brand.id, buffer: buf, mimeType: "image/jpeg", kind: "IMAGE", role: "COMPOSED", source: "COMPOSED", title, tags: ["studio", lay, format.toLowerCase()] });
        created++;
      }
    }
    await audit(auth.orgId, "creative.compose", { userId: auth.user.id, meta: { created, format, layout } });
    return `${created} peça(s) criada(s).${warnings.length ? " Atenção: " + [...new Set(warnings)].join(" ") : ""}`;
  });
}

export async function saveTemplateAction(form: FormData) {
  const { auth, brand } = await requireBrand("EDITOR");
  return runAction("/studio/creative", async () => {
    const name = str(form, "name");
    if (!name) throw new Error("Dê um nome ao template.");
    const f = str(form, "format");
    await db.template.create({
      data: {
        orgId: auth.orgId,
        brandId: brand.id,
        name,
        layout: str(form, "layout") || "hero-bottom",
        format: (f === "STORY" ? "STORY" : "FEED_IMAGE") as PostFormat,
        config: { creativeFormat: f || "FEED", cta: str(form, "cta"), subtitle: str(form, "subtitle"), prompt: str(form, "prompt") },
      },
    });
    return "Template salvo.";
  });
}

export async function deleteTemplateAction(form: FormData) {
  const { auth } = await requireBrand("EDITOR");
  return runAction("/studio/creative", async () => {
    await db.template.deleteMany({ where: { id: str(form, "id"), orgId: auth.orgId } });
    return "Template removido.";
  });
}
