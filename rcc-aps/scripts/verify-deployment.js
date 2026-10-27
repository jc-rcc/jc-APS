'use strict';
const assert = require('node:assert/strict');
async function main() {
  const base = process.env.DEPLOYMENT_URL;
  if (!base || !base.startsWith('https://')) throw new Error('DEPLOYMENT_URL must be an HTTPS URL.');
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const page = await fetch(base, { signal: AbortSignal.timeout(15000) });
      assert.equal(page.status, 200);
      assert.match(page.headers.get('content-type') || '', /text\/html/);
      assert.match(await page.text(), /<html/i);
      const api = await fetch(new URL('/api/health', base), { signal: AbortSignal.timeout(15000) });
      assert.equal(api.status, 200);
      assert.equal((await api.json()).status, 'ok');
      console.log('Public application and API are available. Database/login require separate verification.');
      return;
    } catch (error) {
      if (attempt === 6) throw error;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
