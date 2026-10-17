// Runs every tests/*.test.js suite in sequence (each spawns its own
// Chromium instance, so sequential keeps resource use predictable) and
// prints an overall summary. Exits non-zero if any suite failed.
//
// Run: npm test   (equivalent to: node tests/run-all.js)

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = __dirname;
const suites = fs.readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

if (suites.length === 0) {
  console.error('No *.test.js suites found in tests/');
  process.exit(1);
}

console.log(`Running ${suites.length} suite(s): ${suites.join(', ')}\n`);

const outcomes = [];

for (const suite of suites) {
  console.log(`\n=== ${suite} ===`);
  const result = spawnSync(process.execPath, [path.join(testsDir, suite)], { stdio: 'inherit' });
  outcomes.push({ suite, ok: result.status === 0 });
}

console.log('\n=== Summary ===');
outcomes.forEach(({ suite, ok }) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${suite}`);
});

const failed = outcomes.filter((o) => !o.ok);
process.exit(failed.length ? 1 : 0);
