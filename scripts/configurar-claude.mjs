#!/usr/bin/env node
// Aplica la configuración del kit a ~/.claude sin pisar lo que el estudiante ya tenga.
//
//   node scripts/configurar-claude.mjs --kit <ruta-kit> [--sie <ruta-sie>] [--env ~/.ecomdrop/.env] [--simular]
//
// 1. ~/.claude/CLAUDE.md: inserta (o reemplaza) el bloque del kit entre marcadores.
// 2. ~/.claude/settings.json: fusiona config/settings.json (permisos: unión; deny siempre gana).
// 3. MCP: registra config/mcp.template.json con alcance de usuario, sustituyendo ${VAR} desde el .env.
// 4. Plugin ecomdrop-bootcam (skills, comandos y MCP de Dropi) desde un marketplace local.
// Antes de tocar un archivo existente guarda una copia <archivo>.antes-de-ecomdrop (solo la primera vez).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const KIT = path.resolve(arg('--kit', path.join(path.dirname(new URL(import.meta.url).pathname), '..')));
const ENV = arg('--env', path.join(os.homedir(), '.ecomdrop', '.env'));
const SIMULAR = args.includes('--simular');
const CLAUDE = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const ES_WIN = process.platform === 'win32';
const INICIO = '<!-- ecomdrop-bootcamp:inicio (no edites este bloque: lo reescribe el kit) -->';
const FIN = '<!-- ecomdrop-bootcamp:fin -->';

const ok = (m) => console.log(`  ✔ ${m}`);
const aviso = (m) => console.log(`  ! ${m}`);

function leerEnv(archivo) {
  const out = {};
  try {
    for (const l of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[2] !== '') out[m[1]] = m[2];
    }
  } catch { /* sin .env */ }
  return out;
}
const VARS = { ...leerEnv(ENV), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^[A-Z0-9_]+$/.test(k))) };

function respaldar(archivo) {
  const copia = `${archivo}.antes-de-ecomdrop`;
  if (fs.existsSync(archivo) && !fs.existsSync(copia) && !SIMULAR) fs.copyFileSync(archivo, copia);
}
function escribir(archivo, contenido) {
  if (SIMULAR) { console.log(`--- (simulación) ${archivo}\n${contenido}`); return; }
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, contenido);
}

// ---------- 1. CLAUDE.md ----------
function claudeMd() {
  const fuente = path.join(KIT, 'config', 'CLAUDE.md');
  if (!fs.existsSync(fuente)) return aviso('config/CLAUDE.md no existe; se salta');
  const destino = path.join(CLAUDE, 'CLAUDE.md');
  const bloque = `${INICIO}\n${fs.readFileSync(fuente, 'utf8').trim()}\n${FIN}`;
  let actual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : '';
  const re = new RegExp(`${INICIO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${FIN}`);
  respaldar(destino);
  actual = re.test(actual) ? actual.replace(re, bloque) : (actual.trim() ? `${actual.trimEnd()}\n\n${bloque}\n` : `${bloque}\n`);
  escribir(destino, actual);
  ok(`CLAUDE.md global actualizado (${destino})`);
}

