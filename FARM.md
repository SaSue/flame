# Raspberry Farm build

This fork builds Flame on the supported Node 24 LTS Debian 13 slim image for
`linux/amd64` and `linux/arm64`. Both architectures build and run smoke tests on
native GitHub-hosted runners. The Raspberry Pi only downloads tested images.

The build stages run `apt-get update` and `apt-get -y full-upgrade`, with a
per-run `APT_REFRESH` cache key. npm 12.2.2 is used only during the build.
The final image uses pinned `gcr.io/distroless/cc-debian13:nonroot`, Node 24,
and UID/GID 1000. It contains no shell, APT, npm, or SQLite CLI. Updating APT
in the builder does not update the separate distroless runtime; review its
scanner findings and refresh its pinned digest separately.

SQLite 3.54.1 is downloaded from the official source and verified against the
SHA3-256 in `.docker/sqlite-source.json`. The Node addon is explicitly compiled
against that shared library; implicit backend install scripts are disabled.
Frontend dependencies retain the reviewed install-script allowlist. CI checks
the actual SQLite query result, loaded shared-library path, and FTS5 support.
A separate CycloneDX SBOM records the custom SQLite library and binary hash,
and Grype scans it in addition to the full-image Trivy scan.

Published images:

- `ghcr.io/sasue/flame:sha-<full commit>`: tested commit for both architectures.
- `ghcr.io/sasue/flame:latest`: last successful master build.
- `ghcr.io/sasue/flame:candidate-minimal`: tested feature-branch candidate; does not update latest.

Production should use the verified commit tag or digest. The `latest` tag is a
convenience pointer, not a guarantee of security. Each architecture includes a
Trivy report for all severity levels. Reports must be reviewed before
deployment. Any CRITICAL finding blocks publication of the multiarch manifest
and `latest`; the full scan reports are retained as workflow artifacts.

Each architecture tests login/JWT, rejection of unauthenticated writes, private
app visibility, SQLite-backed app/category/bookmark CRUD, multipart icon uploads,
and the actual current Kubernetes client against a credential-free local mock.
The Kubernetes mock uses HTTP only on loopback inside the disposable container;
production in-cluster TLS verification is unchanged. The runtime is also checked
for UID 1000, lack of a Docker socket, and the expected source revision.

CI runs the container with a read-only root filesystem, all capabilities dropped,
no network, and no-new-privileges. Custom CSS is served from `/app/data/flame.css`
so it remains editable without writing to the application directory.

The runtime uses UID/GID 1000 and a HTTP healthcheck. The persistent data directory
must be writable by that account. No root startup `chown` is performed. Docker
discovery defaults to disabled. Do not mount `/var/run/docker.sock`.

Example (supply your own password through a protected environment file):

```yaml
services:
  flame:
    image: ghcr.io/sasue/flame:sha-<verified-commit>
    env_file: /path/to/protected/flame.env
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=16m
    volumes:
      - /path/to/flame-data:/app/data
    deploy:
      resources:
        limits:
          memory: 256M
```

This workflow is triggered by source pushes or explicit manual dispatches, with
no scheduled deployments or builds. It does not access your home network, SSH
keys, production passwords or data. GitHub's per-job `GITHUB_TOKEN` publishes to
GHCR. Actions in this fork are enabled deliberately; upstream workflows are not
automatically imported or executed.

For a local build, provide the actual commit and a fresh APT cache key:

```sh
docker build -f .docker/Dockerfile \
  --build-arg VCS_REF="$(git rev-parse HEAD)" \
  --build-arg APT_REFRESH="$(date -u +%Y%m%dT%H%M%SZ)" \
  -t flame:local .
```

Changing the Node base and installing security updates does not modernize
Flame's older React/Express dependencies. Review scan findings and test upgrades
before changing those dependencies or the production image.
