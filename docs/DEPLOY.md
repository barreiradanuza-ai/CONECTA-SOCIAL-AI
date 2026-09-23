# Implantação no Railway

## Serviços

| Serviço | Origem | Variáveis específicas |
|---|---|---|
| `Postgres` | template Postgres | — |
| `media` | Railway Bucket | — |
| `web` | este repositório (Dockerfile) | domínio público gerado |
| `worker` | este repositório (Dockerfile) | `SERVICE_ROLE=worker` |

O `web` roda `prisma db push` ao iniciar (cria/atualiza as tabelas) e depois `next start`. O `worker` roda `tsx src/worker/index.ts`.

## Variáveis (web e worker)

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_URL=https://<domínio-do-web>
SESSION_SECRET=<openssl rand -base64 48>
ENCRYPTION_KEY=<openssl rand -base64 32>      # a MESMA nos dois serviços
SETUP_TOKEN=<código para criar o primeiro admin>
S3_BUCKET / S3_ENDPOINT / S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY  (referências do bucket)
META_APP_ID / META_APP_SECRET                 # quando o app da Meta existir
ANTHROPIC_API_KEY / OPENAI_API_KEY            # ou cadastre pelo painel
```

> ⚠️ Não troque `ENCRYPTION_KEY` depois de conectar contas: os tokens salvos ficariam ilegíveis (seria preciso reconectar).

## Primeiro acesso

1. Abra `https://<domínio>/setup`, informe o `SETUP_TOKEN`, crie o administrador.
2. Siga a configuração guiada no dashboard: identidade visual → chaves de IA → Meta → WhatsApp → automação.

## Verificação

- `GET /api/health` → `{ ok: true, db: "ok", worker: "ok" }` quando o worker está rodando.
- Dashboard → "Tarefas automáticas do servidor" mostra a última execução de cada tarefa.

## Sem Railway

Qualquer host com Docker + PostgreSQL funciona: rode a mesma imagem duas vezes (uma com `SERVICE_ROLE=worker`). Sem bucket S3, a mídia vai para `STORAGE_DIR` (use um volume persistente).
