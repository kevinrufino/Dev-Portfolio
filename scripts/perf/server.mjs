/**
 * A static file server for the production build.
 *
 * The harness measures `npm run build` output, never the dev server: CRA's dev
 * bundle is unminified, unsplit and carries the HMR client, so its numbers
 * describe a build no visitor will ever load.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.ico': 'image/x-icon', '.txt': 'text/plain', '.map': 'application/json',
};

export const serve = (root, port = 0) =>
  new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      // Resolve inside root, then verify — a traversal attempt gets the SPA
      // shell, not the filesystem.
      let file = path.join(root, url);
      if (!file.startsWith(root)) file = path.join(root, 'index.html');
      if (fs.existsSync(file) && fs.statSync(file).isDirectory())
        file = path.join(file, 'index.html');
      // SPA fallback: /projects/swoosh-404 is a client route, not a file.
      if (!fs.existsSync(file)) file = path.join(root, 'index.html');

      const body = fs.readFileSync(file);
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Content-Length': body.length,
        // No caching between runs: a warm disk cache would make run 2 of 3
        // faster than run 1 for reasons that have nothing to do with the code.
        'Cache-Control': 'no-store',
        'Accept-Ranges': 'bytes',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () =>
      resolve({ port: server.address().port, close: () => new Promise(r => server.close(r)) }),
    );
  });
