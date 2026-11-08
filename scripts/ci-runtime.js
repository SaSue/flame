// Validate the actual loaded native library, not just a package declaration.
const assert = require('node:assert/strict');
const fs = require('node:fs');
assert.equal(process.getuid(), 1000);
for (const path of ['/bin/sh', '/usr/bin/sh', '/usr/bin/apt-get', '/usr/local/bin/npm', '/usr/bin/mount', '/var/run/docker.sock']) {
  assert(!fs.existsSync(path), `Unexpected runtime tool/socket: ${path}`);
}
const metadata = JSON.parse(fs.readFileSync('/usr/share/flame/build-info.json'));
assert.equal(metadata.version, '3.54.1');
assert.equal(metadata.builder_npm, '12.2.2');
const sqlite = require('sqlite3');
const db = new sqlite.Database(':memory:');
db.get('SELECT sqlite_version() AS version', (error, row) => {
  if (error) throw error;
  assert.equal(row.version, '3.54.1');
  const maps = fs.readFileSync('/proc/self/maps', 'utf8');
  assert(maps.includes('/opt/sqlite/lib/libsqlite3.so'), 'External SQLite is not loaded');
  db.exec('CREATE VIRTUAL TABLE ci_fts USING fts5(body); INSERT INTO ci_fts VALUES (\'Flame SQLite test\');', error => {
    if (error) throw error;
    db.get("SELECT count(*) AS n FROM ci_fts WHERE ci_fts MATCH 'Flame'", (error, result) => {
      if (error) throw error;
      assert.equal(result.n, 1);
      db.close();
      console.log('PASS: minimal runtime, UID 1000, no shell/npm/APT/socket, SQLite 3.54.1 actually loaded, FTS5 functional');
    });
  });
});
