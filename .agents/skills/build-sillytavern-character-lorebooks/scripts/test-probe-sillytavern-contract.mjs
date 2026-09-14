#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checkout = process.argv[2] ? resolve(process.argv[2]) : null;
if (!checkout) {
  console.error('Usage: node test-probe-sillytavern-contract.mjs <known SillyTavern checkout>');
  process.exit(1);
}

const script = join(dirname(fileURLToPath(import.meta.url)), 'probe-sillytavern-contract.mjs');
const criticalFiles = [
  'src/validator/TavernCardValidator.js',
  'src/endpoints/characters.js',
  'src/endpoints/worldinfo.js',
  'public/scripts/world-info.js',
];

function probe(path) {
  const result = spawnSync(process.execPath, [script, path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `Probe exited ${result.status}`);
  return JSON.parse(result.stdout);
}

const known = probe(checkout);
if (known.status !== 'known') throw new Error(`Expected known checkout, received ${known.status}`);

const fixture = await mkdtemp(join(tmpdir(), 'sillytavern-contract-probe-'));
try {
  await copyFile(join(checkout, 'package.json'), join(fixture, 'package.json'));
  for (const relativePath of criticalFiles) {
    const destination = join(fixture, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(checkout, relativePath), destination);
  }

  const changedPath = join(fixture, criticalFiles[0]);
  await writeFile(changedPath, `${await readFile(changedPath, 'utf8')}\n// contract probe fixture\n`);
  const changed = probe(fixture);
  if (changed.status !== 'changed') throw new Error(`Expected changed fixture, received ${changed.status}`);
  if (changed.mismatches.length !== 1 || changed.mismatches[0].relativePath !== criticalFiles[0]) {
    throw new Error('Changed fixture did not isolate the modified contract surface.');
  }

  const packageJson = JSON.parse(await readFile(join(fixture, 'package.json'), 'utf8'));
  packageJson.version = '0.0.0-unknown-fixture';
  await writeFile(join(fixture, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  const unknown = probe(fixture);
  if (unknown.status !== 'unknown') throw new Error(`Expected unknown fixture, received ${unknown.status}`);

  console.log(JSON.stringify({
    passed: true,
    known: known.contractId,
    changedSurface: changed.mismatches[0].relativePath,
    unknownVersion: unknown.packageVersion,
  }, null, 2));
} finally {
  await rm(fixture, { recursive: true, force: true });
}
