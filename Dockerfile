FROM node:20-bullseye-slim

# System deps needed for downloading + unpacking vtracer
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl tar \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL deps (including devDeps) because Next build needs them (e.g. tailwindcss)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Install Linux vtracer (x86_64 musl) into /app/bin/vtracer
ARG VTRACER_VERSION=0.6.4
RUN mkdir -p /app/bin \
 && curl -L -o /tmp/vtracer.tgz \
    "https://github.com/visioncortex/vtracer/releases/download/v${VTRACER_VERSION}/vtracer-x86_64-unknown-linux-musl.tar.gz" \
 && tar -xzf /tmp/vtracer.tgz -C /tmp \
 && mv /tmp/vtracer-*/vtracer /app/bin/vtracer \
 && chmod +x /app/bin/vtracer \
 && /app/bin/vtracer --help >/dev/null

# Build Next.js
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Railway sets PORT; default to 3000 locally
CMD ["sh","-c","npm run start -- -p ${PORT:-3000}"]