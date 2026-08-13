#!/usr/bin/env node
// Build the handover archive.
//
// Everything in it comes from `git archive HEAD`, which is the point: the
// archive cannot contain a .env, a node_modules, a build output or an
// uncommitted experiment, because git has never heard of them. If a file is
// not committed, it does not ship.
//
//   node tools/package-release.mjs
//
// Writes dist/gymguide-<short-sha>.tar.gz and .zip, plus a checksum file.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim();

const sha = run('git', ['rev-parse', '--short', 'HEAD']);
const dirty = run('git', ['status', '--porcelain']);
if (dirty) {
  console.error('Uncommitted changes. Commit them first — the archive is built from HEAD,\n' +
    'so anything uncommitted would silently be left out:\n' + dirty);
  process.exit(1);
}

const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const base = `gymguide-${sha}`;
const tar = join(dist, `${base}.tar.gz`);
const zip = join(dist, `${base}.zip`);

run('git', ['archive', '--format=tar.gz', `--prefix=${base}/`, '-o', tar, 'HEAD']);
run('git', ['archive', '--format=zip', `--prefix=${base}/`, '-o', zip, 'HEAD']);

// The readiness report is generated, not committed, so it is carried alongside
// the archive rather than inside it.
const report = join(root, 'readiness-report.html');
if (existsSync(report)) copyFileSync(report, join(dist, 'readiness-report.html'));

const lines = [];
for (const file of [tar, zip]) {
  const bytes = readFileSync(file);
  const sum = createHash('sha256').update(bytes).digest('hex');
  lines.push(`${sum}  ${file.slice(dist.length + 1)}`);
  const mb = (statSync(file).size / 1024 / 1024).toFixed(1);
  console.log(`${file.slice(root.length + 1).padEnd(40)} ${mb} MB`);
}
writeFileSync(join(dist, 'SHA256SUMS'), lines.join('\n') + '\n');
console.log(`\nBuilt from ${sha}. Checksums in dist/SHA256SUMS.`);
console.log('Unpack, then: ./start.sh   (or read README.md)');
