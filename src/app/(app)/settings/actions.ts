"use server";
import type { OperationMode, Pillar, PostFormat, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireBrand, assertBrandAccess } from "@/lib/auth";
import { runAction, str, lines, int } from "@/lib/actions";
import { decrypt, encrypt, hashPassword } from "@/lib/crypto";
import { audit } from "@/server/audit";
import { ensureBrandDefaults, slugify } from "@/server/brand";
import { saveAsset } from "@/server/media";
import { setSecret, SECRET_KEYS, type SecretKey } from "@/server/integrations";
import { isHex } from "@/server/creative/color";
import { graph } from "@/server/meta/graph";
import type { DiscoveredPage } from "@/server/meta/oauth";
import { PILLARS, FORMATS } from "@/lib/labels";
import { parseHHmm } from "@/lib/time";

// ───────── Marca ─────────

export async function createBrandAction(form: FormData) {
  const auth = await requireAuth("ADMIN");
  return runAction("/settings/brands", async () => {
    const name = str(form, "name");
    if (!name) throw new Error("Informe o nome da marca.");
    const b = await db.brand.create({
      data: {
        orgId: auth.orgId,
        name,
        slug: slugify(name) + "-" + Date.now().toString(36).slice(-4),
        website: str(form, "website") || null,
        colors: { primary: "#1f2937", secondary: "#374151", accent: "#2563eb", background: "#f8fafc", text: "#111827" },
      },
    });
    await ensureBrandDefaults(b.id);
    await audit(auth.orgId, "brand.create", { userId: auth.user.id, entity: "Brand", entityId: b.id });
    return `Marca ${name} criada. Selecione-a no menu lateral para configurá-la.`;
  });
}