// ---------- 2. settings.json ----------
function settings() {
  const fuente = path.join(KIT, 'config', 'settings.json');
  if (!fs.existsSync(fuente)) return aviso('config/settings.json todavía no existe; se salta');
  // la guardia vive en ~/.ecomdrop/guardia (sobrevive a la limpieza del instalador)
  const ecomdropHome = process.env.ECOMDROP_HOME || path.join(os.homedir(), '.ecomdrop');
  const guardia = path.join(KIT, 'config', 'guardia', 'guardia.mjs');
  if (fs.existsSync(guardia) && !SIMULAR) {
    fs.mkdirSync(path.join(ecomdropHome, 'guardia'), { recursive: true });
    fs.copyFileSync(guardia, path.join(ecomdropHome, 'guardia', 'guardia.mjs'));
    ok(`guardia instalada en ${path.join(ecomdropHome, 'guardia')}`);
  }
  const texto = fs.readFileSync(fuente, 'utf8').replaceAll('${ECOMDROP_HOME}', ecomdropHome.replace(/\\/g, '/'));
  const kit = JSON.parse(texto);
  const destino = path.join(CLAUDE, 'settings.json');
  let actual = {};
  if (fs.existsSync(destino)) {
    try { actual = JSON.parse(fs.readFileSync(destino, 'utf8')); }
    catch { throw new Error(`${destino} no es JSON válido. Corrígelo o bórralo y vuelve a ejecutar este paso.`); }
  }
  const union = (a = [], b = []) => [...new Set([...a, ...b])];
  const final = { ...kit, ...actual };
  final.permissions = { ...(kit.permissions || {}), ...(actual.permissions || {}) };
  for (const k of ['allow', 'ask', 'deny']) {
    const v = union(actual.permissions?.[k], kit.permissions?.[k]);
    if (v.length) final.permissions[k] = v;
  }
  // el kit nunca deja activado el modo sin permisos
  if (final.permissions.defaultMode === 'bypassPermissions') delete final.permissions.defaultMode;
  final.permissions.disableBypassPermissionsMode = 'disable';
  delete final.skipDangerousModePermissionPrompt;
  // hooks: se conservan los del estudiante y se añaden los del kit (sin duplicar por comando)
  final.hooks = { ...(actual.hooks || {}) };
  for (const [evento, grupos] of Object.entries(kit.hooks || {})) {
    const previos = (final.hooks[evento] || []).filter(g => !(g.hooks || []).some(h => /guardia[\\/]guardia\.mjs/.test(h.command || '')));
    final.hooks[evento] = [...previos, ...grupos];
  }
  if (!Object.keys(final.hooks).length) delete final.hooks;
  final.env = { ...(kit.env || {}), ...(actual.env || {}) };
  if (ES_WIN && !final.env.CLAUDE_CODE_GIT_BASH_PATH) {
    const bash = ['C:\\Program Files\\Git\\bin\\bash.exe', path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Git', 'bin', 'bash.exe')]
      .find(p => fs.existsSync(p));
    if (bash) final.env.CLAUDE_CODE_GIT_BASH_PATH = bash;
  }
  if (!Object.keys(final.env).length) delete final.env;
  delete final._doc;
  delete final.$schema;
  final.$schema = kit.$schema;
  respaldar(destino);
  escribir(destino, JSON.stringify(final, null, 2) + '\n');
  ok(`settings.json fusionado (${destino})`);
}

// ---------- 3. MCP ----------
function sustituir(valor, faltan) {
  if (typeof valor === 'string') {
    return valor.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_, k, def) => {
      if (VARS[k]) return VARS[k];
      if (def !== undefined) return def;
      faltan.add(k); return '';
    });
  }
  if (Array.isArray(valor)) return valor.map(v => sustituir(v, faltan));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, sustituir(v, faltan)]));
  return valor;
}

// Windows: los .exe se lanzan sin shell, así los argumentos (JSON, rutas con espacios) llegan intactos.
// Los .cmd/.bat (npm, npx, pnpm, shopify) necesitan cmd.exe; Node no cita los argumentos con shell: true,
// así que se citan a mano.
const citarWin = (a) => (/^[\w@%+=:,./\\-]+$/.test(String(a)) ? String(a) : `"${String(a).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`);
function spawnSeguro(cmd, args, opciones) {
  if (process.platform !== 'win32') return spawnSync(cmd, args, opciones);
  const r = spawnSync(cmd, args, { ...opciones, shell: false });
  if (!r.error || r.error.code !== 'ENOENT') return r;
  return spawnSync([cmd, ...args.map(citarWin)].join(' '), [], { ...opciones, shell: true });
}

function claude(...a) {
  return spawnSeguro('claude', a, { encoding: 'utf8', timeout: 60000 });
}

function mcp() {
  const fuente = path.join(KIT, 'config', 'mcp.template.json');
  if (!fs.existsSync(fuente)) return aviso('config/mcp.template.json no existe; se salta');
  if (!SIMULAR && claude('--version').status !== 0) throw new Error('Claude Code no está instalado o no está en el PATH.');
  const { mcpServers } = JSON.parse(fs.readFileSync(fuente, 'utf8'));
  for (const [nombre, def] of Object.entries(mcpServers)) {
    const faltan = new Set();
    const limpio = Object.fromEntries(Object.entries(def).filter(([k]) => !k.startsWith('_')));
    const conf = sustituir(limpio, faltan);
    if (faltan.size) {
      if (def._opcional) { aviso(`MCP ${nombre}: se salta (falta ${[...faltan].join(', ')}; agrégala en el asistente)`); continue; }
      throw new Error(`MCP ${nombre}: faltan las variables ${[...faltan].join(', ')}`);
    }
    // en Windows los comandos npx necesitan pasar por cmd
    if (ES_WIN && conf.type === 'stdio' && conf.command === 'npx') { conf.args = ['/c', 'npx', ...(conf.args || [])]; conf.command = 'cmd'; }
    if (SIMULAR) { console.log(`--- (simulación) claude mcp add-json -s user ${nombre} ${JSON.stringify(conf).replace(/(Bearer )[^"]+/, '$1***')}`); continue; }
    claude('mcp', 'remove', nombre, '-s', 'user'); // idempotente: se vuelve a registrar con la config actual
    const r = claude('mcp', 'add-json', nombre, JSON.stringify(conf), '-s', 'user');
    if (r.status !== 0) throw new Error(`No se pudo registrar el MCP ${nombre}: ${(r.stderr || r.stdout || '').trim()}`);
    ok(`MCP ${nombre} registrado`);
  }
}

