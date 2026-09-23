"use server";
import type { Network, Pillar, PostFormat } from "@prisma/client";
import { requireBrand } from "@/lib/auth";
import { runAction, str, lines } from "@/lib/actions";
import { fromDatetimeLocal } from "@/lib/time";
import { approvePost, cancelPost, createManualPost, getPostForOrg, publishNow, rejectToDraft, reschedulePost, retryTarget, updatePostContent } from "@/server/posts";
import { producePost } from "@/server/production";
import { audit } from "@/server/audit";
import { db } from "@/lib/db";

const back = (id: string) => `/posts/${id}`;

export async function approveAction(form: FormData) {
  const { auth } = await requireBrand("ADMIN");
  const id = str(form, "id");
  return runAction(str(form, "back") || back(id), async () => {
    await approvePost(auth.orgId, auth.user.id, id);
    return "Publicação aprovada e agendada.";
  });
}

export async function unapproveAction(form: FormData) {
  const { auth } = await requireBrand("ADMIN");
  const id = str(form, "id");
  return runAction(back(id), async () => {
    await rejectToDraft(auth.orgId, auth.user.id, id);
    return "Publicação voltou para rascunho.";
  });
}

export async function cancelAction(form: FormData) {
  const { auth } = await requireBrand("EDITOR");
  const id = str(form, "id");
  return runAction(str(form, "back") || back(id), async () => {
    await cancelPost(auth.orgId, auth.user.id, id);
    return "Agendamento cancelado. O conteúdo foi mantido.";
  });
}

export async function publishNowAction(form: FormData) {
  const { auth } = await requireBrand("ADMIN");
  const id = str(form, "id");
  return runAction(back(id), async () => {
    await publishNow(auth.orgId, auth.user.id, id);
    return "Enviado para a fila de publicação. O worker publica em até 1 minuto.";
  });
}

export async function rescheduleAction(form: FormData) {
  const { auth, brand } = await requireBrand("EDITOR");
  const id = str(form, "id");
  return runAction(back(id), async () => {
    const at = fromDatetimeLocal(str(form, "scheduledAt"), brand.timezone);
    await reschedulePost(auth.orgId, auth.user.id, id, at);
    return "Horário atualizado.";
  });
}

export async function retryAction(form: FormData) {
  const { auth } = await requireBrand("ADMIN");
  return runAction(back(str(form, "postId")), async () => {
    await retryTarget(auth.orgId, auth.user.id, str(form, "targetId"));
    return "Nova tentativa enfileirada.";
  });
}

export async function saveContentAction(form: FormData) {
  const { auth } = await requireBrand("EDITOR");
  const id = str(form, "id");
  return runAction(back(id), async () => {
    const slidesRaw = str(form, "slides");
    const slides = slidesRaw
      ? slidesRaw.split(/\n-{3,}\n/).map((block) => {
          const [title, ...body] = block.trim().split("\n");
          return { title: title.trim(), body: body.join(" ").trim() };
        })
      : undefined;
    await updatePostContent(auth.orgId, auth.user.id, id, {
      title: str(form, "title"),
      subtitle: str(form, "subtitle"),
      cta: str(form, "cta"),
      theme: str(form, "theme") || undefined,
      layout: str(form, "layout") || undefined,
      hashtags: lines(form, "hashtags").map((h) => h.replace(/^#/, "")),
      captions: { INSTAGRAM: str(form, "caption_INSTAGRAM") || undefined, FACEBOOK: str(form, "caption_FACEBOOK") || undefined },
      slides,
    });
    if (form.get("recompose") === "1") {
      await producePost(id, { actor: "user" });
      return "Conteúdo salvo e arte recomposta. Revise e aprove.";
    }
    return "Conteúdo salvo. A publicação voltou para aprovação.";
  });
}

export async function regenerateAction(form: FormData) {
  const { auth } = await requireBrand("EDITOR");
  const id = str(form, "id");
  return runAction(back(id), async () => {
    await getPostForOrg(auth.orgId, id);
    const mode = str(form, "mode");
    const bg = str(form, "backgroundAssetId");
    if (bg) {
      const a = await db.mediaAsset.findFirst({ where: { id: bg, orgId: auth.orgId } });
      if (!a) throw new Error("Imagem não encontrada.");
    }
    const r = await producePost(id, {
      actor: "user",
      regenerateText: mode === "text" || mode === "all",
      regenerateImage: mode === "image" || mode === "all",
      backgroundAssetId: bg || undefined,
      extraInstructions: str(form, "instructions") || undefined,
    });
    await audit(auth.orgId, "post.generate", { userId: auth.user.id, entity: "Post", entityId: id, meta: { mode } });
    return r.errors.length ? `Gerado com alertas de validação: ${r.errors[0]}` : "Conteúdo gerado. Revise e aprove.";
  });
}

export async function attachVideoAction(form: FormData) {
  const { auth } = await requireBrand("EDITOR");
  const id = str(form, "id");
  return runAction(back(id), async () => {
    await getPostForOrg(auth.orgId, id);
    const video = await db.mediaAsset.findFirst({ where: { id: str(form, "videoId"), orgId: auth.orgId, kind: "VIDEO" } });
    if (!video) throw new Error("Vídeo não encontrado.");
    await db.postMedia.deleteMany({ where: { postId: id, purpose: "VIDEO" } });
    await db.postMedia.create({ data: { postId: id, assetId: video.id, purpose: "VIDEO" } });
    await producePost(id, { actor: "user" });
    return "Vídeo vinculado ao Reels.";
  });
}

export async function createPostAction(form: FormData) {
  const { auth, brand } = await requireBrand("EDITOR");
  return runAction(str(form, "back") || "/posts", async () => {
    const networks = form.getAll("networks").map(String) as Network[];
    if (!networks.length) throw new Error("Selecione ao menos uma rede.");
    const theme = str(form, "theme");
    if (!theme) throw new Error("Informe o tema.");
    const when = str(form, "scheduledAt");
    const post = await createManualPost({
      orgId: auth.orgId,
      userId: auth.user.id,
      brandId: brand.id,
      pillar: (str(form, "pillar") || "EDUCATION") as Pillar,
      format: (str(form, "format") || "FEED_IMAGE") as PostFormat,
      theme,
      objective: str(form, "objective") || undefined,
      networks,
      scheduledAt: when ? fromDatetimeLocal(when, brand.timezone) : null,
      offerId: str(form, "offerId") || null,
    });
    if (form.get("generate") === "1") {
      await producePost(post.id, { actor: "user", extraInstructions: str(form, "instructions") || undefined });
    }
    return { message: "Publicação criada.", redirectTo: `/posts/${post.id}` };
  });
}
