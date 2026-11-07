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

Published images:

- `ghcr.io/sasue/flame:sha-<full commit>`: tested commit for both architectures.
- `ghcr.io/sasue/flame:latest`: last successful multiarch build.

Production should use the verified commit tag or digest. The `latest` tag is a
convenience pointer, not a guarantee of security. Each architecture includes a
Trivy report for HIGH/CRITICAL findings. Reports must be reviewed before
deployment; the initial pipeline reports findings without silently ignoring them.

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
