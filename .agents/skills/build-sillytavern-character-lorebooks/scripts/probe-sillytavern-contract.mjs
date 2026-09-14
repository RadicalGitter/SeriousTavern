#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(skillRoot, 'references', 'sillytavern-contracts.json');
const checkout = process.argv[2] ? resolve(process.argv[2]) : null;

if (!checkout) {
  console.error('Usage: node probe-sillytavern-contract.mjs <SillyTavern checkout>');
  process.exit(1);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

try {
  const [manifest, packageJson] = await Promise.all([
    readJson(manifestPath),
    readJson(join(checkout, 'package.json')),
  ]);
  const candidates = manifest.contracts.filter(
    contract => contract.packageVersion === packageJson.version,
  );

  if (candidates.length === 0) {
    console.log(JSON.stringify({
      status: 'unknown',
      checkout,
      packageVersion: packageJson.version ?? null,
      reason: 'No cached contract has this package version.',
    }, null, 2));
    process.exit(0);
  }

  const results = [];
  for (const contract of candidates) {
    const files = [];
    for (const [relativePath, expected] of Object.entries(contract.criticalFiles)) {
      const absolutePath = join(checkout, relativePath);
      let actual = null;
      try {
        if ((await stat(absolutePath)).isFile()) actual = await sha256(absolutePath);
      } catch {
        // A missing contract file is reported as a mismatch below.
      }
      files.push({ relativePath, expected, actual, matches: actual === expected });
    }
    results.push({ contract, files, matches: files.every(file => file.matches) });
  }

  const exact = results.find(result => result.matches);
  if (exact) {
    console.log(JSON.stringify({
      status: 'known',
      checkout,
      packageVersion: packageJson.version,
      contractId: exact.contract.id,
      verifiedRevision: exact.contract.verifiedRevision,
      verifiedDate: exact.contract.verifiedDate,
      reference: join(skillRoot, exact.contract.reference),
      checkedFiles: exact.files.map(file => file.relativePath),
    }, null, 2));
    process.exit(0);
  }

  const nearest = results
    .sort((a, b) => b.files.filter(file => file.matches).length - a.files.filter(file => file.matches).length)[0];
  console.log(JSON.stringify({
    status: 'changed',
    checkout,
    packageVersion: packageJson.version,
    nearestContractId: nearest.contract.id,
    reference: join(skillRoot, nearest.contract.reference),
    mismatches: nearest.files.filter(file => !file.matches),
    instruction: 'Inspect and test only these contract-owning files before updating or adding a cached contract.',
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: 'invalid',
    checkout,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
