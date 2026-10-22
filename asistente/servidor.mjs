#!/usr/bin/env node
// Asistente de instalación del Ecomdrop Bootcamp Kit.
// Servidor local sin dependencias: solo escucha en 127.0.0.1 y exige un token aleatorio en cada llamada.
//
//   node asistente/servidor.mjs [--puerto 4747] [--no-abrir]
//
// Cada paso de instalación lo ejecuta scripts/setup.sh (o setup.ps1 en Windows) con --paso <id>;
// este servidor solo lanza el proceso y retransmite su salida al navegador (Server-Sent Events).
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(AQUI, '..');
const ES_WIN = process.platform === 'win32';
const HOME = os.homedir();
const ECOMDROP_HOME = process.env.ECOMDROP_HOME || path.join(HOME, '.ecomdrop');
const PROYECTOS = process.env.ECOMDROP_PROYECTOS || path.join(HOME, 'proyectos');
const SIE_DIR = path.join(PROYECTOS, 'super-inteligencia-ecommerce');
const ENV_GLOBAL = path.join(ECOMDROP_HOME, '.env');

const args = process.argv.slice(2);
const PUERTO = Number(valorArg('--puerto') || process.env.ECOMDROP_PUERTO || 4747);
// --demo: los pasos se simulan (para ver el asistente o enseñarlo en clase sin instalar ni tocar nada)
const DEMO = args.includes('--demo') || process.env.ECOMDROP_DEMO === '1';
const TOKEN = randomBytes(24).toString('hex');
const INACTIVIDAD_MS = 2 * 60 * 60 * 1000; // se apaga solo tras 2 h sin uso

function valorArg(nombre) {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
}

// Pasos del asistente, en orden. `id` debe existir en setup.sh y setup.ps1.
const PASOS = [
  { id: 'python', titulo: 'Python (uv)', detalle: 'uv y Python para los scripts del SIE (Pillow, openpyxl).' },
  { id: 'gh', titulo: 'GitHub CLI', detalle: 'Para descargar el SIE con tu cuenta de GitHub.' },
  { id: 'claude', titulo: 'Claude Code', detalle: 'Instalador nativo oficial de Claude Code.' },
  { id: 'media', titulo: 'Video, audio e imagen', detalle: process.platform === 'darwin' ? 'ffmpeg y whisper-cli (las imágenes las procesa sips, que ya trae macOS).' : 'ffmpeg, whisper-cli e ImageMagick.' },
  { id: 'modelo', titulo: 'Modelo de transcripción', detalle: 'Whisper large-v3-turbo (~1,6 GB). Es la descarga más larga.' },
  { id: 'shopify', titulo: 'Shopify CLI', detalle: 'Para descargar y revisar temas.' },
  { id: 'acceso', titulo: 'Acceso al SIE', detalle: 'Inicia sesión en GitHub para verificar que estás inscrito.' },
  { id: 'sie', titulo: 'Instalar el SIE', detalle: 'Descarga las skills, scripts y plantillas del bootcamp.' },
  { id: 'playwright', titulo: 'Navegador de pruebas', detalle: 'Playwright + Chromium para validar landings.' },
  { id: 'config', titulo: 'Configurar Claude Code', detalle: 'Copia la configuración del kit a ~/.claude y registra los MCP.' },
  { id: 'doctor', titulo: 'Revisión final', detalle: 'ecomdrop-doctor comprueba que todo quedó listo.' },
];
const IDS = new Set([...PASOS.map(p => p.id), 'limpieza']);

// ---------- estado de ejecución ----------
const ejecuciones = new Map(); // id -> { estado, lineas[], hijo, clientes:Set, codigo }
let ultimoUso = Date.now();

