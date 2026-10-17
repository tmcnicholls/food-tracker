// Copies just the deployed-app files (not .git, node_modules, tests/, prd.md,
// README.md, scripts/) into a scratch directory, for tests that need a
// disposable, writable copy of the app — e.g. to simulate a new GitHub Pages
// deploy landing on disk without ever touching the real repo files.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const APP_ENTRIES = ['index.html', 'css', 'js', 'manifest.json', 'icons', 'sw.js'];

function copyAppInto(destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of APP_ENTRIES) {
    fs.cpSync(path.join(REPO_ROOT, entry), path.join(destDir, entry), { recursive: true });
  }
}

module.exports = { copyAppInto, REPO_ROOT };
