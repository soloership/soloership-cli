import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const template = process.argv[2];
if (!template) throw new Error('Usage: node scripts/smoke.mjs /absolute/template/path');
const cli = fileURLToPath(new URL('../bin/create-soloership.mjs', import.meta.url));
const root = await mkdtemp(join(tmpdir(), 'soloership-cli-smoke-'));
try {
  execFileSync(process.execPath, [cli, 'smoke-app', '--template', resolve(template), '--mode', 'corporate', '--yes', '--skip-admin', '--no-start'], { cwd: root, stdio: 'pipe' });
  const project = join(root, 'smoke-app');
  const config = JSON.parse(await readFile(join(project, 'soloership.config.json')));
  assert.equal(config.app.mode, 'corporate');
  assert.equal(config.cloudflare.database.name, 'smoke-app-db');
  for (const command of ['doctor', 'typecheck', 'build', 'check:secrets', 'test:setup']) {
    execFileSync('pnpm', ['run', command], { cwd: project, stdio: 'pipe' });
    console.log(`PASS ${command}`);
  }
  console.log('PASS CLI → template export → install → setup → local migrations → generated configuration → build → administrator login regression');
} catch (error) {
  // Provider/administrator secrets must never be included in test logs.
  console.error('Smoke failed. Child output withheld; no project secrets printed.');
  process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}
