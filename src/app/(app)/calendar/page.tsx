import Link from "next/link";
import { requireBrand } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { addDaysYMD, zonedParts, zonedTimeToUtc, localDateKey } from "@/lib/time";
import { CalendarBoard, type CalItem } from "./board";
import { planCalendarAction } from "./actions";
import { PILLAR_LABEL } from "@/lib/labels";

type View = "month" | "week" | "day";

const LEGEND: Record<string, string> = {
  EDUCATION: "bg-sky-500",
  ENGAGEMENT: "bg-violet-500",
  AUTHORITY: "bg-indigo-500",
  OFFERS: "bg-amber-500",
  INSTITUTIONAL: "bg-slate-500",
  SEASONAL: "bg-emerald-500",
  STORYTELLING: "bg-fuchsia-500",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; ok?: string; error?: string }> }) {
  const { brand } = await requireBrand();
  const sp = await searchParams;
  const view: View = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const tz = brand.timezone;
  const today = zonedParts(new Date(), tz);
  const [y, m, d] = (sp.date ?? `${today.year}-${today.month}-${today.day}`).split("-").map(Number);

  // Intervalo de dias exibidos
  let days: { y: number; m: number; d: number; weekday: number }[] = [];
  if (view === "month") {
    const first = addDaysYMD(y, m, 1, 0);
    const startOffset = (first.weekday + 6) % 7; // semana começa na segunda
    const start = addDaysYMD(y, m, 1, -startOffset);
    days = Array.from({ length: 42 }, (_, i) => addDaysYMD(start.y, start.m, start.d, i));
  } else if (view === "week") {
    const cur = addDaysYMD(y, m, d, 0);
    const start = addDaysYMD(y, m, d, -((cur.weekday + 6) % 7));
    days = Array.from({ length: 7 }, (_, i) => addDaysYMD(start.y, start.m, start.d, i));
  } else {
    days = [addDaysYMD(y, m, d, 0)];
  }
  const from = zonedTimeToUtc(days[0].y, days[0].m, days[0].d, 0, 0, tz);
  const last = days[days.length - 1];
  const endDay = addDaysYMD(last.y, last.m, last.d, 1);
  const to = zonedTimeToUtc(endDay.y, endDay.m, endDay.d, 0, 0, tz);

  const posts = await db.post.findMany({
    where: { brandId: brand.id, scheduledAt: { gte: from, lt: to } },
    include: { targets: { select: { network: true, status: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  const items: CalItem[] = posts.map((p) => {
    const zp = zonedParts(p.scheduledAt!, tz);
    return {
      id: p.id,
      dateKey: localDateKey(p.scheduledAt!, tz),
      time: `${String(zp.hour).padStart(2, "0")}:${String(zp.minute).padStart(2, "0")}`,
      title: p.title ?? p.theme,
      pillar: p.pillar,
      format: p.format,
      status: p.status,
      networks: p.targets.map((t) => t.network),
    };
  });

  const key = (x: { y: number; m: number; d: number }) => `${x.y}-${String(x.m).padStart(2, "0")}-${String(x.d).padStart(2, "0")}`;
  const nav = (delta: number) => {
    const t = view === "month" ? addDaysYMD(y, m + delta, 1, 0) : addDaysYMD(y, m, d, delta * (view === "week" ? 7 : 1));
    return `/calendar?view=${view}&date=${key(t)}`;
  };
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));

  return (
    <div>
      <PageHeader
        title="Calendário editorial"
        subtitle="Arraste publicações para mudar o dia (o horário é mantido). Clique para editar."
        actions={
          <>
            <Link href="/studio/content" className="btn-ghost">Nova publicação</Link>
            <form action={planCalendarAction}><SubmitButton className="btn-primary" pendingText="Planejando com IA…">Planejar próximos 30 dias</SubmitButton></form>
          </>
        }
      />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={nav(-1)} className="btn-ghost btn-sm">←</Link>
        <Link href={`/calendar?view=${view}`} className="btn-ghost btn-sm">Hoje</Link>
        <Link href={nav(1)} className="btn-ghost btn-sm">→</Link>
        <span className="ml-2 text-lg font-semibold capitalize">{view === "month" ? monthName : view === "week" ? `Semana de ${days[0].d}/${days[0].m}` : `${d}/${m}/${y}`}</span>
        <div className="ml-auto flex rounded-xl border border-slate-200 bg-white p-0.5">
          {(["month", "week", "day"] as View[]).map((v) => (
            <Link key={v} href={`/calendar?view=${v}&date=${key({ y, m, d })}`} className={`rounded-lg px-3 py-1 text-sm ${v === view ? "bg-navy text-white" : "text-ink-soft"}`}>
              {{ month: "Mês", week: "Semana", day: "Dia" }[v]}
            </Link>
          ))}
        </div>
      </div>
      <CalendarBoard
        view={view}
        days={days.map((x) => ({ key: key(x), day: x.d, inMonth: x.m === m, weekday: x.weekday }))}
        todayKey={key({ y: today.year, m: today.month, d: today.day })}
        items={items}
      />
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-soft">
        {Object.entries(PILLAR_LABEL).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${LEGEND[k]}`} />{v}</span>)}
      </div>
    </div>
  );
}
