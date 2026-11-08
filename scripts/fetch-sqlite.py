"""Fetch pinned SQLite source, verifying the vendor-published SHA3-256."""
import hashlib
import json
from pathlib import Path
import tarfile
import urllib.request

spec = json.loads(Path('.docker/sqlite-source.json').read_text())
archive = Path('/tmp/sqlite-source.tar.gz')
archive.write_bytes(urllib.request.urlopen(spec['url'], timeout=90).read())
assert hashlib.sha3_256(archive.read_bytes()).hexdigest() == spec['sha3_256'], 'SQLite source checksum mismatch'
with tarfile.open(archive) as source:
    source.extractall('/tmp/sqlite-source', filter='data')
print('Verified SQLite ' + spec['version'])
