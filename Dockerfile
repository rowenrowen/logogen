FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl tar \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Install Linux vtracer (x86_64 musl)
RUN mkdir -p /app/bin \
 && curl -L -o /tmp/vtracer.tgz https://github.com/visioncortex/vtracer/releases/download/0.6.4/vtracer-x86_64-unknown-linux-musl.tar.gz \
 && tar -xzf /tmp/vtracer.tgz -C /tmp \
 && mv /tmp/vtracer /app/bin/vtracer \
 && chmod +x /app/bin/vtracer \
 && /app/bin/vtracer --help >/dev/null

RUN pwd && ls -la
RUN ls -la /app/lib || true
RUN ls -la /app/src/lib || true
RUN node -p "require('fs').existsSync('/app/lib/generateSvg.ts')"
RUN node -p "require('fs').existsSync('/app/src/lib/generateSvg.ts')"
RUN cat /app/tsconfig.json || true
RUN cat /app/jsconfig.json || true

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh","-c","npm run start -- -p ${PORT:-3000}"]
