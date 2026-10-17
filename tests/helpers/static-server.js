// Minimal zero-dependency static file server used only by the test suites,
// so a suite is fully self-contained (`node tests/foo.test.js` just works)
// instead of requiring a server to be started by hand first.
//
// Not used by the app itself — see README "Running locally" for how to
// serve the app for manual use (any static file server works there too).

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Start a static server rooted at `rootDir`.
 * @returns {Promise<{ url: string, port: number, close: () => Promise<void> }>}
 */
function startServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(rootDir, safePath);
      if (safePath.endsWith('/')) filePath = path.join(filePath, 'index.html');

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        port,
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

module.exports = { startServer };
