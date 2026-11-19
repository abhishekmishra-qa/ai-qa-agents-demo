#!/usr/bin/env node
// Which tests does a change need? Maps changed files to Playwright tags and prints a --grep pattern.
//
//   node scripts/affected-tags.js app/routes/docs.js   -> @docs|@sharing
//   node scripts/affected-tags.js                      -> reads `git diff` instead (what CI does)
//   node scripts/affected-tags.js --run [files...]     -> also runs Playwright with that pattern
//                                                         (other --options go to Playwright as-is)
//
// When unsure (a shared or unmapped file, or git fails) it picks the full suite:
// running a few extra tests is cheaper than missing a regression.

const { execFileSync, spawnSync } = require('node:child_process');

const FULL_SUITE = '.*';

// Changed file -> tags of the tests that cover it. Anything not listed means "full suite".
const AREA_TAGS = {
  'app/routes/auth.js': ['@auth'],
  'app/routes/docs.js': ['@docs', '@sharing'], // docs routes also decide what guests can see
  'app/routes/sharing.js': ['@sharing'],
  'app/routes/members.js': ['@members'],
  'tests/auth.spec.js': ['@auth'],
  'tests/docs.spec.js': ['@docs'],
  'tests/sharing.spec.js': ['@sharing'],
  'tests/members.spec.js': ['@members'],
};

function changedFiles(args) {
  if (args.length > 0) return args;
  // Everything this branch changed since it left the base branch (main, unless CI sets BASE_REF).
  // execFileSync passes arguments without a shell, so a strange branch name can't inject a command.
  const base = process.env.BASE_REF || 'main';
  const out = execFileSync('git', ['diff', '--name-only', `origin/${base}...HEAD`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.split('\n').filter(Boolean);
}

function grepFor(files) {
  if (files.length === 0) return { pattern: FULL_SUITE, reason: 'no changed files found' };
  const tags = new Set();
  for (const name of files) {
    const file = name.trim().replace(/\\/g, '/').replace(/^\.\//, ''); // accept Windows paths and ./
    // hasOwn, so a file named like a built-in property ("constructor") isn't mistaken for a mapped one.
    if (!Object.hasOwn(AREA_TAGS, file)) {
      return { pattern: FULL_SUITE, reason: `${file} is shared or not mapped to an area` };
    }
    AREA_TAGS[file].forEach((tag) => tags.add(tag));
  }
  const sorted = [...tags].sort();
  return { pattern: sorted.join('|'), reason: `affected areas: ${sorted.join(', ')}` };
}

const args = process.argv.slice(2);
const shouldRun = args.includes('--run');
// Arguments starting with "--" are options (e.g. --reporter=dot), everything else is a file path.
const playwrightOptions = args.filter((arg) => arg.startsWith('--') && arg !== '--run');
const files = args.filter((arg) => !arg.startsWith('--'));

let result;
try {
  result = grepFor(changedFiles(files));
} catch (err) {
  const firstLine = String(err.stderr || err.message).trim().split('\n')[0];
  result = { pattern: FULL_SUITE, reason: `could not read the git diff (${firstLine})` };
}

console.log(result.pattern); // stdout: only the pattern, so CI can capture it
console.error(`affected-tags: ${result.reason}`); // stderr: the reason, for people reading the log

if (shouldRun) {
  // Start Playwright through node directly, with no shell, so the "|" in the pattern needs no quoting.
  const cli = require.resolve('@playwright/test/cli');
  const grep = result.pattern === FULL_SUITE ? [] : ['--grep', result.pattern];
  const { status } = spawnSync(process.execPath, [cli, 'test', ...grep, ...playwrightOptions], {
    stdio: 'inherit',
  });
  process.exit(status ?? 1);
}
