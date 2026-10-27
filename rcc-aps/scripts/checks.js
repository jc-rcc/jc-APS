'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? files(name) : name.endsWith('.js') ? [name] : [];
  });
}
if (process.argv[2] === 'lint') {
  const sources = ['api', 'server', 'public/js', 'scripts', 'test'].flatMap(files);
  for (const file of sources) run(['--check', file]);
  console.log(`Syntax checks passed: ${sources.length} JavaScript files.`);
} else {
  const tests = files('test').filter(file => file.endsWith('.smoke.js')).sort();
  for (const file of tests) run([file]);
  console.log(`Smoke tests passed: ${tests.length} files.`);
}
