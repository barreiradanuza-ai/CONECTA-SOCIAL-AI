import { Tabs } from "@/components/ui";

const ITEMS = [
  { key: "brand", label: "Marca e identidade" },
  { key: "accounts", label: "Contas sociais" },
  { key: "automation", label: "Automação" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "integrations", label: "Integrações e chaves" },
  { key: "users", label: "Usuários" },
  { key: "brands", label: "Marcas" },
  { key: "audit", label: "Auditoria" },
];

export function SettingsTabs({ current }: { current: string }) {
  return <Tabs current={current} items={ITEMS.map((i) => ({ ...i, href: `/settings/${i.key}` }))} />;
}
