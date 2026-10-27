'use strict';
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'isolated-http-test-secret';
process.env.VERCEL = '1';
const app = require('../api');
async function main() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<html/i);
    const script = await fetch(base + '/js/auth.js');
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /javascript/);
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
    for (const route of ['/api/data', '/api/db/status', '/api/employees']) {
      assert.equal((await fetch(base + route)).status, 401, route);
    }
    console.log('PASS: serverless entry serves UI, assets, health, and requires authentication.');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
