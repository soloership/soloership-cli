import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, lstat, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProject } from '../src/create.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'cli-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  await mkdir(join(source, 'scripts'), { recursive: true });
  await mkdir(join(source, 'config'));
  await writeFile(join(source, 'package.json'), JSON.stringify({ name: 'template', packageManager: 'pnpm@10.18.2', scripts: { setup: 'node scripts/setup.mjs', 'config:sync': 'node scripts/config-sync.mjs', 'skills:sync': 'node scripts/sync-skills.mjs' } }));
  await writeFile(join(source, 'soloership.config.json'), JSON.stringify({ app: { environment: 'production', name: 'original' }, cloudflare: { database: { id: 'real-id' } }, storage: {}, email: { from: 'owner@example.com' }, payments: { enabled: true }, ai: { model: 'private-model', baseURL: 'https://private.example' } }));
  for (const path of ['pnpm-lock.yaml', 'scripts/setup.mjs', 'config/schema.ts']) await writeFile(join(source, path), '');
  return { root, source };
}
test('copies source, resets account settings and excludes secrets/runtime artifacts', async t => {
  const { root, source } = await fixture(t);
  for (const folder of ['node_modules', '.wrangler', '.git', '.setup-backup', 'dist']) {
    await mkdir(join(source, folder)); await writeFile(join(source, folder, 'private'), 'secret');
  }
  await writeFile(join(source, '.dev.vars'), 'AUTH_SECRET=secret');
  await writeFile(join(source, '.dev.vars.example'), 'AUTH_SECRET=');
  await writeFile(join(source, 'config/.env.production'), 'KEY=secret');
  await writeFile(join(source, 'config/private.pem'), 'secret');
  const target = await createProject({ name: 'new-app', template: source, mode: 'directory', cwd: root });
  const config = JSON.parse(await readFile(join(target, 'soloership.config.json')));
  assert.equal(config.app.mode, 'directory'); assert.equal(config.app.environment, 'local');
  assert.equal(config.cloudflare.database.id, ''); assert.equal(config.cloudflare.workerName, 'new-app');
  assert.equal(config.ai.baseURL, ''); assert.equal(config.ai.enabled, false);
  assert.equal(config.email.provider, 'preview'); assert.equal(config.payments.enabled, false);
  assert.equal(JSON.parse(await readFile(join(target, 'package.json'))).private, true);
  for (const path of ['.dev.vars', 'config/.env.production', 'config/private.pem', 'dist', '.wrangler', '.git', '.setup-backup', 'node_modules'])
    await assert.rejects(lstat(join(target, path)), { code: 'ENOENT' });
  assert.equal(await readFile(join(target, '.dev.vars.example'), 'utf8'), 'AUTH_SECRET=');
  assert.equal(JSON.parse(await readFile(join(source, 'soloership.config.json'))).app.name, 'original');
});
test('never overwrites an existing directory', async t => {
  const { root, source } = await fixture(t);
  await mkdir(join(root, 'existing'));
  await writeFile(join(root, 'existing/keep'), 'untouched');
  await assert.rejects(createProject({ name: 'existing', template: source, cwd: root }), /already exists/);
  assert.equal(await readFile(join(root, 'existing/keep'), 'utf8'), 'untouched');
});
test('rejects symlinks and cleans only its failed new project', async t => {
  const { root, source } = await fixture(t);
  await writeFile(join(root, 'private'), 'secret');
  await symlink(join(root, 'private'), join(source, 'config/link'));
  await assert.rejects(createProject({ name: 'new-app', template: source, cwd: root }), /symbolic links/);
  await assert.rejects(lstat(join(root, 'new-app')), { code: 'ENOENT' });
  assert.equal(await readFile(join(root, 'private'), 'utf8'), 'secret');
});
test('validates arguments before creating files or making remote calls', async t => {
  const { root, source } = await fixture(t);
  for (const name of ['../escape', '-option', 'Bad Name', 'a'.repeat(41)])
    await assert.rejects(createProject({ name, template: source, cwd: root }), /Project name/);
  await assert.rejects(createProject({ name: 'nested', template: source, cwd: source }), /outside/);
  await assert.rejects(createProject({ name: 'app', template: source, ref: 'v1', cwd: root }), /only to GitHub/);
  await assert.rejects(createProject({ name: 'app', repo: 'https://token@github.com/org/repo', cwd: root }), /OWNER\/REPO/);
  await assert.rejects(createProject({ name: 'app', cwd: root }), /No default repository/);
});

test('GitHub download command selects a tag using Git (isolated local transport)', async t => {
  const { root, source } = await fixture(t);
  const { execFileSync, spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const git = args => execFileSync('git', args, { cwd: source, stdio: 'pipe' });
  git(['init']);
  git(['add', '.']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture']);
  git(['tag', 'v1']);
  const cli = fileURLToPath(new URL('../bin/create-soloership.mjs', import.meta.url));
  const env = { ...process.env,
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `url.file://${source}.insteadOf`,
    GIT_CONFIG_VALUE_0: 'https://github.com/fixture/template.git',
  };
  const result = spawnSync(process.execPath, [cli, 'tagged-app', '--repo', 'fixture/template', '--ref', 'v1', '--no-install'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(await readFile(join(root, 'tagged-app/package.json'))).name, 'tagged-app');
  await assert.rejects(lstat(join(root, 'tagged-app/.git')), { code: 'ENOENT' });
  const failed = spawnSync(process.execPath, [cli, 'bad-tag', '--repo', 'fixture/template', '--ref', 'missing', '--no-install'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /GitHub download failed/);
  await assert.rejects(lstat(join(root, 'bad-tag')), { code: 'ENOENT' });
});
