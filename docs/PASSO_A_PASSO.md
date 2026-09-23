# Passo a passo: credenciais do Conecta Social AI

As telas das plataformas mudam com frequência. Se algum botão tiver outro nome, procure a opção equivalente.

---

## 1. Enviar o código ao GitHub (repositório `barreiradanuza-ai/CONECTA-SOCIAL-AI`)

**Opção A — autorizar o Claude a enviar:** no app do Claude, adicione o repositório `barreiradanuza-ai/CONECTA-SOCIAL-AI` às fontes (sources) desta sessão/projeto e me avise. Eu faço o envio.

**Opção B — enviar você mesma pelo navegador:**
1. Descompacte o arquivo `conecta-social-ai.zip` no seu computador.
2. Abra <https://github.com/barreiradanuza-ai/CONECTA-SOCIAL-AI>.
3. Clique em **Add file → Upload files**.
4. Arraste **o conteúdo** da pasta descompactada (as pastas `src`, `prisma`, `docs`, `assets`, `scripts`, `tests` e os arquivos `package.json`, `Dockerfile` etc.). Não envie a pasta externa em si.
5. Clique em **Commit changes**.

---

## 2. Chave da Anthropic (Claude — textos e planejamento)

1. Acesse <https://console.anthropic.com> e crie a conta (pode usar o e-mail da empresa).
2. Menu **Settings → Billing**: cadastre um cartão e compre créditos (comece com US$ 20–50).
3. Menu **Settings → API Keys → Create Key**. Dê o nome `conecta-social-ai`.
4. Copie a chave (começa com `sk-ant-`). **Ela só aparece uma vez.**
5. No app: **Configurações → Integrações e chaves → Anthropic** → cole e salve.

Custo estimado: planejar 30 dias + gerar ~60 publicações por mês fica tipicamente entre US$ 5 e US$ 20/mês com o modelo padrão (Claude Sonnet).

---

## 3. Chave da OpenAI (geração de imagens)

1. Acesse <https://platform.openai.com> e crie a conta.
2. **Settings → Billing**: adicione um cartão e créditos (comece com US$ 20).
3. **Settings → Organization → General → Verify Organization**: faça a verificação da organização. **Os modelos de imagem `gpt-image` exigem essa verificação** (envio de documento; costuma levar alguns minutos).
4. **API keys → Create new secret key** (nome `conecta-social-ai`, permissões *All*). Copie a chave (começa com `sk-`).
5. No app: **Configurações → Integrações e chaves → OpenAI** → cole e salve.

Custo estimado: cada imagem em qualidade média custa alguns centavos de dólar; ~90 imagens/mês ficam normalmente abaixo de US$ 10.

---

## 4. App da Meta (Facebook + Instagram)

### Antes de começar
- A **Página do Facebook** da Conecta Aqui precisa existir e você precisa ser **administradora**.
- O **Instagram** precisa ser **conta profissional (Empresa)** e estar **vinculado à Página**: no Instagram, *Configurações → Conta → Compartilhamento com outros apps/Contas vinculadas*; ou no Facebook, *Configurações da Página → Contas vinculadas → Instagram*.
- Tenha um **Meta Business Portfolio (Business Manager)** em <https://business.facebook.com> com a Página adicionada.

### Criar o app
1. Acesse <https://developers.facebook.com> → **Meus apps → Criar app**.
2. Caso de uso: escolha a opção de **gerenciar tudo na sua Página** / **Outro → Empresa (Business)**. Vincule ao seu portfólio empresarial.
3. Nome do app: `Conecta Social AI`. E-mail de contato: o seu.
4. No painel do app, adicione os produtos/casos de uso:
   - **Facebook Login for Business** (ou Facebook Login);
   - **Instagram** (API do Instagram com login do Facebook) e **Pages API**, se oferecidos separadamente.
5. **Facebook Login → Configurações → URIs de redirecionamento OAuth válidos**: cole
   `https://web-production-7f4e7.up.railway.app/api/meta/oauth/callback`
   
6. **Configurações do app → Básico**:
   - copie o **ID do app** e a **Chave secreta do app** e me envie por um canal seguro (ou cole direto nas variáveis do Railway: `META_APP_ID` e `META_APP_SECRET`);
   - preencha **URL da política de privacidade** (pode usar `https://web-production-7f4e7.up.railway.app/privacidade`) e **Categoria**.
7. **Funções do app → Funções**: garanta que sua conta pessoal do Facebook seja **Administradora** do app.

### Testar (modo desenvolvimento)
8. Com o app em **modo desenvolvimento**, entre no Conecta Social AI → **Configurações → Contas sociais → Conectar Facebook e Instagram**. Autorize a Página e o Instagram. Já dá para publicar de verdade nas suas contas, porque você tem função no app.

### Colocar em produção (App Review)
9. **Revisão do app → Permissões e recursos**: solicite *Advanced Access* para
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `business_management`.
10. Para cada permissão, a Meta pede uma descrição do uso e um **vídeo de tela** mostrando o fluxo (conectar → gerar → aprovar → publicar). Eu preparo o roteiro do vídeo e os textos quando chegarmos nessa etapa.
11. **Verificação da empresa** (Business Verification) no portfólio: CNPJ, comprovante e domínio.
12. Depois de aprovado, mude o app para **Ativo (Live)**.

> Enquanto o App Review não termina, o app funciona normalmente para as contas da própria Conecta Aqui administradas por quem tem função no app — suficiente para operar as redes da empresa.

---

## 5. Materiais e dados comerciais

| Item | Onde cadastrar |
|---|---|
| Logotipo PNG/SVG com fundo transparente (+ versão principal) | Configurações → Marca → Enviar materiais |
| Cores oficiais (hex) e fontes (TTF/OTF) | Configurações → Marca |
| Imagens oficiais do personagem (3–4, rosto e corpo, fundo neutro) | Configurações → Marca → “Referência do personagem” |
| Nome do personagem e da série | Configurações → Marca → Personagem |
| WhatsApp comercial (DDI+DDD+número) | Configurações → WhatsApp |
| Segunda marca | Configurações → Marcas |
| Ofertas (operadora, velocidade, preço, benefícios, regiões, validade, restrições) | Ofertas comerciais → cadastrar → aprovar |