export async function updateBrandAction(form: FormData) {
  const { auth, brand } = await requireBrand("ADMIN");
  return runAction("/settings/brand", async () => {
    const colors: Record<string, string> = {};
    for (const k of ["primary", "secondary", "accent", "background", "text"]) {
      const v = str(form, `color_${k}`);
      if (!isHex(v)) throw new Error(`Cor inválida em ${k}: use hexadecimal, ex.: #071b45.`);
      colors[k] = v.startsWith("#") ? v : `#${v}`;
    }
    await db.brand.update({
      where: { id: brand.id },
      data: {
        name: str(form, "name") || brand.name,
        website: str(form, "website") || null,
        slogan: str(form, "slogan") || null,
        description: str(form, "description") || null,
        positioning: str(form, "positioning") || null,
        toneOfVoice: str(form, "toneOfVoice") || null,
        targetAudience: str(form, "targetAudience") || null,
        visualGuidelines: str(form, "visualGuidelines") || null,
        communicationPillars: lines(form, "communicationPillars"),
        forbiddenTerms: lines(form, "forbiddenTerms"),
        defaultHashtags: lines(form, "defaultHashtags").map((h) => h.replace(/^#/, "")),
        timezone: str(form, "timezone") || "America/Sao_Paulo",
        colors,
        colorsConfirmed: form.get("colorsConfirmed") === "on",
        personaEnabled: form.get("personaEnabled") === "on",
        personaName: str(form, "personaName") || null,
        seriesTitle: str(form, "seriesTitle") || null,
        personaBible: str(form, "personaBible") || null,
        personaVisual: str(form, "personaVisual") || null,
      },
    });
    await audit(auth.orgId, "brand.update", { userId: auth.user.id, entity: "Brand", entityId: brand.id });
    return "Identidade da marca atualizada.";
  });
}

const ALLOWED_UPLOAD: Record<string, "IMAGE" | "VIDEO" | "FONT"> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/svg+xml": "IMAGE",
  "video/mp4": "VIDEO",
  "video/quicktime": "VIDEO",
  "font/ttf": "FONT",
  "font/otf": "FONT",
};

function detectMime(file: File) {
  if (file.type && ALLOWED_UPLOAD[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ({ ttf: "font/ttf", otf: "font/otf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4", mov: "video/quicktime" } as Record<string, string>)[ext ?? ""] ?? "";
}

export async function uploadAssetAction(form: FormData) {
  const { auth, brand } = await requireBrand("EDITOR");
  const back = str(form, "back") || "/media";
  return runAction(back, async () => {
    const role = str(form, "role") as Prisma.MediaAssetCreateInput["role"];
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new Error("Selecione ao menos um arquivo.");
    let n = 0;
    for (const file of files) {
      if (file.size > 200 * 1024 * 1024) throw new Error(`${file.name}: arquivo acima de 200 MB.`);
      const mime = detectMime(file);
      const kind = ALLOWED_UPLOAD[mime];
      if (!kind) throw new Error(`${file.name}: tipo de arquivo não suportado.`);
      const buf = Buffer.from(await file.arrayBuffer());
      const finalRole = kind === "VIDEO" ? "VIDEO" : kind === "FONT" ? "FONT" : role;
      const asset = await saveAsset({
        orgId: auth.orgId,
        brandId: brand.id,
        buffer: buf,
        mimeType: mime,
        kind,
        role: finalRole,
        originalName: file.name,
        title: str(form, "title") || file.name,
        tags: lines(form, "tags"),
        isApproved: form.get("approved") === "on" || ["LOGO_PRIMARY", "LOGO_TRANSPARENT", "LOGO_ALT", "APPROVED_PIECE", "CHARACTER_REFERENCE"].includes(finalRole),
      });
      if (kind === "FONT") {
        const slot = str(form, "fontSlot") === "body" ? "fontBodyAssetId" : "fontHeadingAssetId";
        await db.brand.update({ where: { id: brand.id }, data: { [slot]: asset.id } });
      }
      n++;
    }
    await audit(auth.orgId, "media.upload", { userId: auth.user.id, meta: { count: n, role } });
    return `${n} arquivo(s) enviado(s).`;
  });
}

export async function deleteAssetAction(form: FormData) {
  const { auth, brand } = await requireBrand("EDITOR");
  const back = str(form, "back") || "/media";
  return runAction(back, async () => {
    const id = str(form, "id");
    const a = await db.mediaAsset.findFirst({ where: { id, orgId: auth.orgId } });
    if (!a) throw new Error("Arquivo não encontrado.");
    const used = await db.postMedia.count({ where: { assetId: id, post: { status: { in: ["SCHEDULED", "PUBLISHING", "APPROVED", "PENDING_APPROVAL"] } } } });
    if (used) throw new Error("Arquivo em uso por publicação ativa.");
    await db.mediaAsset.delete({ where: { id } });
    const { deleteObject } = await import("@/server/storage");
    await deleteObject(a.storageKey).catch(() => {});
    if (brand.fontHeadingAssetId === id) await db.brand.update({ where: { id: brand.id }, data: { fontHeadingAssetId: null } });
    if (brand.fontBodyAssetId === id) await db.brand.update({ where: { id: brand.id }, data: { fontBodyAssetId: null } });
    await audit(auth.orgId, "media.delete", { userId: auth.user.id, entity: "MediaAsset", entityId: id });
    return "Arquivo removido.";
  });
}

export async function toggleAssetApprovalAction(form: FormData) {
  const { auth } = await requireBrand("EDITOR");
  const back = str(form, "back") || "/media";
  return runAction(back, async () => {
    const a = await db.mediaAsset.findFirst({ where: { id: str(form, "id"), orgId: auth.orgId } });
    if (!a) throw new Error("Arquivo não encontrado.");
    await db.mediaAsset.update({ where: { id: a.id }, data: { isApproved: !a.isApproved } });
    return a.isApproved ? "Aprovação removida." : "Arquivo aprovado para uso automático.";
  });
}

// ───────── Automação ─────────

function times(form: FormData, key: string) {
  const t = lines(form, key);
  t.forEach(parseHHmm);
  return t;
}

export async function updateAutomationAction(form: FormData) {
  const { auth, brand } = await requireBrand("ADMIN");
  return runAction("/settings/automation", async () => {
    const weights: Record<string, number> = {};
    for (const p of PILLARS) weights[p] = int(form, `w_${p}`, 0, 0, 100);
    const pauseDays = int(form, "pauseDays", 0, 0, 60);
    await db.automationSettings.update({
      where: { brandId: brand.id },
      data: {
        autopilotEnabled: form.get("autopilotEnabled") === "on",
        mode: (str(form, "mode") as OperationMode) || "SUPERVISED",
        planningHorizonDays: int(form, "planningHorizonDays", 30, 7, 60),
        productionLeadDays: int(form, "productionLeadDays", 3, 1, 14),
        igFeedPerDay: int(form, "igFeedPerDay", 1, 0, 5),
        fbFeedPerDay: int(form, "fbFeedPerDay", 1, 0, 5),
        storiesPerDay: int(form, "storiesPerDay", 3, 0, 10),
        reelsPerWeek: int(form, "reelsPerWeek", 3, 0, 14),
        carouselsPerWeek: int(form, "carouselsPerWeek", 2, 0, 7),
        storiesToFacebook: form.get("storiesToFacebook") === "on",
        feedTimes: times(form, "feedTimes"),
        fbOnlyTimes: times(form, "fbOnlyTimes"),
        storyTimes: times(form, "storyTimes"),
        reelTimes: times(form, "reelTimes"),
        reelWeekdays: form.getAll("reelWeekdays").map((v) => Number(v)).filter((n) => n >= 0 && n <= 6),
        pillarWeights: weights,
        approvalRequiredPillars: form.getAll("approvalPillars").map(String).filter((p) => (PILLARS as readonly string[]).includes(p)) as Pillar[],
        approvalRequiredFormats: form.getAll("approvalFormats").map(String).filter((p) => (FORMATS as readonly string[]).includes(p)) as PostFormat[],
        maxHashtagsInstagram: int(form, "maxHashtagsInstagram", 5, 0, 30),
        maxGenerationsPerRun: int(form, "maxGenerationsPerRun", 4, 1, 20),
        notifyEmail: str(form, "notifyEmail") || null,
        notifyWebhookUrl: str(form, "notifyWebhookUrl") || null,
        pausedUntil: pauseDays ? new Date(Date.now() + pauseDays * 86400_000) : form.get("clearPause") === "on" ? null : undefined,
      },
    });
    await audit(auth.orgId, "automation.update", { userId: auth.user.id, entity: "Brand", entityId: brand.id });
    return "Regras de automação salvas.";
  });
}

// ───────── WhatsApp ─────────

export async function updateWhatsappAction(form: FormData) {
  const { auth, brand } = await requireBrand("ADMIN");
  return runAction("/settings/whatsapp", async () => {
    const phone = str(form, "phoneE164").replace(/\D/g, "");
    if (phone && (phone.length < 12 || phone.length > 13)) throw new Error("Número deve ter DDI + DDD + número, ex.: 5511999998888.");
    await db.whatsAppConfig.update({
      where: { brandId: brand.id },
      data: {
        phoneE164: phone || null,
        defaultMessage: str(form, "defaultMessage") || undefined,
        ctaText: str(form, "ctaText") || undefined,
        landingEnabled: form.get("landingEnabled") === "on",
        utmSource: str(form, "utmSource") || "social",
        utmMedium: str(form, "utmMedium") || "organic",
        crmWebhookUrl: str(form, "crmWebhookUrl") || null,
      },
    });
    await audit(auth.orgId, "whatsapp.update", { userId: auth.user.id });
    return "WhatsApp atualizado.";
  });
}

export async function createCampaignLinkAction(form: FormData) {
  const { auth, brand } = await requireBrand("EDITOR");
  return runAction("/settings/whatsapp", async () => {
    const name = str(form, "campaign");
    if (!name) throw new Error("Informe o nome da campanha.");
    const slug = slugify(name);
    const campaign = await db.campaign.upsert({
      where: { brandId_slug: { brandId: brand.id, slug } },
      create: { orgId: auth.orgId, brandId: brand.id, name, slug },
      update: {},
    });
    const { createTrackingLink } = await import("@/server/whatsapp");
    await createTrackingLink({ orgId: auth.orgId, brandId: brand.id, campaignId: campaign.id, label: str(form, "label") || name, message: str(form, "message") || undefined });
    return "Link de campanha criado.";
  });
}

// ───────── Integrações ─────────

export async function setSecretAction(form: FormData) {
  const auth = await requireAuth("ADMIN");
  return runAction("/settings/integrations", async () => {
    const key = str(form, "key") as SecretKey;
    if (!SECRET_KEYS.some((s) => s.key === key)) throw new Error("Chave desconhecida.");
    const value = str(form, "value");
    const remove = form.get("remove") === "1";
    await setSecret(auth.orgId, key, remove ? null : value || null);
    await audit(auth.orgId, remove ? "secret.remove" : "secret.set", { userId: auth.user.id, meta: { key } });
    return remove ? "Chave removida do painel." : "Chave salva com criptografia.";
  });
}

// ───────── Contas Meta ─────────

export async function connectPagesAction(form: FormData) {
  const { auth, brand } = await requireBrand("ADMIN");
  return runAction("/settings/accounts", async () => {
    const pendingId = str(form, "pendingId");
    const pending = await db.oAuthPending.findFirst({ where: { id: pendingId, orgId: auth.orgId, userId: auth.user.id, expiresAt: { gt: new Date() } } });
    if (!pending) throw new Error("A autorização expirou. Clique em conectar novamente.");
    await assertBrandAccess(auth, pending.brandId);
    const payload = JSON.parse(decrypt(pending.payloadEnc)) as { pages: DiscoveredPage[]; scopes: string[] };
    const selectedFb = form.getAll("fb").map(String);
    const selectedIg = form.getAll("ig").map(String);
    let n = 0;
    for (const p of payload.pages) {
      const common = { orgId: auth.orgId, brandId: pending.brandId, accessTokenEnc: encrypt(p.accessToken), status: "ACTIVE" as const, scopes: payload.scopes, connectedById: auth.user.id, lastError: null, tokenExpiresAt: null };
      if (selectedFb.includes(p.id)) {
        await db.socialAccount.upsert({
          where: { brandId_network_externalId: { brandId: pending.brandId, network: "FACEBOOK", externalId: p.id } },
          create: { ...common, network: "FACEBOOK", externalId: p.id, name: p.name, pictureUrl: p.picture },
          update: { ...common, name: p.name, pictureUrl: p.picture },
        });
        n++;
      }
      if (p.instagram && selectedIg.includes(p.instagram.id)) {
        await db.socialAccount.upsert({
          where: { brandId_network_externalId: { brandId: pending.brandId, network: "INSTAGRAM", externalId: p.instagram.id } },
          create: { ...common, network: "INSTAGRAM", externalId: p.instagram.id, name: p.instagram.name ?? p.instagram.username ?? "Instagram", username: p.instagram.username, pictureUrl: p.instagram.picture, linkedPageId: p.id },
          update: { ...common, name: p.instagram.name ?? p.instagram.username ?? "Instagram", username: p.instagram.username, pictureUrl: p.instagram.picture, linkedPageId: p.id },
        });
        n++;
      }
    }
    await db.oAuthPending.delete({ where: { id: pending.id } });
    await audit(auth.orgId, "meta.connect", { userId: auth.user.id, meta: { count: n, brandId: brand.id } });
    if (!n) throw new Error("Nenhuma conta selecionada.");
    return `${n} conta(s) conectada(s).`;
  });
}

export async function disconnectAccountAction(form: FormData) {
  const { auth } = await requireBrand("ADMIN");
  return runAction("/settings/accounts", async () => {
    const a = await db.socialAccount.findFirst({ where: { id: str(form, "id"), orgId: auth.orgId } });
    if (!a) throw new Error("Conta não encontrada.");
    await db.socialAccount.update({ where: { id: a.id }, data: { status: "DISCONNECTED", accessTokenEnc: encrypt("revoked") } });
    await audit(auth.orgId, "meta.disconnect", { userId: auth.user.id, entity: "SocialAccount", entityId: a.id });
    return `${a.name} desconectada. Os tokens foram descartados.`;
  });
}

export async function testAccountAction(form: FormData) {
  const { auth } = await requireBrand("ADMIN");
  return runAction("/settings/accounts", async () => {
    const a = await db.socialAccount.findFirst({ where: { id: str(form, "id"), orgId: auth.orgId } });
    if (!a) throw new Error("Conta não encontrada.");
    try {
      const token = decrypt(a.accessTokenEnc);
      const fields = a.network === "INSTAGRAM" ? "id,username,followers_count" : "id,name,followers_count";
      const r: any = await graph(a.externalId, { token, params: { fields } });
      await db.socialAccount.update({ where: { id: a.id }, data: { status: "ACTIVE", lastCheckedAt: new Date(), lastError: null } });
      return `Conexão OK com ${r.username ?? r.name} (${r.followers_count ?? "?"} seguidores).`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.socialAccount.update({ where: { id: a.id }, data: { status: "ERROR", lastCheckedAt: new Date(), lastError: msg } });
      throw new Error(`Falha no teste: ${msg}`);
    }
  });
}

// ───────── Usuários ─────────

export async function createUserAction(form: FormData) {
  const auth = await requireAuth("ADMIN");
  return runAction("/settings/users", async () => {
    const email = str(form, "email").toLowerCase();
    const name = str(form, "name");
    const password = str(form, "password");
    const role = (str(form, "role") as Role) || "EDITOR";
    if (role === "OWNER" && auth.role !== "OWNER") throw new Error("Apenas o proprietário pode criar outro proprietário.");
    if (password.length < 10) throw new Error("Senha provisória precisa de 10+ caracteres.");
    let user = await db.user.findUnique({ where: { email } });
    if (!user) user = await db.user.create({ data: { email, name, passwordHash: hashPassword(password) } });
    await db.membership.upsert({ where: { userId_orgId: { userId: user.id, orgId: auth.orgId } }, create: { userId: user.id, orgId: auth.orgId, role }, update: { role } });
    await audit(auth.orgId, "user.create", { userId: auth.user.id, entity: "User", entityId: user.id, meta: { role } });
    return `Usuário ${email} adicionado como ${role}.`;
  });
}

export async function updateMemberAction(form: FormData) {
  const auth = await requireAuth("ADMIN");
  return runAction("/settings/users", async () => {
    const m = await db.membership.findFirst({ where: { id: str(form, "id"), orgId: auth.orgId } });
    if (!m) throw new Error("Membro não encontrado.");
    if (m.userId === auth.user.id) throw new Error("Você não pode alterar o próprio acesso.");
    if (form.get("remove") === "1") {
      await db.membership.delete({ where: { id: m.id } });
      await audit(auth.orgId, "user.remove", { userId: auth.user.id, entityId: m.userId });
      return "Acesso removido.";
    }
    const role = str(form, "role") as Role;
    if (role === "OWNER" && auth.role !== "OWNER") throw new Error("Apenas o proprietário pode conceder este papel.");
    await db.membership.update({ where: { id: m.id }, data: { role } });
    await audit(auth.orgId, "user.role", { userId: auth.user.id, entityId: m.userId, meta: { role } });
    return "Papel atualizado.";
  });
}

export async function changePasswordAction(form: FormData) {
  const auth = await requireAuth();
  return runAction("/settings/users", async () => {
    const { verifyPassword } = await import("@/lib/crypto");
    const user = await db.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (!verifyPassword(str(form, "current"), user.passwordHash)) throw new Error("Senha atual incorreta.");
    const next = str(form, "next");
    if (next.length < 10) throw new Error("A nova senha precisa ter 10+ caracteres.");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
    await audit(auth.orgId, "user.password", { userId: auth.user.id });
    return "Senha alterada.";
  });
}

export async function markAllReadAction() {
  const auth = await requireAuth();
  await db.notification.updateMany({ where: { orgId: auth.orgId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}
