"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { movePostAction } from "./actions";
import { FORMAT_LABEL, STATUS_LABEL } from "@/lib/labels";

export type CalItem = { id: string; dateKey: string; time: string; title: string; pillar: string; format: string; status: string; networks: string[] };

const PILLAR_BAR: Record<string, string> = {
  EDUCATION: "border-l-sky-500",
  ENGAGEMENT: "border-l-violet-500",
  AUTHORITY: "border-l-indigo-500",
  OFFERS: "border-l-amber-500",
  INSTITUTIONAL: "border-l-slate-500",
  SEASONAL: "border-l-emerald-500",
  STORYTELLING: "border-l-fuchsia-500",
};
const STATUS_DOT: Record<string, string> = {
  PLANNED: "bg-slate-300",
  GENERATING: "bg-blue-300",
  DRAFT: "bg-slate-400",
  PENDING_APPROVAL: "bg-amber-500",
  APPROVED: "bg-teal-500",
  SCHEDULED: "bg-blue-500",
  PUBLISHING: "bg-blue-700",
  PUBLISHED: "bg-emerald-500",
  PARTIALLY_PUBLISHED: "bg-orange-500",
  FAILED: "bg-red-500",
  CANCELED: "bg-slate-200",
};
const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function CalendarBoard({ view, days, todayKey, items }: { view: "month" | "week" | "day"; days: { key: string; day: number; inMonth: boolean; weekday: number }[]; todayKey: string; items: CalItem[] }) {
  const [optimistic, move] = useOptimistic(items, (state, { id, dateKey }: { id: string; dateKey: string }) => state.map((i) => (i.id === id ? { ...i, dateKey } : i)));
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);

  const onDrop = (dateKey: string, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    start(async () => {
      move({ id, dateKey });
      const r = await movePostAction(id, dateKey);
      setError(r.ok ? null : r.error ?? "Não foi possível mover.");
    });
  };

  const cols = view === "day" ? "grid-cols-1" : "grid-cols-7";
  return (
    <div>
      {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <div className="overflow-x-auto">
        <div className={`grid min-w-[760px] ${cols} gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200`}>
          {view !== "day" && WEEK.map((w) => <div key={w} className="bg-slate-50 px-2 py-1.5 text-xs font-semibold text-ink-mute">{w}</div>)}
          {days.map((d) => {
            const dayItems = optimistic.filter((i) => i.dateKey === d.key);
            const tall = view === "month" ? "min-h-32" : "min-h-[28rem]";
            return (
              <div
                key={d.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(d.key);
                }}
                onDragLeave={() => setOver((o) => (o === d.key ? null : o))}
                onDrop={(e) => onDrop(d.key, e)}
                className={`${tall} bg-white p-1.5 ${!d.inMonth && view === "month" ? "bg-slate-50/70 text-ink-mute" : ""} ${over === d.key ? "ring-2 ring-inset ring-accent" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${d.key === todayKey ? "bg-accent text-white" : ""}`}>{d.day}</span>
                  <Link href={`/studio/content?date=${d.key}`} className="text-xs text-ink-mute opacity-0 hover:text-accent hover:opacity-100 focus:opacity-100" title="Nova publicação neste dia">+</Link>
                </div>
                <div className="space-y-1">
                  {dayItems.map((i) => (
                    <Link
                      key={i.id}
                      href={`/posts/${i.id}`}
                      draggable={!["PUBLISHED", "PUBLISHING", "PARTIALLY_PUBLISHED"].includes(i.status)}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                      title={`${i.time} · ${FORMAT_LABEL[i.format]} · ${STATUS_LABEL[i.status]} · ${i.networks.join(", ")}`}
                      className={`block rounded-md border border-l-4 border-slate-200 bg-white px-1.5 py-1 text-[11px] leading-tight shadow-sm hover:border-accent ${PILLAR_BAR[i.pillar] ?? ""} ${i.status === "CANCELED" ? "opacity-40 line-through" : ""}`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[i.status]}`} />
                        <span className="font-semibold">{i.time}</span>
                        <span className="text-ink-mute">{i.format === "STORY" ? "Story" : i.format === "REEL" ? "Reels" : i.format === "CAROUSEL" ? "Carr." : "Feed"}</span>
                        <span className="ml-auto text-ink-mute">{i.networks.map((n) => (n === "INSTAGRAM" ? "IG" : "FB")).join("+")}</span>
                      </div>
                      <div className={view === "month" ? "truncate" : "line-clamp-3"}>{i.title}</div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
