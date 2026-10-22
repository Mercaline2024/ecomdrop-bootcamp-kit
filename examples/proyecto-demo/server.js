// Servidor mínimo del proyecto de ejemplo: GET /salud responde {"ok":true}.
import http from 'node:http';
import fs from 'node:fs';
import pc from 'picocolors';

// carga .env sin dependencias
if (fs.existsSync('.env')) {
  for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

if (process.argv.includes('--check')) {
  console.log(pc.green('node ok'));
  process.exit(0);
}

const puerto = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  if (req.url === '/salud') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, apiKeyConfigurada: Boolean(process.env.EJEMPLO_API_KEY) }));
  }
  res.writeHead(404).end();
}).listen(puerto, '127.0.0.1', () => console.log(pc.green(`listening on http://127.0.0.1:${puerto}`)));
