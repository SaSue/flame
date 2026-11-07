# Raspberry Farm build

This fork builds Flame on the supported Node 24 LTS Debian 13 slim image for
`linux/amd64` and `linux/arm64`. Both architectures build and run smoke tests on
native GitHub-hosted runners. The Raspberry Pi only downloads tested images.

The common base stage runs `apt-get update` and `apt-get -y full-upgrade` before
either the builder or runtime stage uses it. A per-run `APT_REFRESH` argument
invalidates this package-update layer on every Actions run and retry. The build
uses a pinned Node multiarch digest, npm lockfiles, commit-pinned Actions,
an OCI source/revision label, SBOM and build provenance. Update the Node digest
deliberately when a new supported base is selected. Package upgrades do not
replace application dependency maintenance or vulnerability review.

npm is pinned to 12.2.2 in the common base and checked by CI. Dependency install
scripts are denied by default. Only the reviewed `sqlite3@6.0.1` native installer
is permitted; unused optional/watch and donation scripts are explicitly denied.
Both backend and frontend use `npm ci --strict-allow-scripts`, so new unreviewed
installation hooks fail the build rather than executing automatically.

Published images:

- `ghcr.io/sasue/flame:sha-<full commit>`: tested commit for both architectures.
- `ghcr.io/sasue/flame:latest`: last successful multiarch build.

Production should use the verified commit tag or digest. The `latest` tag is a
convenience pointer, not a guarantee of security. Each architecture includes a
Trivy report for HIGH/CRITICAL findings. Reports must be reviewed before
deployment. Any CRITICAL finding blocks publication of the multiarch manifest
and `latest`; the full scan reports are retained as workflow artifacts.

Each architecture tests login/JWT, rejection of unauthenticated writes, private
app visibility, SQLite-backed app/category/bookmark CRUD, multipart icon uploads,
and the actual current Kubernetes client against a credential-free local mock.
The Kubernetes mock uses HTTP only on loopback inside the disposable container;
production in-cluster TLS verification is unchanged. The runtime is also checked
for UID 1000, lack of a Docker socket, and the expected source revision.

The runtime uses UID/GID 1000 and a HTTP healthcheck. The persistent data directory
must be writable by that account. No root startup `chown` is performed. Docker
discovery defaults to disabled. Do not mount `/var/run/docker.sock`.

Example (supply your own password through a protected environment file):

```yaml
services:
  flame:
    image: ghcr.io/sasue/flame:sha-<verified-commit>
    env_file: /path/to/protected/flame.env
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
