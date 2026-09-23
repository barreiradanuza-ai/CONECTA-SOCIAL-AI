import { test } from "node:test";
import assert from "node:assert/strict";
import { zonedTimeToUtc, localDateKey, zonedParts, fromDatetimeLocal } from "../src/lib/time";
import { checkCommercialText, parseBRL, type GuardOffer } from "../src/server/guard";
import { buildSlots, PillarPicker, DEFAULT_PILLAR_WEIGHTS, bestHourFromHistory, type PlannerSettings } from "../src/server/planner-core";
import { seasonalDates } from "../src/server/ai/seasonal";
import { encrypt, decrypt, hashPassword, verifyPassword, signPayload, verifyPayload } from "../src/lib/crypto";
import { signSession, verifySession } from "../src/lib/session-token";

test("fuso: 12:00 em São Paulo = 15:00 UTC", () => {
  const d = zonedTimeToUtc(2026, 9, 23, 12, 0, "America/Sao_Paulo");
  assert.equal(d.toISOString(), "2026-09-23T15:00:00.000Z");
  assert.equal(localDateKey(d, "America/Sao_Paulo"), "2026-09-23");
  assert.equal(zonedParts(d, "America/Sao_Paulo").hour, 12);
  assert.equal(fromDatetimeLocal("2026-09-23T12:00", "America/Sao_Paulo").toISOString(), d.toISOString());
});

const offer: GuardOffer = {
  id: "o1",
  operator: "Operadora X",
  speedMbps: 500,
  priceCents: 9990,
  benefits: ["Instalação grátis", "Wi-Fi 6 incluso"],
  validFrom: new Date("2026-01-01"),
  validUntil: new Date("2026-12-31"),
  status: "APPROVED",
};

test("guarda: preço inventado sem oferta é bloqueado", () => {
  const r = checkCommercialText(["Internet 500 Mega por apenas R$ 79,90!"], null, new Date("2026-09-22"));
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.includes("R$ 79,90")));
});

test("guarda: preço e velocidade da oferta válida são aceitos", () => {
  const r = checkCommercialText(["500 Mega por R$ 99,90/mês com instalação grátis"], offer, new Date("2026-09-22"));
  assert.deepEqual(r.violations, []);
});

test("guarda: velocidade diferente da oferta é bloqueada", () => {
  const r = checkCommercialText(["800 Mega por R$ 99,90"], offer, new Date("2026-09-22"));
  assert.equal(r.ok, false);
});

test("guarda: oferta vencida é bloqueada", () => {
  const r = checkCommercialText(["500 Mega por R$ 99,90"], offer, new Date("2027-02-01"));
  assert.equal(r.ok, false);
});

test("guarda: conteúdo educativo com velocidades é permitido", () => {
  const r = checkCommercialText(["Qual a diferença entre 300, 500 e 800 Mega? Entenda antes de contratar."], null);
  assert.equal(r.ok, true);
});

test("guarda: termos promocionais sem oferta bloqueados (inclui acentos)", () => {
  assert.equal(checkCommercialText(["Últimos dias! Aproveite"], null).ok, false);
  assert.equal(checkCommercialText(["Instalação grátis para você"], null).ok, false);
});

test("parseBRL", () => {
  assert.equal(parseBRL("1.299,90"), 129990);
  assert.equal(parseBRL("99"), 9900);
});

const base: PlannerSettings = {
  timezone: "America/Sao_Paulo",
  horizonDays: 30,
  igFeedPerDay: 1,
  fbFeedPerDay: 1,
  storiesPerDay: 3,
  reelsPerWeek: 3,
  carouselsPerWeek: 2,
  storiesToFacebook: false,
  feedTimes: ["12:00"],
  fbOnlyTimes: ["18:30"],
  storyTimes: ["09:00", "13:30", "19:00"],
  reelTimes: ["19:30"],
  reelWeekdays: [1, 3, 5],
  pillarWeights: DEFAULT_PILLAR_WEIGHTS,
  hasValidOffers: false,
  hasReelVideos: false,
};

test("planejador: 30 dias, 1 feed/dia IG+FB, 3 stories/dia, sem reels sem vídeo", () => {
  const from = new Date("2026-09-22T03:00:00Z"); // 00:00 em SP
  const slots = buildSlots(from, base);
  const feed = slots.filter((s) => s.kind === "feed");
  assert.equal(feed.length, 30);
  assert.ok(feed.every((s) => s.networks.includes("INSTAGRAM") && s.networks.includes("FACEBOOK")));
  assert.equal(slots.filter((s) => s.kind === "story").length, 90);
  assert.equal(slots.filter((s) => s.kind === "reel").length, 0);
  assert.ok(!slots.some((s) => s.pillar === "OFFERS"), "sem ofertas válidas não planeja ofertas");
  const carousels = feed.filter((s) => s.format === "CAROUSEL").length;
  assert.ok(carousels >= 4 && carousels <= 10, `carrosséis: ${carousels}`);
});

