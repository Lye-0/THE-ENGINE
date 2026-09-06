import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const port = Number(args.includes('--port') ? args[args.indexOf('--port') + 1] : process.env.PORT || 4173);
const host = args.includes('--host') ? (args[args.indexOf('--host') + 1] || '127.0.0.1') : '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server = http.createServer(async (req,res) => {
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Method not allowed');return;}
  try {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(p => p.startsWith('.') && p !== '.' )) {res.writeHead(403);res.end('Forbidden');return;}
    let filename = path.resolve(root, '.' + pathname);
    if (filename !== root && !filename.startsWith(root + path.sep)) {res.writeHead(403);res.end('Forbidden');return;}
    if ((await stat(filename)).isDirectory()) filename = path.join(filename,'index.html');
    const body = await readFile(filename);
    res.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) { const code = error instanceof URIError ? 400 : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500; res.writeHead(code);res.end(code === 404 ? 'Not found' : 'Request failed'); }
});
server.on('error', error => {console.error(error.message);process.exitCode=1;});
server.listen(port, host, () => console.log(`FERRO — http://${host}:${port}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit()));
