#!/bin/sh
# Um único artefato de build, dois papéis: web (painel + API) e worker (automação).
set -e
if [ "$SERVICE_ROLE" = "worker" ]; then
  echo "[start] iniciando WORKER de automação"
  exec npx tsx src/worker/index.ts
else
  echo "[start] sincronizando schema do banco"
  npx prisma db push --skip-generate
  echo "[start] iniciando WEB na porta ${PORT:-3000}"
  exec npx next start -p "${PORT:-3000}"
fi
