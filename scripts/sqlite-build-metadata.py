"""Record the custom native library as a real, independently scannable component."""
import hashlib
import json
from pathlib import Path
import platform
import subprocess

source = json.loads(Path('.docker/sqlite-source.json').read_text())
version = source['version']
lib = Path('/opt/sqlite/lib/libsqlite3.so.0')
metadata = dict(source, architecture=platform.machine(), library_sha256=hashlib.sha256(lib.read_bytes()).hexdigest(), builder_npm=subprocess.check_output(['npm', '--version'], text=True).strip())
out = Path('/opt/sqlite/share/flame')
out.mkdir(parents=True, exist_ok=True)
(out/'build-info.json').write_text(json.dumps(metadata, indent=2)+'\n')
bom = {'bomFormat': 'CycloneDX', 'specVersion': '1.6', 'version': 1, 'components': [{
    'type': 'library', 'bom-ref': 'sqlite-'+version, 'name': 'sqlite', 'version': version,
    'purl': 'pkg:generic/sqlite@'+version,
    'cpe': 'cpe:2.3:a:sqlite:sqlite:'+version+':*:*:*:*:*:*:*',
    'hashes': [{'alg': 'SHA-256', 'content': metadata['library_sha256']}],
    'licenses': [{'license': {'name': 'Public Domain'}}],
    'externalReferences': [{'type': 'distribution', 'url': source['url'], 'hashes': [{'alg': 'SHA3-256', 'content': source['sha3_256']}]}]
}]}
(out/'sqlite.cdx.json').write_text(json.dumps(bom, indent=2)+'\n')
