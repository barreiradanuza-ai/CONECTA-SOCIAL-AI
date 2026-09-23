# O código-fonte completo vem em source.zip (enviado ao GitHub como arquivo único).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY source.zip /tmp/source.zip
RUN unzip -q -o /tmp/source.zip -d /app && rm /tmp/source.zip

RUN npm install --no-audit --no-fund
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