test("planejador: reels quando há vídeos, 3 por semana", () => {
  const slots = buildSlots(new Date("2026-09-21T03:00:00Z"), { ...base, hasReelVideos: true, horizonDays: 14 });
  assert.equal(slots.filter((s) => s.kind === "reel").length, 6);
});

test("planejador: pillar picker respeita pesos aproximadamente", () => {
  const p = new PillarPicker({ ...DEFAULT_PILLAR_WEIGHTS });
  const counts: Record<string, number> = {};
  for (let i = 0; i < 100; i++) {
    const k = p.next();
    counts[k] = (counts[k] ?? 0) + 1;
  }
  assert.equal(counts.EDUCATION, 30);
  assert.equal(counts.OFFERS, 10);
});

test("melhor horário exige amostra mínima", () => {
  assert.equal(bestHourFromHistory([{ hour: 12, interactions: 5, views: 100 }]), null);
  const rows = Array.from({ length: 10 }, (_, i) => ({ hour: i % 2 ? 12 : 19, interactions: i % 2 ? 2 : 8, views: 100 }));
  assert.equal(bestHourFromHistory(rows)?.hour, 19);
});

test("datas sazonais calculadas (Dia das Mães 2026 = 10/05)", () => {
  const d = seasonalDates(2026);
  assert.equal(d.find((x) => x.name === "Dia das Mães")?.date, "2026-05-10");
  assert.equal(d.find((x) => x.name === "Black Friday")?.date, "2026-11-27");
});

test("criptografia e senhas", async () => {
  const c = encrypt("token-secreto");
  assert.notEqual(c, "token-secreto");
  assert.equal(decrypt(c), "token-secreto");
  const h = hashPassword("S3nh@forte");
  assert.ok(verifyPassword("S3nh@forte", h));
  assert.ok(!verifyPassword("errada", h));
  const t = signPayload({ a: 1 }, 60);
  assert.equal(verifyPayload<{ a: number }>(t)?.a, 1);
  assert.equal(verifyPayload(t.slice(0, -2) + "xx"), null);
  const s = await signSession({ uid: "u", oid: "o" }, "x".repeat(40));
  assert.equal((await verifySession(s, "x".repeat(40)))?.uid, "u");
  assert.equal(await verifySession(s, "y".repeat(40)), null);
});

import { rebalancePillars } from "../src/server/planner-core";

test("rebalanceamento: renovação diária mantém distribuição", () => {
  const existing: { pillar: any; kind: "story" | "other" }[] = [];
  const counts: Record<string, number> = {};
  let from = new Date("2026-09-22T03:00:00Z");
  for (let d = 0; d < 60; d++) {
    const day = buildSlots(from, { ...base, horizonDays: 1, storiesPerDay: 0 });
    const out = rebalancePillars(day, existing, DEFAULT_PILLAR_WEIGHTS, false);
    for (const s of out) {
      existing.push({ pillar: s.pillar, kind: "other" });
      counts[s.pillar] = (counts[s.pillar] ?? 0) + 1;
    }
    from = new Date(from.getTime() + 86400_000);
  }
  // Sem ofertas válidas: 30/90 de 60 ≈ 20 educação
  assert.ok(counts.EDUCATION >= 18 && counts.EDUCATION <= 22, JSON.stringify(counts));
  assert.equal(counts.OFFERS ?? 0, 0);
  assert.ok((counts.SEASONAL ?? 0) >= 5, JSON.stringify(counts));
});

test("personagem: com persona, episódios entram e viram carrossel; sem persona, nunca", () => {
  const w = { STORYTELLING: 45, EDUCATION: 20, ENGAGEMENT: 15, AUTHORITY: 10, OFFERS: 0, INSTITUTIONAL: 5, SEASONAL: 5 };
  const from = new Date("2026-09-22T03:00:00Z");
  const withP = rebalancePillars(buildSlots(from, { ...base, pillarWeights: w, personaEnabled: true, storiesPerDay: 0 }), [], w, false, true);
  const eps = withP.filter((s) => s.pillar === "STORYTELLING");
  assert.ok(eps.length >= 10 && eps.length <= 14, `episódios: ${eps.length}`);
  assert.ok(eps.every((s) => s.format === "CAROUSEL"));
  const without = rebalancePillars(buildSlots(from, { ...base, pillarWeights: w, storiesPerDay: 0 }), [], w, false, false);
  assert.equal(without.filter((s) => s.pillar === "STORYTELLING").length, 0);
});
