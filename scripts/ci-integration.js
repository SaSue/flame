// Runs only in a disposable CI container, never against production.
const assert = require('node:assert/strict');
const http = require('node:http');

async function main() {
  const base = 'http://127.0.0.1:5005';
  let token;
  async function request(path, { method = 'GET', body, authenticated = true, status = 200 } = {}) {
    const headers = {};
    if (authenticated && token) headers['Authorization-Flame'] = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch(base + path, { method, body, headers });
    const json = await res.json();
    assert.equal(res.status, status, `${method} ${path}: ${JSON.stringify(json)}`);
    return json.data;
  }
  await request('/api/auth', { method: 'POST', body: { password: 'wrong-password', duration: '1h' }, status: 401 });
  ({ token } = await request('/api/auth', { method: 'POST', body: { password: process.env.PASSWORD, duration: '1h' } }));
  assert.equal(typeof token, 'string');
  const verified = await request('/api/auth/validate', { method: 'POST', body: { token } });
  assert.equal(verified.token.isValid, true);
  const styles = '/* CI persistent styles */\nbody { --ci-test: 1; }';
  await request('/api/config/0/css', { method: 'PUT', body: { styles } });
  assert.equal(await request('/api/config/0/css'), styles);
  assert.equal(await (await fetch(base + '/flame.css')).text(), styles);
  assert.equal(require('node:fs').readFileSync('/app/data/flame.css', 'utf8'), styles);
  await request('/api/apps', { method: 'POST', body: { name: 'unauthorized' }, authenticated: false, status: 401 });

  const form = new FormData();
  form.set('name', 'CI private app');
  form.set('url', 'https://example.test');
  form.set('isPublic', '0');
  form.set('icon', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1EAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'ci.png');
  const app = await request('/api/apps', { method: 'POST', body: form, status: 201 });
  assert.match(app.icon, /ci\.png$/);
  const icon = await fetch(`${base}/uploads/${app.icon}`);
  assert.equal(icon.status, 200);
  assert.ok(Buffer.from(await icon.arrayBuffer()).length > 0);
  assert.ok(!(await request('/api/apps', { authenticated: false })).some(a => a.id === app.id));
  assert.ok((await request('/api/apps')).some(a => a.id === app.id));
  const updated = await request(`/api/apps/${app.id}`, { method: 'PUT', body: { name: 'CI updated', description: 'SQLite update check' } });
  assert.equal(updated.name, 'CI updated');
  await request(`/api/apps/${app.id}`, { method: 'DELETE' });
  assert.ok(!(await request('/api/apps')).some(a => a.id === app.id));

  const category = await request('/api/categories', { method: 'POST', body: { name: 'CI category' }, status: 201 });
  const bookmark = await request('/api/bookmarks', { method: 'POST', body: { name: 'CI bookmark', url: 'https://example.test/bookmark', categoryId: category.id }, status: 201 });
  assert.ok((await request('/api/bookmarks')).some(b => b.id === bookmark.id));
  await request(`/api/bookmarks/${bookmark.id}`, { method: 'PUT', body: { name: 'CI bookmark updated', categoryId: category.id, url: bookmark.url } });
  const categories = await request('/api/categories');
  assert.equal(categories.find(c => c.id === category.id).bookmarks[0].name, 'CI bookmark updated');
  await request(`/api/bookmarks/${bookmark.id}`, { method: 'DELETE' });
  await request(`/api/categories/${category.id}`, { method: 'DELETE' });

  // Exercise the real new Kubernetes SDK against a local fake API, without a
  // cluster, credentials, or production network access.
  const k8s = await import('@kubernetes/client-node');
  const server = http.createServer((req, res) => {
    assert.equal(req.url.split('?')[0], '/apis/networking.k8s.io/v1/ingresses');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ apiVersion: 'networking.k8s.io/v1', kind: 'IngressList', metadata: {}, items: [{ metadata: { name: 'ci-ingress' } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const kc = new k8s.KubeConfig();
    // The SDK requires this opt-in for the isolated, credential-free HTTP mock.
    // The production integration still uses verified in-cluster TLS settings.
    kc.loadFromOptions({ clusters: [{ name: 'ci', server: `http://127.0.0.1:${server.address().port}`, skipTLSVerify: true }], users: [{ name: 'ci' }], contexts: [{ name: 'ci', cluster: 'ci', user: 'ci' }], currentContext: 'ci' });
    const result = await kc.makeApiClient(k8s.NetworkingV1Api).listIngressForAllNamespaces();
    assert.equal(result.items[0].metadata.name, 'ci-ingress');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log('PASS: login/JWT, persistent CSS, authorization, SQLite CRUD, multipart upload, private visibility, categories/bookmarks, Kubernetes SDK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
