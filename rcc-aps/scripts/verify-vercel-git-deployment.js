'use strict';
const assert = require('node:assert/strict');

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const revision = process.env.GITHUB_SHA;
  const token = process.env.GITHUB_TOKEN;
  const base = 'https://jc-aps.vercel.app';
  assert.equal(repository, 'jc-rcc/jc-APS', 'Verify only the assignment repository.');
  assert.match(revision || '', /^[a-f0-9]{40}$/);
  assert.ok(token, 'The automatic GitHub Actions token is required.');

  for (let attempt = 1; attempt <= 40; attempt++) {
    const response = await fetch(`https://api.github.com/repos/${repository}/commits/${revision}/status`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(15000)
    });
    assert.equal(response.status, 200, 'Cannot read deployment status.');
    const data = await response.json();
    const vercel = data.statuses.find(item => item.context === 'Vercel');
    if (vercel && ['failure', 'error'].includes(vercel.state)) {
      throw new Error('Vercel build/deployment failed. Open the Vercel check for build logs.');
    }
    if (vercel?.state === 'success') {
      const page = await fetch(base, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      assert.equal(page.status, 200);
      assert.match(page.headers.get('content-type') || '', /text\/html/);
      assert.match(await page.text(), /<html/i);
      const health = await fetch(base + '/api/health', { redirect: 'error', signal: AbortSignal.timeout(15000) });
      assert.equal(health.status, 200);
      const info = await health.json();
      assert.equal(info.status, 'ok');
      if (info.revision === revision) {
        console.log('PASS: Vercel Git integration deployed this exact commit and the production API is healthy.');
        console.log(`Production: ${base}`);
        const fs = require('node:fs');
        if (process.env.GITHUB_STEP_SUMMARY) {
          fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
            `## Verified automatic production deployment\n\n- Application: ${base}\n- Source commit: ${revision}\n- Vercel build: ${vercel.target_url}\n- Public page and API: HTTP 200\n\nVercel runs syntax and smoke tests before publishing. PostgreSQL integration tests passed in the preceding checks job.\n`);
        }
        return;
      }
    }
    console.log(`Waiting for this commit's Vercel production deployment (${attempt}/40).`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  throw new Error('No matching successful production deployment appeared within ten minutes.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
