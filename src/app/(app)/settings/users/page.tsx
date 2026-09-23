import { requireAuth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Flash, Field } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SettingsTabs } from "../tabs";
import { createUserAction, updateMemberAction, changePasswordAction } from "../actions";
import { formatDateTime } from "@/lib/time";

const ROLES = [
  { v: "VIEWER", l: "Leitura" },
  { v: "EDITOR", l: "Editor (cria e edita)" },
  { v: "ADMIN", l: "Administrador (aprova, configura)" },
  { v: "OWNER", l: "Proprietário" },
];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const members = await db.membership.findMany({ where: { orgId: auth.orgId }, include: { user: true }, orderBy: { createdAt: "asc" } });
  const admin = hasRole(auth, "ADMIN");
  return (
    <div>
      <PageHeader title="Configurações" subtitle="Controle de acesso por organização e papel." />
      <SettingsTabs current="users" />
      <Flash {...sp} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="table">
            <thead><tr><th>Usuário</th><th>Papel</th><th>Último acesso</th><th /></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user.name}<div className="text-xs text-ink-mute">{m.user.email}</div></td>
                  <td>
                    {admin && m.userId !== auth.user.id ? (
                      <form action={updateMemberAction} className="flex gap-2">
                        <input type="hidden" name="id" value={m.id} />
                        <select name="role" defaultValue={m.role} className="input py-1 text-xs">{ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
                        <SubmitButton className="btn-ghost btn-sm">Salvar</SubmitButton>
                        <SubmitButton className="btn-danger btn-sm" name="remove" value="1" confirm="Remover o acesso deste usuário?">Remover</SubmitButton>
                      </form>
                    ) : (
                      ROLES.find((r) => r.v === m.role)?.l
                    )}
                  </td>
                  <td className="text-xs">{formatDateTime(m.user.lastLoginAt)}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-6">
          {admin && (
            <form action={createUserAction} className="card space-y-3 p-5">
              <h2 className="font-semibold">Adicionar usuário</h2>
              <Field label="Nome"><input className="input" name="name" required /></Field>
              <Field label="E-mail"><input className="input" name="email" type="email" required /></Field>
              <Field label="Senha provisória"><input className="input" name="password" type="password" minLength={10} required /></Field>
              <Field label="Papel"><select name="role" className="input" defaultValue="EDITOR">{ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select></Field>
              <SubmitButton>Adicionar</SubmitButton>
            </form>
          )}
          <form action={changePasswordAction} className="card space-y-3 p-5">
            <h2 className="font-semibold">Alterar minha senha</h2>
            <Field label="Senha atual"><input className="input" name="current" type="password" required /></Field>
            <Field label="Nova senha"><input className="input" name="next" type="password" minLength={10} required /></Field>
            <SubmitButton>Alterar</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
