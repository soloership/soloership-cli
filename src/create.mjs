import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

// Canonical template repository; callers may explicitly override it.
export const defaultRepository = 'soloership/soloership';
const roots = new Set([
  'src', 'config', 'migrations', 'scripts', 'skills', 'tests', 'docs', '.github',
  '.gitignore', '.dev.vars.example', 'package.json', 'pnpm-lock.yaml',
  'soloership.config.json', 'site.config.ts', 'tsconfig.json', 'vite.config.ts',
  'vitest.config.ts', 'playwright.config.ts', 'playwright.presets.config.ts',
  'worker-configuration.d.ts', 'README.md', 'README.zh-CN.md', 'AGENTS.md', 'PRODUCT.md', 'DESIGN.md',
  'LICENSE', 'LICENSE.md', 'NOTICE',
]);
const excluded = new Set(['node_modules', 'dist', '.git', '.wrangler', '.tanstack', '.setup-backup', 'test-results', 'playwright-report', '.DS_Store']);
export function run(command, args, cwd, quiet = false) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, stdio: quiet ? 'ignore' : 'inherit' });
    child.on('error', () => reject(new Error(`Cannot run ${command}. Check that it is installed.`)));
    child.on('exit', (code, signal) => code === 0 ? accept() : reject(new Error(`${command} failed (${signal || code}).`)));
  });
}
export async function createProject({ name, template, repo, ref, mode, cwd = process.cwd() }) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name || '') || name.length > 40)
    throw new Error('Project name must be lowercase kebab-case, start with a letter, and contain at most 40 characters.');
  if (mode && !['saas', 'corporate', 'directory'].includes(mode)) throw new Error('Mode must be saas, corporate or directory.');
  if (template && repo) throw new Error('Choose --template or --repo, not both.');
  if (template && ref) throw new Error('--ref applies only to GitHub repositories.');
  if (!template && !repo) throw new Error('No default repository is configured yet. Supply --template PATH or --repo OWNER/REPO.');
  if (repo && !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repo))
    throw new Error('Repository must be a GitHub OWNER/REPO, without a URL or credentials.');
  if (ref && (ref.startsWith('-') || /[\s\x00-\x1f]/.test(ref))) throw new Error('Invalid branch or tag.');
  const target = resolve(cwd, name);
  try {
    await lstat(target);
    throw new Error('Target directory already exists. Choose a new project name.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let temporary;
  let created = false;
  try {
    let source;
    if (template) {
      source = await realpath(resolve(cwd, template));
      const targetParent = await realpath(cwd);
      const destination = join(targetParent, name);
      if (destination === source || destination.startsWith(source + sep))
        throw new Error('Create the project outside the template directory.');
    } else {
      temporary = await mkdtemp(join(tmpdir(), 'soloership-source-'));
      source = join(temporary, 'template');
      const args = ['clone', '--depth', '1', '--single-branch'];
      if (ref) args.push('--branch', ref);
      args.push('--', `https://github.com/${repo}.git`, source);
      try { await run('git', args, cwd, true); }
      catch { throw new Error('GitHub download failed. Check the repository/ref and your Git credential helper; accept private repository access first. No token is accepted by this CLI.'); }
    }
    const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
    const config = JSON.parse(await readFile(join(source, 'soloership.config.json'), 'utf8'));
    if (!manifest.scripts?.setup || !manifest.scripts?.['config:sync'] || !manifest.scripts?.['skills:sync'] || !manifest.packageManager?.startsWith('pnpm@'))
      throw new Error('Source is not a supported SoloerShip template.');
    for (const file of ['pnpm-lock.yaml', 'scripts/setup.mjs', 'config/schema.ts']) await lstat(join(source, file));
    await mkdir(target); // Exclusive: never merge into an existing project.
    created = true;
    await cp(source, target, {
      recursive: true, force: false, errorOnExist: true,
      filter: async (path) => {
        const parts = relative(source, path).split(sep);
        if (path === source) return true;
        if (!roots.has(parts[0])) return false;
        const file = basename(path);
        if (parts.some(part => excluded.has(part)) || /\.(pem|key|p12|pfx|log|sqlite|sqlite3|db)$/i.test(file)) return false;
        if ((file.startsWith('.env') || file.startsWith('.dev.vars')) && !file.endsWith('.example')) return false;
        if ((await lstat(path)).isSymbolicLink()) throw new Error(`Template symbolic links are not copied: ${relative(source, path)}`);
        return true;
      },
    });
    manifest.name = name;
    manifest.version = '0.1.0';
    manifest.private = true;
    delete manifest.repository;
    delete manifest.homepage;
    delete manifest.bugs;
    config.app = { ...config.app, name, mode: mode || 'saas', environment: 'local', url: 'http://localhost:7100' };
    config.cloudflare.workerName = name;
    config.cloudflare.database = { name: `${name}-db`, id: '' };
    config.cloudflare.queue = `${name}-billing`;
    config.storage.publicBucket = `${name}-public`;
    config.storage.privateBucket = `${name}-private`;
    config.email = { provider: 'preview', from: '' };
    config.payments = { enabled: false, provider: 'stripe', mode: 'test' };
    config.ai = { ...config.ai, enabled: false, provider: 'openai', model: '', baseURL: '' };
    await writeFile(join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(join(target, 'soloership.config.json'), JSON.stringify(config, null, 2) + '\n');
    return target;
  } catch (error) {
    if (created) await rm(target, { recursive: true, force: true });
    throw error;
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
