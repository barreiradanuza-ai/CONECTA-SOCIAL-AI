import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "../tabs";
import { formatDateTime } from "@/lib/time";

export default async function AuditPage() {
  const auth = await requireAuth("ADMIN");
  const logs = await db.auditLog.findMany({ where: { orgId: auth.orgId }, orderBy: { createdAt: "desc" }, take: 200 });
  const users = await db.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.userId).filter(Boolean) as string[])] } } });
  const name = new Map(users.map((u) => [u.id, u.name]));
  return (
    <div>
      <PageHeader title="Configurações" subtitle="Registro de ações administrativas (retenção de 2 anos)." />
      <SettingsTabs current="audit" />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Objeto</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</td>
                <td className="text-sm">{l.userId ? name.get(l.userId) ?? l.userId : "sistema"}</td>
                <td className="font-mono text-xs">{l.action}</td>
                <td className="text-xs text-ink-mute">{l.entity ? `${l.entity} ${l.entityId ?? ""}` : ""} {l.meta ? JSON.stringify(l.meta).slice(0, 120) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
