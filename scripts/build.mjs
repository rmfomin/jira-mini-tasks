#!/usr/bin/env node
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const root = resolve(__dirname, '..');
const headerPath = resolve(root, 'scripts/header.txt');
const entry = resolve(root, 'src/index.js');
const outdir = resolve(root, 'dist');
const outfile = resolve(outdir, 'jira-mini-tasks.user.js');

mkdirSync(outdir, { recursive: true });

const header = readFileSync(headerPath, 'utf8');

const watch = process.argv.includes('--watch');

/**
 * Build once
 */
async function buildOnce() {
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    banner: { js: header },
    sourcemap: 'inline',
    logLevel: 'info'
  });
}

if (!watch) {
  buildOnce().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  const ctx = await esbuild.context({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    banner: { js: header },
    sourcemap: 'inline',
    logLevel: 'info'
  });
  await ctx.watch();
  console.log('Watching...');
}

