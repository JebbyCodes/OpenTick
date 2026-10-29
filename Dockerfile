# OpenTick as a website you host yourself. OpenTick keeps its data in the browser and syncs by WebDAV, so there is no database or server code:
# this is just the built app behind nginx.   docker run -p 8080:8080 ghcr.io/jebbycodes/opentick   then open http://localhost:8080
#   /        the normal app          /eink/   the e-ink edition (black and white, no animation, page buttons)
# Built for linux/amd64, arm64, arm/v7 and 386 (older and 32-bit machines, Raspberry Pi, NAS boxes).

# the build runs on the builder's own CPU (fast, no emulation); only the tiny final image is per-architecture
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN node build-app.mjs --out site \
 && node build-app.mjs --eink --out site/eink

FROM nginxinc/nginx-unprivileged:stable-alpine
ARG VERSION=dev
LABEL org.opencontainers.image.title="OpenTick" \
      org.opencontainers.image.description="Open-source task manager, as a self-hosted web app" \
      org.opencontainers.image.source="https://github.com/JebbyCodes/OpenTick" \
      org.opencontainers.image.licenses="Unlicense" \
      org.opencontainers.image.version="$VERSION"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/site /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
