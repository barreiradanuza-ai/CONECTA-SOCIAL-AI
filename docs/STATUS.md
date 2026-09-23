# Status honesto do projeto

Legenda: ✅ implementado e testado · 🧪 implementado, aguardando teste com credenciais reais · 🔒 depende de aprovação/credencial externa · 🗓️ planejado

## Testado nesta etapa

- ✅ Testes unitários (16 casos, `npm test`): fuso horário, guarda comercial (preços/velocidades/promoções/validade), planejador de 30 dias (frequências, carrosséis, reels só com vídeo, sem ofertas sem oferta válida), rebalanceamento de pilares em renovações diárias, melhor horário por histórico, datas sazonais, criptografia AES-GCM, senhas scrypt, tokens de sessão.
- ✅ Verificação de sintaxe de todos os arquivos TypeScript/TSX.
- ⏳ `next build` / checagem de tipos completa: executados no build do deploy (o ambiente de desenvolvimento usado não tinha acesso ao registro npm).

## Funcionalidades

| Área | Estado | Observação |
|---|---|---|
| Login, organizações, papéis (Owner/Admin/Editor/Leitura), auditoria | 🧪 | |
| Cadastro multimarca + identidade visual (logos, cores, fontes TTF/OTF, referências) | 🧪 | |
| Configuração guiada | 🧪 | |
| Agente editorial (Claude): temas 30 dias, conteúdo completo, ideias, análise | 🧪🔒 | requer `ANTHROPIC_API_KEY` |
| Geração de imagem (OpenAI gpt-image) | 🧪🔒 | requer `OPENAI_API_KEY` |
| Composição de peças (feed, 1:1, stories, carrossel, oferta) + validação | 🧪 | fontes embutidas |
| Calendário mês/semana/dia com arrastar e soltar | 🧪 | |
| Aprovação, edição, reagendamento, cancelamento, publicar agora | 🧪 | |
| Conexão Facebook/Instagram (OAuth oficial) | 🧪🔒 | requer app da Meta |
| Publicação IG: imagem, carrossel, stories, reels | 🧪🔒 | |
| Publicação FB: foto, multi-foto, story de foto, reels | 🧪🔒 | |
| Fila confiável: retries com backoff, reconciliação anti-duplicidade, histórico | 🧪 | |
| Piloto automático (planejar → produzir → agendar → publicar → medir → aprender) | 🧪 | |
| Métricas de posts e seguidores + relatórios com filtros | 🧪🔒 | |
| WhatsApp: links por publicação/campanha, página intermediária, ref no texto | 🧪 | |
| Webhook para CRM (Data Crazy) | 🧪 | envia evento anônimo; integração específica 🗓️ |
| Alertas: painel, webhook, e-mail (Resend) | 🧪 | e-mail requer `RESEND_API_KEY` |
| Retenção de dados (LGPD) | 🧪 | |
| Reels gerados por IA | ❌ | não assumido; usa vídeos enviados à biblioteca |
| Comentários/DMs, outras redes, biblioteca de prompts, comparação entre marcas | 🗓️ | arquitetura preparada (Network enum, multimarca) |

## Decisões que ainda dependem da Conecta Aqui

- Logotipo oficial (PNG/SVG transparente) e confirmação das cores (apenas `#071b45` foi extraída do site).
- Número de WhatsApp comercial.
- Nome da segunda marca.
- Ofertas vigentes (operadora, velocidade, preço, benefícios, validade).
