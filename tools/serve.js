// Local development server. The published game is entirely static.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403); res.end(); return;
    }
    if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': `${types[extname(target)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado.');
  }
}).listen(port, '127.0.0.1', () => console.log(`Última Chama: http://localhost:${port}`));
