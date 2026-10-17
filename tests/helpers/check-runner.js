// Tiny shared test runner — intentionally not a full framework. Each suite
// is a plain Node script that drives a real Chromium via Playwright; this
// just gives them a consistent PASS/FAIL log and exit code.

function createChecker() {
  const results = [];

  async function check(name, fn) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`PASS  ${name}`);
    } catch (err) {
      results.push({ name, ok: false, err });
      console.log(`FAIL  ${name}\n      ${err.message}`);
    }
  }

  /** Logs a summary line and returns true if every check passed. */
  function summary() {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
    return failed.length === 0;
  }

  return { check, summary };
}

module.exports = { createChecker };
