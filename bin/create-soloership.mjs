#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createProject, defaultRepository, run } from '../src/create.mjs';

try {
  const { values, positionals } = parseArgs({ options: {
    template: { type: 'string' }, repo: { type: 'string' }, ref: { type: 'string' },
    mode: { type: 'string' }, 'no-install': { type: 'boolean' },
    'no-setup': { type: 'boolean' }, 'no-start': { type: 'boolean' },
    yes: { type: 'boolean', short: 'y' }, 'skip-admin': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  }, allowPositionals: true });
  if (values.help) {
    console.log(`create-soloership <project-name> [options]
  --template PATH    Local template source
  --repo OWNER/REPO  GitHub source (existing Git credentials)
  --ref TAG          Git branch or release tag
  --mode MODE        saas, corporate or directory
  --no-install       Copy only; also skip setup/start
  --no-setup         Install dependencies without initialization/start
  --no-start         Initialize without starting development
  --yes --skip-admin Unattended local setup; no administrator created
Default: install dependencies, run interactive setup, start development.
Only use trusted template sources; their installation/setup scripts execute locally.`);
  } else {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node.js 22.12+ is required.');
    if (positionals.length !== 1) throw new Error('Supply one project name. Use --help for options.');
    if (values.yes && !values['skip-admin']) throw new Error('--yes requires --skip-admin. Create an administrator interactively afterward.');
    const setup = !values['no-install'] && !values['no-setup'];
    if (setup && !values.yes && !process.stdin.isTTY) throw new Error('Interactive setup needs a terminal. Use --yes --skip-admin or --no-setup.');
    if (!values['no-install']) await run('pnpm', ['--version'], process.cwd(), true);
    const target = await createProject({ name: positionals[0], template: values.template,
      repo: values.repo || (values.template ? undefined : process.env.SOLOERSHIP_TEMPLATE_REPO || defaultRepository),
      ref: values.ref, mode: values.mode });
    console.log(`Created ${target}`);
    try {
      if (!values['no-install']) {
        await run('pnpm', ['install', '--frozen-lockfile'], target);
        await run('pnpm', ['config:sync'], target);
        await run('pnpm', ['skills:sync'], target);
      }
      if (setup) {
        const args = ['run', 'setup'];
        if (values.yes) args.push('--yes');
        if (values['skip-admin']) args.push('--skip-admin');
        if (!values['no-start']) args.push('--start');
        await run('pnpm', args, target);
      } else console.log(`Next: enter ${positionals[0]}, run ${values['no-install'] ? 'pnpm install --frozen-lockfile, pnpm config:sync, pnpm skills:sync, then ' : ''}pnpm run setup --start.`);
    } catch (error) {
      throw new Error(`${error.message} Project files were retained at ${target}. Fix the reported error and continue there; do not recreate the project.`);
    }
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
