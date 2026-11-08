ARG NODE_IMAGE=node:24-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d
ARG RUNTIME_IMAGE=gcr.io/distroless/cc-debian13:nonroot@sha256:08476c244888bfb425bae1ae4dd7c17f093e972aab8426883d97f3c6f280f7c1
FROM ${NODE_IMAGE} AS patched-base
ARG NPM_VERSION=12.2.2
ARG APT_REFRESH=manual
RUN echo "APT refresh: ${APT_REFRESH}" \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global --ignore-scripts --no-audit --no-fund "npm@${NPM_VERSION}" \
    && npm cache clean --force

FROM patched-base AS sqlite-build
WORKDIR /src
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ pkg-config \
    && rm -rf /var/lib/apt/lists/*
COPY .docker/sqlite-source.json .docker/sqlite-source.json
COPY scripts/fetch-sqlite.py scripts/sqlite-build-metadata.py scripts/
RUN python3 scripts/fetch-sqlite.py \
    && cd /tmp/sqlite-source/sqlite-autoconf-* \
    && CFLAGS="-O2 -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS4 -DSQLITE_ENABLE_FTS5 -DSQLITE_ENABLE_RTREE -DSQLITE_ENABLE_COLUMN_METADATA" \
       ./configure --prefix=/opt/sqlite --disable-static --enable-shared \
    && make -j2 \
    && make install \
    && cd /src \
    && python3 scripts/sqlite-build-metadata.py

FROM sqlite-build AS builder
ARG APP_VERSION=2.4.0
ENV REACT_APP_VERSION=${APP_VERSION} LD_LIBRARY_PATH=/opt/sqlite/lib
WORKDIR /app
COPY package.json package-lock.json ./
# Build explicitly against the verified external library, never a prebuilt addon
# with an older bundled SQLite. All implicit dependency scripts stay disabled.
RUN npm ci --omit=dev --ignore-scripts \
    && cd node_modules/sqlite3 \
    && node ../node-gyp/bin/node-gyp.js rebuild --sqlite=/opt/sqlite --nodedir=/usr/local
COPY . .
RUN node -e "const s=require('sqlite3');const d=new s.Database(':memory:');d.get('select sqlite_version() version',(e,r)=>{if(e)throw e;if(r.version!=='3.54.1')process.exit(1);console.log(r);d.close()})" \
    && ldd node_modules/sqlite3/build/Release/node_sqlite3.node | grep /opt/sqlite/lib/libsqlite3.so \
    && rm -rf node_modules/sqlite3/deps node_modules/sqlite3/src \
    && find node_modules/sqlite3/build -type f ! -name "*.node" -delete \
    && mkdir -p public data \
    && cd client \
    && npm ci --strict-allow-scripts \
    && npm run build \
    && cd .. \
    && cp -a client/build/. public/ \
    && rm -rf client

FROM ${RUNTIME_IMAGE} AS runtime
WORKDIR /app
ARG APP_VERSION=2.4.0
ARG VCS_REF
ENV NODE_ENV=production VERSION=${APP_VERSION} \
    PATH=/usr/local/bin LD_LIBRARY_PATH=/opt/sqlite/lib
COPY --from=patched-base /usr/local/bin/node /usr/local/bin/node
COPY --from=sqlite-build /opt/sqlite/lib/libsqlite3.so* /opt/sqlite/lib/
COPY --from=sqlite-build /opt/sqlite/share/flame/ /usr/share/flame/
COPY --from=builder --chown=1000:1000 /app /app
LABEL org.opencontainers.image.source="https://github.com/SaSue/flame" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.base.name="gcr.io/distroless/cc-debian13:nonroot" \
      org.opencontainers.image.base.digest="sha256:08476c244888bfb425bae1ae4dd7c17f093e972aab8426883d97f3c6f280f7c1" \
      com.suechting.flame.sqlite.version="3.54.1"
USER 1000:1000
EXPOSE 5005
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["/usr/local/bin/node", "-e", "fetch('http://127.0.0.1:5005/').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/local/bin/node"]
CMD ["server.js"]
