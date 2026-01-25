FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl tar \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Install Linux vtracer (x86_64 musl) into /app/bin/vtracer
ARG VTRACER_TAG=0.6.4
RUN set -eux; \
  mkdir -p /app/bin; \
  url="https://github.com/visioncortex/vtracer/releases/download/${VTRACER_TAG}/vtracer-x86_64-unknown-linux-musl.tar.gz"; \
  echo "Downloading $url"; \
  curl -fL --retry 3 --retry-delay 2 -o /tmp/vtracer.tgz "$url"; \
  tar -tzf /tmp/vtracer.tgz >/dev/null; \
  tar -xzf /tmp/vtracer.tgz -C /tmp; \
  mv /tmp/vtracer-*/vtracer /app/bin/vtracer; \
  chmod +x /app/bin/vtracer; \
  /app/bin/vtracer --help >/dev/null

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh","-c","npm run start -- -p ${PORT:-3000}"]