// ---------- 4. plugin ecomdrop-bootcamp ----------
// Se instala desde un marketplace local en ~/.ecomdrop/marketplace (sobrevive a la limpieza del instalador).
// Si no se puede, se copian las skills a ~/.claude/skills y se registra el MCP de Dropi como servidor de usuario.
function plugin() {
  const ecomdropHome = process.env.ECOMDROP_HOME || path.join(os.homedir(), '.ecomdrop');
  const origen = path.join(KIT, 'plugin');
  if (!fs.existsSync(path.join(origen, '.claude-plugin', 'plugin.json'))) return aviso('plugin/ no existe; se salta');
  if (SIMULAR) { console.log(`--- (simulación) marketplace local en ${path.join(ecomdropHome, 'marketplace')}`); return; }

  const mk = path.join(ecomdropHome, 'marketplace');
  fs.rmSync(mk, { recursive: true, force: true });
  fs.mkdirSync(path.join(mk, '.claude-plugin'), { recursive: true });
  fs.copyFileSync(path.join(KIT, '.claude-plugin', 'marketplace.json'), path.join(mk, '.claude-plugin', 'marketplace.json'));
  fs.cpSync(origen, path.join(mk, 'plugin'), { recursive: true });

  const lista = claude('plugin', 'marketplace', 'list');
  const yaEsta = lista.status === 0 && /\becomdrop\b/.test(lista.stdout || '');
  const mkOk = (yaEsta ? claude('plugin', 'marketplace', 'update', 'ecomdrop') : claude('plugin', 'marketplace', 'add', mk)).status === 0;
  let ok = false;
  if (mkOk) {
    const instalado = /ecomdrop-bootcamp@ecomdrop/.test(claude('plugin', 'list').stdout || '');
    ok = (instalado ? claude('plugin', 'update', 'ecomdrop-bootcamp@ecomdrop', '-s', 'user') : claude('plugin', 'install', 'ecomdrop-bootcamp@ecomdrop', '-s', 'user')).status === 0;
  }
  if (ok) {
    claude('mcp', 'remove', 'dropi', '-s', 'user'); // por si quedó de una instalación sin plugin
    return ok_(`plugin ecomdrop-bootcamp instalado (skill /setup-proyecto, comandos /ecomdrop-bootcamp:*, MCP oficial de Dropi)`);
  }

  aviso('No se pudo instalar el plugin; se instalan sus piezas por separado.');
  const skills = path.join(origen, 'skills');
  for (const s of fs.existsSync(skills) ? fs.readdirSync(skills) : []) {
    if (!fs.existsSync(path.join(skills, s, 'SKILL.md'))) continue;
    const destino = path.join(CLAUDE, 'skills', s);
    fs.rmSync(destino, { recursive: true, force: true });
    fs.cpSync(path.join(skills, s), destino, { recursive: true });
    ok_(`skill /${s} instalada`);
  }
  const mcp = JSON.parse(fs.readFileSync(path.join(origen, '.mcp.json'), 'utf8')).mcpServers ?? {};
  for (const [nombre, conf] of Object.entries(mcp)) {
    claude('mcp', 'remove', nombre, '-s', 'user');
    if (claude('mcp', 'add-json', nombre, JSON.stringify(conf), '-s', 'user').status === 0) ok_(`MCP ${nombre} registrado`);
  }
}
const ok_ = ok;

try {
  claudeMd();
  settings();
  mcp();
  plugin();
} catch (err) {
  console.error(`  ✖ ${err.message}`);
  process.exit(1);
}
