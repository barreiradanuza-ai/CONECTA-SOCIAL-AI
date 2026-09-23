import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { markAllReadAction } from "../settings/actions";

export default async function NotificationsPage() {
  const auth = await requireAuth();
  const items = await db.notification.findMany({ where: { orgId: auth.orgId }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div>
      <PageHeader
        title="Alertas e notificações"
        actions={
          <form action={markAllReadAction}>
            <button className="btn-ghost">Marcar todas como lidas</button>
          </form>
        }
      />
      {items.length === 0 ? (
        <Empty title="Nenhuma notificação" />
      ) : (
        <ul className="card divide-y divide-slate-100">
          {items.map((n) => (
            <li key={n.id} className={`flex gap-3 p-4 ${n.readAt ? "opacity-60" : ""}`}>
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.level === "ERROR" ? "bg-red-500" : n.level === "WARNING" ? "bg-amber-500" : "bg-sky-500"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-2">
                  {n.link ? <Link href={n.link} className="font-medium hover:text-accent">{n.title}</Link> : <span className="font-medium">{n.title}</span>}
                  <span className="text-xs text-ink-mute">{formatDateTime(n.createdAt)}</span>
                </div>
                {n.body && <p className="mt-0.5 whitespace-pre-line text-sm text-ink-soft">{n.body}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
