ARG NODE_IMAGE=node:24-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d
FROM ${NODE_IMAGE} AS patched-base
ARG NPM_VERSION=12.2.2

# CI changes APT_REFRESH for every run, including retries, so package updates
# are actually executed rather than reusing an old Docker build layer.
ARG APT_REFRESH=manual
RUN echo "APT refresh: ${APT_REFRESH}" \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global --ignore-scripts --no-audit --no-fund "npm@${NPM_VERSION}" \
    && npm cache clean --force

FROM patched-base AS builder
ARG APP_VERSION=2.4.0
ENV REACT_APP_VERSION=${APP_VERSION}
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p public data \
    && cd client \
    && npm ci \
    && npm run build \
    && cd .. \
    && cp -a client/build/. public/ \
    && rm -rf client

FROM patched-base AS runtime
WORKDIR /app
ARG APP_VERSION=2.4.0
ENV NODE_ENV=production VERSION=${APP_VERSION}
COPY --from=builder --chown=node:node /app /app
ARG VCS_REF
LABEL org.opencontainers.image.source="https://github.com/SaSue/flame" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.base.name="node:24-trixie-slim" \
      org.opencontainers.image.base.digest="sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d"
USER node
EXPOSE 5005
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:5005/').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
