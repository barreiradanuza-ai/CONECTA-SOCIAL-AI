# Conecta Social AI

Gestor de redes sociais com inteligência artificial para **Facebook e Instagram**, construído para a **Conecta Aqui** (multimarca). Planeja 30 dias de conteúdo, gera textos e imagens, compõe as peças com a identidade visual, agenda, publica pelas APIs oficiais da Meta, coleta métricas e usa os resultados no planejamento seguinte — em **piloto automático**, com processos no servidor.

## Arquitetura

```
┌──────────────────────── Railway ────────────────────────┐
│  web (Next.js 15)          worker (Node + tsx)           │
│  ├ painel admin (RSC)      ├ publish.enqueue   (30 s)    │
│  ├ server actions          ├ publish.process   (20 s)    │
│  ├ OAuth Meta              ├ autopilot.plan    (6 h)     │
│  ├ /api/media (assinada)   ├ autopilot.produce (15 min)  │
│  └ /r/:code (WhatsApp)     ├ metrics.posts     (6 h)     │
│                            ├ metrics.accounts  (24 h)    │
│                            ├ insights.weekly   (7 d)     │
│                            ├ tokens.check / retention    │
│         │                  └ lock distribuído (TaskState) │
│         └──────────┬───────────────┘                     │
│              PostgreSQL           Bucket S3 (mídia)       │
└─────────────────────────────────────────────────────────┘
      │ Anthropic (Claude) — planejamento, legendas, análise
      │ OpenAI Images (gpt-image) — somente a fotografia de fundo
      │ Meta Graph API v25 — Facebook Login, publicação, insights
```

**Por que assim:** um único código com dois processos. O *web* serve o painel; o *worker* roda as tarefas agendadas sem depender do navegador. A fila é o próprio PostgreSQL (claims atômicos com `updateMany` + estado de tarefa com lock), o que dispensa Redis e evita publicações duplicadas mesmo com várias instâncias.

**Criativos híbridos:** a IA gera só a imagem (sem texto). Títulos, logotipo, preço e CTA são desenhados pelo motor de composição (Satori → Resvg → sharp), com fontes embutidas — sem erros de ortografia ou números. Preços vêm sempre do cadastro de ofertas, nunca do texto da IA.

**Guarda comercial:** todo texto gerado passa por uma verificação que bloqueia preços, velocidades comerciais, termos promocionais e prazos que não correspondam a uma oferta **aprovada e vigente**. Violações forçam aprovação humana.

## Estrutura

```
prisma/schema.prisma        modelo de dados (organização → marcas → posts/destinos/tentativas/métricas)
src/app/(app)/              painel: dashboard, calendário, studios, publicações, mídia, ofertas, relatórios, configurações
src/app/api/meta/oauth/     início e retorno do Facebook Login
src/app/api/media/          mídia com URL assinada (usada também pela Meta)
src/app/r/[code]/           página intermediária do WhatsApp (contagem anônima)
src/server/ai/              agente editorial (Claude), imagens (OpenAI), datas sazonais
src/server/creative/        layouts, composição, validação pré-publicação
src/server/meta/            Graph API: OAuth, publicação IG/FB, insights
src/server/automation/      planejador 30 dias, piloto automático, fila de publicação, métricas, manutenção
src/server/guard.ts         guarda comercial (puro, testado)
src/server/planner-core.ts  distribuição de slots e pilares (puro, testado)
src/worker/index.ts         processo de automação
tests/                      testes unitários (node:test)
```

## Rodar localmente

```bash
cp .env.example .env         # preencha DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY
npm install
npx prisma db push
npm run dev                  # painel em http://localhost:3000 → /setup cria o admin
npm run worker               # em outro terminal: automação
npm test                     # testes unitários
```

## Deploy (Railway)

Veja [docs/DEPLOY.md](docs/DEPLOY.md). Resumo: 1 Postgres, 1 Bucket, 2 serviços do mesmo repositório (Dockerfile) — `web` e `worker` (`SERVICE_ROLE=worker`).

## Documentação

- [docs/DEPLOY.md](docs/DEPLOY.md) — implantação e variáveis
- [docs/META_SETUP.md](docs/META_SETUP.md) — criar e aprovar o app da Meta
- [docs/STATUS.md](docs/STATUS.md) — o que está implementado, testado e o que depende de terceiros
- [docs/PASSO_A_PASSO.md](docs/PASSO_A_PASSO.md) — como obter as chaves (Anthropic, OpenAI, Meta) e enviar ao GitHub