const GUION_DEMO = {
  python: ['━━ Python (uv)', '  → Instalando uv…', '  ✔ uv 0.13.4', '  → Instalando Python con uv…', '  ✔ python3 3.13.2', '  ✔ Pillow y openpyxl instalados'],
  gh: ['━━ GitHub CLI', '  ✔ gh 2.92.0'],
  claude: ['━━ Claude Code', '  → Instalando Claude Code con el instalador nativo oficial…', '  ✔ Claude Code 2.1.282'],
  media: ['━━ Video, audio e imagen', '  → ffmpeg', '  ✔ ffmpeg instalado', '  → whisper-cpp', '  ✔ whisper-cpp instalado'],
  modelo: ['━━ Modelo de transcripción (whisper large-v3-turbo)', '  → Descargando ~1,6 GB…', '  … 25 %', '  … 50 %', '  … 75 %', '  ✔ Modelo descargado'],
  shopify: ['━━ Shopify CLI', '  → npm install -g @shopify/cli@latest', '  ✔ Shopify CLI instalado'],
  acceso: ['━━ Acceso al SIE (GitHub)', '  → Inicia sesión en GitHub con tu navegador.', '! First copy your one-time code: DEMO-1234', 'Open this URL to continue in your web browser: https://github.com/login/device', '  … esperando autorización', '  … esperando autorización', '  ✔ Sesión de GitHub: estudiante-demo', '  ✔ Tienes acceso al SIE'],
  sie: ['━━ Instalar el SIE', '  → Descargando la última versión…', '  ✔ SIE instalado en ~/proyectos/super-inteligencia-ecommerce', '  ✔ Dependencias del SIE instaladas'],
  playwright: ['━━ Navegador de pruebas (Playwright + Chromium)', '  ✔ Chromium listo'],
  config: ['━━ Configurar Claude Code', '  ✔ CLAUDE.md global actualizado', '  ✔ settings.json fusionado', '  ✔ guardia instalada', '  ✔ MCP playwright registrado', '  ✔ MCP dropkiller registrado'],
  doctor: ['━━ Revisión final', 'Herramientas', '  ✅ python3 · node · ffmpeg · whisper-cli · gh · git · shopify', 'Claves', '  ✅ KIE_API_KEY', 'Conectores', '  ✅ Shopify · Facebook meta ADS', '', 'Todo listo.'],
  limpieza: ['━━ Limpieza del instalador', '  (demo: no se borra nada)'],
};

function lanzarDemo(id) {
  const e = { estado: 'corriendo', lineas: [], clientes: new Set(), codigo: null, hijo: { stdin: { write() {} }, on() {} } };
  ejecuciones.set(id, e);
  const lineas = ['[demostración: no se instala nada]', ...(GUION_DEMO[id] || [`━━ ${id}`, '  ✔ listo'])];
  let i = 0;
  const t = setInterval(() => {
    if (i < lineas.length) {
      const linea = lineas[i++];
      e.lineas.push(linea);
      for (const c of e.clientes) c.write(`data: ${JSON.stringify({ linea })}\n\n`);
      return;
    }
    clearInterval(t);
    e.estado = 'ok'; e.codigo = 0;
    for (const c of e.clientes) { c.write(`event: fin\ndata: ${JSON.stringify({ estado: 'ok', codigo: 0 })}\n\n`); c.end(); }
    e.clientes.clear();
  }, id === 'acceso' ? 900 : 350);
  return e;
}

