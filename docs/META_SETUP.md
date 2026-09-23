# Configurar o app da Meta

1. **Pré-requisitos:** Página do Facebook da Conecta Aqui; Instagram profissional (Empresa) vinculado a essa Página; conta no Meta Business (Business Manager) com a Página.
2. Em <https://developers.facebook.com/apps> crie um app do tipo **Business** e adicione o produto **Facebook Login for Business** (ou Facebook Login).
3. Em *Configurações do Login*, cadastre a URL de redirecionamento OAuth:
   `https://<domínio-do-app>/api/meta/oauth/callback`
4. Copie **App ID** e **App Secret** para `META_APP_ID` e `META_APP_SECRET`. (Opcional: crie uma *configuration* de Login for Business e use o ID em `META_LOGIN_CONFIG_ID`.)
5. Permissões usadas pelo app:
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights`
   - `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`
   - `business_management`
6. **Modo de desenvolvimento:** já funciona para quem tem papel no app (administrador/desenvolvedor/testador). Use isso para validar publicação real na conta da Conecta Aqui.
7. **Produção (App Review):** para operação contínua e contas de terceiros, solicite *Advanced Access* das permissões acima com vídeo demonstrando o fluxo (conectar → gerar → aprovar → publicar), política de privacidade pública e verificação da empresa. Prazos dependem da Meta.

## Limites conhecidos (Graph API v25)

- Instagram: 100 publicações via API em 24h por conta (o app consulta `content_publishing_limit`).
- Imagens do Instagram: somente **JPEG**; o app sempre exporta JPEG 1080×1350 (feed), 1080×1920 (stories/reels).
- Carrossel: 2 a 10 itens.
- Stories de vídeo no Facebook não estão implementados neste app (stories de imagem sim).
- Métricas: `impressions` e `plays` foram descontinuadas; o app usa `views`, `reach`, `total_interactions` etc. e coleta de forma tolerante (métricas indisponíveis ficam vazias).