function lanzarPaso(id, extraEnv = {}) {
  const actual = ejecuciones.get(id);
  if (actual?.estado === 'corriendo') return actual;
  if (DEMO) return lanzarDemo(id);
  const e = { estado: 'corriendo', lineas: [], clientes: new Set(), codigo: null, hijo: null };
  ejecuciones.set(id, e);
  // Windows: el script se lee como UTF-8 y se ejecuta con iex (igual que «irm | iex»), así no depende de la
  // codificación del archivo; el paso y la ruta del kit van por variables de entorno.
  const ps1 = path.join(KIT, 'scripts', 'setup.ps1').replace(/'/g, "''");
  const [cmd, cmdArgs] = ES_WIN
    ? ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `[Console]::OutputEncoding=[Text.Encoding]::UTF8; iex ([IO.File]::ReadAllText('${ps1}', [Text.Encoding]::UTF8)); exit $global:ECOMDROP_CODIGO`]]
    : ['bash', [path.join(KIT, 'scripts', 'setup.sh'), '--paso', id]];
  const hijo = spawn(cmd, cmdArgs, {
    cwd: KIT,
    env: { ...process.env, ...leerEnv(ENV_GLOBAL), ...extraEnv, ECOMDROP_DESDE_ASISTENTE: '1', NO_COLOR: '1', ECOMDROP_PASO: id, ECOMDROP_KIT: KIT },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  e.hijo = hijo;
  const emitir = (linea) => {
    e.lineas.push(linea);
    if (e.lineas.length > 2000) e.lineas.shift();
    for (const c of e.clientes) c.write(`data: ${JSON.stringify({ linea })}\n\n`);
  };
  let resto = '';
  const alRecibir = (buf) => {
    const txt = resto + buf.toString('utf8').replace(/\x1b\[[0-9;]*m/g, '');
    const partes = txt.split(/\r?\n/);
    resto = partes.pop();
    partes.forEach(emitir);
  };
  hijo.stdout.on('data', alRecibir);
  hijo.stderr.on('data', alRecibir);
  hijo.on('close', (codigo) => {
    if (resto) emitir(resto);
    e.codigo = codigo;
    e.estado = codigo === 0 ? 'ok' : 'error';
    for (const c of e.clientes) { c.write(`event: fin\ndata: ${JSON.stringify({ estado: e.estado, codigo })}\n\n`); c.end(); }
    e.clientes.clear();
  });
  return e;
}

// ---------- utilidades ----------
function leerEnv(archivo) {
  const out = {};
  try {
    for (const l of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[2] !== '') out[m[1]] = m[2];
    }
  } catch { /* no existe todavía */ }
  return out;
}

function escribirEnv(archivo, valores) {
  const previo = leerEnv(archivo);
  const final = { ...previo };
  for (const [k, v] of Object.entries(valores)) {
    if (!/^[A-Z0-9_]+$/.test(k)) continue;
    const limpio = String(v ?? '').trim().replace(/[\r\n]/g, '');
    if (limpio) final[k] = limpio; else delete final[k];
  }
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const cuerpo = '# Escrito por el asistente de Ecomdrop Bootcamp. No lo compartas ni lo subas a git.\n'
    + Object.entries(final).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(archivo, cuerpo, { mode: 0o600 });
  try { fs.chmodSync(archivo, 0o600); } catch { /* Windows */ }
}

function ejecutar(cmd, cmdArgs, { timeout = 60000, shell = ES_WIN } = {}) {
  return new Promise((resolve) => {
    const hijo = spawn(cmd, cmdArgs, { shell, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const t = setTimeout(() => hijo.kill(), timeout);
    hijo.stdout?.on('data', d => { out += d; });
    hijo.stderr?.on('data', d => { out += d; });
    hijo.on('error', () => { clearTimeout(t); resolve({ codigo: -1, out }); });
    hijo.on('close', codigo => { clearTimeout(t); resolve({ codigo, out }); });
  });
}

async function probarClave(servicio, valor) {
  if (DEMO) return valor ? { ok: true, mensaje: 'Demostración: la clave tiene buen formato (no se contactó el servicio).' } : { ok: false, mensaje: 'Escribe una clave para probarla.' };
  const urls = {
    KIE_API_KEY: 'https://api.kie.ai/api/v1/chat/credit',
    APIFY_TOKEN: 'https://api.apify.com/v2/users/me',
  };
  if (!urls[servicio]) return { ok: false, mensaje: 'Servicio desconocido' };
  try {
    const r = await fetch(urls[servicio], { headers: { Authorization: `Bearer ${valor}` }, signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({}));
    if (servicio === 'KIE_API_KEY') {
      const ok = r.ok && (j.code === undefined || j.code === 200);
      return { ok, mensaje: ok ? `Clave válida. Créditos: ${j.data ?? '?'}` : `kie.ai respondió ${j.code ?? r.status}: ${j.msg ?? 'clave inválida'}` };
    }
    return { ok: r.ok, mensaje: r.ok ? `Token válido (usuario ${j.data?.username ?? '?'})` : `Apify respondió ${r.status}: token inválido` };
  } catch (err) {
    return { ok: false, mensaje: `No se pudo contactar el servicio: ${err.message}. Revisa tu conexión.` };
  }
}

// Conectores que las skills llaman por nombre exacto (ver config/conectores.md)
const CONECTORES = [
  { nombre: 'Shopify', obligatorio: true, audiencia: 'todos' },
  { nombre: 'Facebook meta ADS', obligatorio: true, audiencia: 'todos', url: 'https://mcp.facebook.com/ads' },
  { nombre: 'dropi', obligatorio: false, audiencia: 'todos', local: true, prefijos: ['plugin:ecomdrop-bootcamp:dropi:', 'dropi:'], url: 'https://mcp.dropi.co/mcp', nota: 'MCP oficial de Dropi: se autentica con tu cuenta de Dropi' },
  { nombre: 'dropkiller', obligatorio: false, audiencia: 'todos', local: true },
  { nombre: 'apify', obligatorio: false, audiencia: 'todos', local: true },
  { nombre: 'playwright', obligatorio: false, audiencia: 'todos', local: true },
  { nombre: 'Admin_MCP_Ecomdrop', obligatorio: false, audiencia: 'clientes-ecomdrop', url: 'https://admin.mcp.ecomdrop.app/mcp', nota: 'Contexto del bot de WhatsApp' },
  { nombre: 'ecomdrop', obligatorio: false, audiencia: 'clientes-ecomdrop', url: 'https://mcp.ecomdrop.app', nota: 'Ventas del bot de WhatsApp' },
  { nombre: 'MCp dropi- Ecomdrop', obligatorio: false, audiencia: 'clientes-ecomdrop', url: 'https://mcp-dropi.ecomdrop.app', nota: 'Dropi a través de Ecomdrop' },
];

async function revisarConectores() {
  if (DEMO) {
    const estados = ['conectado', 'conectado', 'sin-login', 'sin-login', 'falta', 'conectado', 'falta', 'falta', 'falta'];
    return { conectores: CONECTORES.map((c, i) => ({ ...c, estado: estados[i] })) };
  }
  const { codigo, out } = await ejecutar('claude', ['mcp', 'list'], { timeout: 240000 });
  if (codigo === -1) return { error: 'Claude Code no está instalado o no está en el PATH.' };
  return {
    conectores: CONECTORES.map(c => {
      const prefijos = c.prefijos ?? [c.local ? `${c.nombre}:` : `claude.ai ${c.nombre}:`];
      const linea = out.split('\n').find(l => prefijos.some(p => l.startsWith(p)));
      let estado = 'falta';
      if (linea) estado = /✔|Connected/.test(linea) && !/Needs authentication|Failed/.test(linea) ? 'conectado'
        : /Needs authentication/.test(linea) ? 'sin-login' : 'error';
      return { ...c, estado, linea: linea?.slice(0, 200) };
    }),
  };
}

// ---------- Chriss ----------
// Responde con Claude Code del propio estudiante (claude -p, sin herramientas que modifiquen nada).
// Si Claude Code todavía no está instalado o sin sesión, contesta con la guía local.
const PERSONA_CHRISS = [
  'Eres Chriss, la mascota y asistente de Ecomdrop. Hablas en español latinoamericano, como un colega cercano: frases cortas, cálidas y concretas, en masculino.',
  'Acompañas a un estudiante del Ecomdrop Bootcamp mientras instala su equipo con el asistente local. Las etapas son: Tu equipo, Herramientas (Python/uv, GitHub CLI, Claude Code, ffmpeg y whisper, modelo de transcripción, Shopify CLI, acceso al SIE con GitHub, instalar el SIE, Playwright, configurar Claude Code), Claves (KIE_API_KEY obligatoria; APIFY_TOKEN opcional), Conectores: Shopify y Facebook meta ADS en claude.ai con nombre exacto; el MCP oficial de Dropi (dropi, https://mcp.dropi.co/mcp) viene en el plugin ecomdrop-bootcamp del kit y se autentica con la cuenta de Dropi del estudiante en Claude Code (/mcp → dropi → Authenticate); Admin_MCP_Ecomdrop, ecomdrop y MCp dropi- Ecomdrop son solo para quienes usan la plataforma Ecomdrop. Al final, Tu tienda.',
  'Responde en máximo 4 frases. No uses Markdown ni listas largas. Nunca pidas ni repitas claves o tokens. Si el problema necesita a una persona, dile que copie el reporte en la etapa Listo y lo envíe a soporte del bootcamp.',
].join(' ');

const FAQ_CHRISS = [
  [/python/i, 'Los scripts del SIE que procesan imágenes y hojas de cálculo están en Python. uv lo instala sin tocar el Python de tu sistema.'],
  [/espacio|disco|gb/i, 'Necesitas unos 4 GB libres: 1,6 GB del modelo de transcripción, Chromium para validar landings y las herramientas.'],
  [/kie/i, 'Entra a kie.ai, inicia sesión y abre «API Keys». Copia la clave completa y pégala en la etapa Claves; con «Probar» confirmo que funciona.'],
  [/segur|guard/i, 'Tus claves quedan solo en este computador, en un archivo que únicamente tu usuario puede leer. No se suben a ningún lado.'],
  [/conector|nombre exacto/i, 'Las skills del SIE buscan cada conector por su nombre. Si lo escribes distinto, no lo encuentran. Copia el nombre tal cual de la tabla.'],
  [/fall|error/i, 'Lee la línea en rojo del registro: casi siempre dice qué faltó. Pulsa «Reintentar». Si sigue igual, copia el reporte en la etapa Listo y envíalo a soporte.'],
  [/dropi/i, 'El MCP oficial de Dropi ya lo registré: en Claude Code escribe /mcp, elige dropi y pulsa Authenticate para entrar con tu cuenta de Dropi. El conector «MCp dropi- Ecomdrop» es solo para quienes usan la plataforma Ecomdrop.'],
  [/ecomdrop/i, 'Los conectores de Ecomdrop (Admin_MCP_Ecomdrop, ecomdrop y MCp dropi- Ecomdrop) solo funcionan si tu negocio usa la plataforma Ecomdrop. Si no, sáltalos: no los necesitas para el bootcamp.'],
  [/dominio/i, 'No pasa nada: deja el dominio vacío. Lo completas después y la skill nueva-tienda lo lee desde Shopify.'],
  [/otra tienda|después/i, 'Sí. Vuelve a esta etapa o, con Claude abierto, dime «crea una tienda nueva». Cada tienda tiene su propia carpeta.'],
  [/empiez|trabajar/i, 'Abre una terminal en la carpeta de tu tienda, escribe «claude» y dime «da de alta esta tienda». De ahí seguimos juntos.'],
  [/soporte|ayuda/i, 'En la etapa Listo pulsa «Copiar reporte para soporte» y pégalo en el chat del bootcamp. Así ven exactamente qué pasó.'],
  [/instal/i, 'Python, GitHub CLI, Claude Code, ffmpeg, whisper con su modelo, Shopify CLI, el SIE con sus skills y un navegador para validar landings.'],
];

async function responderChriss({ pregunta = '', etapa = '', registro = [] }) {
  const q = String(pregunta).slice(0, 600);
  const local = FAQ_CHRISS.find(([re]) => re.test(q))?.[1];
  if (DEMO) return local || 'En la instalación real te respondo con Claude Code. En esta demostración solo tengo respuestas guardadas: prueba con una de las preguntas sugeridas.';
  const contexto = `Etapa actual: ${etapa}. Sistema: ${process.platform} ${process.arch}. Estado de los pasos: ${PASOS.map(p => `${p.id}=${ejecuciones.get(p.id)?.estado || 'pendiente'}`).join(', ')}. Últimas líneas del registro:\n${(registro || []).slice(-40).join('\n').slice(0, 4000)}`;
  const r = await ejecutar('claude', ['-p', '--model', 'haiku', '--no-session-persistence', '--disallowedTools', 'Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch',
    '--append-system-prompt', `${PERSONA_CHRISS}\n\n${contexto}`, q], { timeout: 90000, shell: false });
  const texto = r.out.trim();
  if (r.codigo === 0 && texto) return texto.slice(0, 1500);
  return local || 'Todavía no puedo pensar con IA: primero instala Claude Code e inicia sesión con «claude» en una terminal. Mientras tanto, prueba con una de las preguntas sugeridas.';
}

// ---------- tienda ----------
async function crearTienda(d) {
  if (DEMO) {
    const s = String(d.slug || 'mi-tienda').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return { ok: true, mensaje: `Demostración: la tienda se crearía en ${path.join(PROYECTOS, 'tiendas', s)}`, ruta: path.join(PROYECTOS, 'tiendas', s), salida: '→ añadiendo el SIE como submódulo\n→ enlazando 13 skills\n→ tienda.json, CLAUDE.md, .env' };
  }
  const slug = String(d.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return { ok: false, mensaje: 'Escribe un nombre corto para la tienda (solo letras, números y guiones).' };
  const destino = path.join(PROYECTOS, 'tiendas', slug);
  const script = path.join(SIE_DIR, 'bin', 'nueva-tienda.sh');
  if (!fs.existsSync(script)) return { ok: false, mensaje: 'Primero instala el SIE (paso «Instalar el SIE»).' };
  const bash = ES_WIN ? (process.env.CLAUDE_CODE_GIT_BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe') : 'bash';
  const r = await ejecutar(bash, [script, destino, slug], { timeout: 600000 });
  if (r.codigo !== 0) return { ok: false, mensaje: 'nueva-tienda.sh falló', salida: r.out.slice(-4000) };
  // claves de la tienda: se copian las globales que usa el SIE
  const g = leerEnv(ENV_GLOBAL);
  escribirEnv(path.join(destino, '.env'), { KIE_API_KEY: g.KIE_API_KEY, SIE_LOCALE: g.SIE_LOCALE || 'es-CO', WHISPER_MODEL: g.WHISPER_MODEL });
  // datos básicos en tienda.json (el resto lo completa la skill nueva-tienda desde los conectores)
  const tj = path.join(destino, 'tienda.json');
  try {
    const t = JSON.parse(fs.readFileSync(tj, 'utf8'));
    t.tienda = { ...t.tienda, marca: d.marca || null, dominio: d.dominio || null, pais: d.pais || null, moneda: d.moneda || null, locale: g.SIE_LOCALE || 'es-CO' };
    t.venta = { ...t.venta, whatsapp: (d.whatsapp || '').replace(/\D/g, '') || null };
    fs.writeFileSync(tj, JSON.stringify(t, null, 2) + '\n');
  } catch { /* la skill nueva-tienda lo rellenará */ }
  return { ok: true, mensaje: `Tienda creada en ${destino}`, ruta: destino, salida: r.out.slice(-2000) };
}

// ---------- HTTP ----------
const WEB = path.join(AQUI, 'web');
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'";
const TIPOS = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

// Recursos de la interfaz (sin datos ni claves): no piden token. Solo se sirve lo que está dentro de asistente/web.
function servirEstatico(ruta, res) {
  const archivo = path.normalize(path.join(WEB, decodeURIComponent(ruta)));
  const tipo = TIPOS[path.extname(archivo).toLowerCase()];
  if (!archivo.startsWith(WEB + path.sep) || !tipo || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('no existe');
  }
  res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': ruta.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(archivo).pipe(res);
}
function tokenValido(req, url) {
  const dado = req.headers['x-ecomdrop-token'] || url.searchParams.get('t') || '';
  const a = Buffer.from(String(dado)); const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function hostValido(req) {
  // evita DNS rebinding: solo se acepta el host local exacto
  const h = req.headers.host || '';
  return h === `127.0.0.1:${PUERTO}` || h === `localhost:${PUERTO}`;
}

function json(res, codigo, obj) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function leerCuerpo(req) {
  let d = '';
  for await (const ch of req) { d += ch; if (d.length > 1e6) throw new Error('cuerpo demasiado grande'); }
  return d ? JSON.parse(d) : {};
}

const servidor = http.createServer(async (req, res) => {
  ultimoUso = Date.now();
  const url = new URL(req.url, `http://127.0.0.1:${PUERTO}`);
  if (!hostValido(req)) return json(res, 403, { error: 'host no permitido' });

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    if (!tokenValido(req, url)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Abre el enlace completo que mostró el instalador en la terminal (incluye ?t=...).');
    }
    const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8').replace('__TOKEN__', TOKEN);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': CSP,
      'Referrer-Policy': 'no-referrer',
    });
    return res.end(html);
  }

  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) return servirEstatico(url.pathname, res);
  if (!url.pathname.startsWith('/api/')) return json(res, 404, { error: 'no existe' });
  if (!tokenValido(req, url)) return json(res, 401, { error: 'token inválido' });
  if (req.method === 'POST' && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
    return json(res, 403, { error: 'origen no permitido' });
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/info') {
      return json(res, 200, {
        demo: DEMO,
        sistema: { plataforma: process.platform, arquitectura: process.arch, version: os.release(), node: process.version, usuario: os.userInfo().username },
        rutas: { kit: KIT, proyectos: PROYECTOS, sie: SIE_DIR, envGlobal: ENV_GLOBAL },
        pasos: PASOS.map(p => ({ ...p, estado: ejecuciones.get(p.id)?.estado || 'pendiente' })),
        claves: Object.fromEntries(Object.entries(leerEnv(ENV_GLOBAL)).map(([k, v]) => [k, /KEY|TOKEN|SECRET/.test(k) ? `••••${v.slice(-4)}` : v])),
      });
    }
    let m;
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/pasos\/([a-z]+)$/)) && IDS.has(m[1])) {
      const e = lanzarPaso(m[1]);
      return json(res, 202, { estado: e.estado });
    }
    if (req.method === 'GET' && (m = url.pathname.match(/^\/api\/pasos\/([a-z]+)\/log$/)) && IDS.has(m[1])) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      const e = ejecuciones.get(m[1]);
      if (!e) { res.write(`event: fin\ndata: ${JSON.stringify({ estado: 'pendiente' })}\n\n`); return res.end(); }
      for (const linea of e.lineas) res.write(`data: ${JSON.stringify({ linea })}\n\n`);
      if (e.estado !== 'corriendo') { res.write(`event: fin\ndata: ${JSON.stringify({ estado: e.estado, codigo: e.codigo })}\n\n`); return res.end(); }
      e.clientes.add(res);
      req.on('close', () => e.clientes.delete(res));
      return;
    }
    if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/pasos\/([a-z]+)\/entrada$/))) {
      const e = ejecuciones.get(m[1]);
      if (e?.estado === 'corriendo') e.hijo.stdin.write('\n');
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/claves' && DEMO) return json(res, 200, { ok: true });
    if (req.method === 'POST' && url.pathname === '/api/claves') {
      const cuerpo = await leerCuerpo(req);
      const permitidas = ['KIE_API_KEY', 'APIFY_TOKEN', 'WHISPER_MODEL', 'PW_EXE', 'PW_CHROME', 'SIE_LOCALE'];
      escribirEnv(ENV_GLOBAL, Object.fromEntries(permitidas.filter(k => k in cuerpo).map(k => [k, cuerpo[k]])));
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/probar') {
      const { servicio, valor } = await leerCuerpo(req);
      return json(res, 200, await probarClave(servicio, valor || leerEnv(ENV_GLOBAL)[servicio] || ''));
    }
    if (req.method === 'POST' && url.pathname === '/api/chriss') return json(res, 200, { respuesta: await responderChriss(await leerCuerpo(req)) });
    if (req.method === 'GET' && url.pathname === '/api/conectores') return json(res, 200, await revisarConectores());
    if (req.method === 'POST' && url.pathname === '/api/tienda') return json(res, 200, await crearTienda(await leerCuerpo(req)));
    if (req.method === 'POST' && url.pathname === '/api/finalizar') {
      const { limpiar } = await leerCuerpo(req);
      json(res, 200, { ok: true });
      const terminar = () => setTimeout(() => process.exit(0), 500);
      if (limpiar && !DEMO) lanzarPaso('limpieza').hijo.on('close', terminar); else terminar();
      return;
    }
    return json(res, 404, { error: 'no existe' });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
});

servidor.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`El puerto ${PUERTO} está ocupado. Cierra la otra ventana del asistente o usa --puerto 4848.`);
  else console.error(`No se pudo iniciar el asistente: ${err.message}`);
  process.exit(1);
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  const enlace = `http://127.0.0.1:${PUERTO}/?t=${TOKEN}`;
  if (DEMO) console.log('\n  MODO DEMOSTRACIÓN: los pasos se simulan; no se instala ni se borra nada.');
  console.log(`\n  Asistente de instalación listo:\n  ${enlace}\n\n  (Deja esta ventana abierta; Ctrl+C para cerrar el asistente.)\n`);
  if (!args.includes('--no-abrir')) {
    const [c, a] = ES_WIN ? ['explorer.exe', [enlace]] : process.platform === 'darwin' ? ['open', [enlace]] : ['xdg-open', [enlace]];
    spawn(c, a, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  }
});

setInterval(() => {
  if (Date.now() - ultimoUso > INACTIVIDAD_MS) { console.log('Asistente cerrado por inactividad.'); process.exit(0); }
}, 60000).unref();
