// Catálogo de herramientas: cómo se detectan y cómo se instalan en cada sistema.
// Los comandos de instalación son los oficiales verificados para el kit (ver scripts/setup.sh y setup.ps1).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { extraerVersion } from './semver.mjs';

export const PLATAFORMA = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
const ES_WIN = PLATAFORMA === 'win';
const HOME = os.homedir();

/** Ejecuta un comando corto y devuelve su salida (stdout+stderr), o null si no existe / falla al arrancar. */
export function correr(cmd, args = [], { cwd, timeout = 15000 } = {}) {
  const r = spawnSync(cmd, args, { cwd, timeout, encoding: 'utf8', shell: ES_WIN, windowsHide: true, env: process.env });
  if (r.error) return null;
  return { codigo: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

export function ruta(cmd) {
  const r = ES_WIN ? correr('where', [cmd]) : correr('sh', ['-c', `command -v ${cmd}`]);
  if (!r || r.codigo !== 0) return null;
  const linea = r.salida.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return linea || null;
}

const winget = (id) => ({ cmd: 'winget', args: ['install', '-e', '--id', id, '--source', 'winget', '--silent', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'] });
const brew = (...f) => ({ cmd: 'brew', args: ['install', ...f] });
const apt = (...p) => ({ cmd: 'sudo', args: ['apt-get', 'install', '-y', ...p], sudo: `apt instala paquetes del sistema (${p.join(', ')})` });
const shell = (linea) => (ES_WIN
  ? { cmd: 'powershell', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', linea] }
  : { cmd: 'bash', args: ['-c', linea] });
const REINSTALAR = 'Vuelve a ejecutar el instalador de una línea del bootcamp: es idempotente y solo instala lo que falta.';

/**
 * id → { nombre, detectar: [cmd, ...args] | función, instalar: { mac, win, linux } | null, nota }
 * `instalar[plataforma]` es { cmd, args, sudo? } o un texto con la instrucción manual.
 */
export const CATALOGO = {
  git: { nombre: 'Git', detectar: ['git', '--version'], instalar: { mac: brew('git'), win: winget('Git.Git'), linux: apt('git') } },
  gh: { nombre: 'GitHub CLI', detectar: ['gh', '--version'], instalar: { mac: brew('gh'), win: winget('GitHub.cli'), linux: REINSTALAR } },
  fnm: {
    nombre: 'fnm', detectar: ['fnm', '--version'],
    instalar: { mac: shell('curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "$HOME/.fnm" --skip-shell --force-install'), win: winget('Schniz.fnm'), linux: shell('curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "$HOME/.fnm" --skip-shell') },
  },
  node: { nombre: 'Node.js', detectar: ['node', '--version'], instalar: null /* lo gestiona fnm */ },
  npm: { nombre: 'npm', detectar: ['npm', '--version'], instalar: null },
  pnpm: { nombre: 'pnpm', detectar: ['pnpm', '--version'], instalar: { mac: { cmd: 'npm', args: ['install', '-g', 'pnpm'] }, win: { cmd: 'npm', args: ['install', '-g', 'pnpm'] }, linux: { cmd: 'npm', args: ['install', '-g', 'pnpm'] } } },
  yarn: { nombre: 'Yarn', detectar: ['yarn', '--version'], instalar: { mac: { cmd: 'npm', args: ['install', '-g', 'yarn'] }, win: { cmd: 'npm', args: ['install', '-g', 'yarn'] }, linux: { cmd: 'npm', args: ['install', '-g', 'yarn'] } } },
  bun: { nombre: 'Bun', detectar: ['bun', '--version'], instalar: { mac: shell('curl -fsSL https://bun.sh/install | bash'), win: shell('irm bun.sh/install.ps1 | iex'), linux: shell('curl -fsSL https://bun.sh/install | bash') } },
  uv: { nombre: 'uv', detectar: ['uv', '--version'], instalar: { mac: shell('curl -LsSf https://astral.sh/uv/install.sh | sh'), win: shell('irm https://astral.sh/uv/install.ps1 | iex'), linux: shell('curl -LsSf https://astral.sh/uv/install.sh | sh') } },
  python: {
    nombre: 'Python',
    detectar: () => detectarPython(),
    instalar: { mac: { cmd: 'uv', args: ['python', 'install', '--default'] }, win: { cmd: 'uv', args: ['python', 'install', '--default'] }, linux: { cmd: 'uv', args: ['python', 'install', '--default'] } },
  },
  docker: {
    nombre: 'Docker', detectar: ['docker', '--version'],
    instalar: { mac: brew('--cask', 'docker'), win: winget('Docker.DockerDesktop'), linux: apt('docker.io', 'docker-compose-v2') },
    nota: 'Después de instalarlo, abre Docker Desktop una vez para que arranque el motor.',
  },
  compose: { nombre: 'Docker Compose', detectar: ['docker', 'compose', 'version'], instalar: { mac: 'Viene con Docker Desktop.', win: 'Viene con Docker Desktop.', linux: apt('docker-compose-v2') } },
  ffmpeg: { nombre: 'ffmpeg', detectar: ['ffmpeg', '-version'], instalar: { mac: brew('ffmpeg'), win: winget('Gyan.FFmpeg'), linux: apt('ffmpeg') } },
  ffprobe: { nombre: 'ffprobe', detectar: ['ffprobe', '-version'], instalar: { mac: brew('ffmpeg'), win: winget('Gyan.FFmpeg'), linux: apt('ffmpeg') } },
  whisper: { nombre: 'whisper-cli', detectar: () => (ruta('whisper-cli') ? { version: 'instalado', ruta: ruta('whisper-cli') } : null), instalar: { mac: brew('whisper-cpp'), win: REINSTALAR, linux: REINSTALAR } },
  imagemagick: {
    nombre: 'ImageMagick',
    detectar: () => { for (const c of ['magick', 'convert']) { const r = ruta(c) && correr(c, ['-version']); if (r?.codigo === 0 && /ImageMagick/i.test(r.salida)) return { version: extraerVersion(r.salida), ruta: ruta(c) }; } return null; },
    instalar: { mac: brew('imagemagick'), win: winget('ImageMagick.ImageMagick'), linux: apt('imagemagick') },
  },
  sips: { nombre: 'sips', detectar: () => (PLATAFORMA === 'mac' && ruta('sips') ? { version: 'macOS', ruta: ruta('sips') } : null), instalar: null },
  shopify: { nombre: 'Shopify CLI', detectar: ['shopify', 'version'], instalar: { mac: { cmd: 'npm', args: ['install', '-g', '@shopify/cli@latest'] }, win: { cmd: 'npm', args: ['install', '-g', '@shopify/cli@latest'] }, linux: { cmd: 'npm', args: ['install', '-g', '@shopify/cli@latest'] } } },
  claude: { nombre: 'Claude Code', detectar: ['claude', '--version'], instalar: { mac: shell('curl -fsSL https://claude.ai/install.sh | bash'), win: shell('irm https://claude.ai/install.ps1 | iex'), linux: shell('curl -fsSL https://claude.ai/install.sh | bash') } },
  curl: { nombre: 'curl', detectar: ['curl', '--version'], instalar: { mac: brew('curl'), win: 'Viene con Windows 10 y 11.', linux: apt('curl') } },
};

function detectarPython() {
  // En Windows «python3» puede ser el acceso directo falso de Microsoft Store: se valida ejecutándolo.
  for (const c of ES_WIN ? ['python3', 'python', 'py'] : ['python3', 'python']) {
    const r = correr(c, ['-c', 'import sys,platform;print(platform.python_version());print(sys.executable)']);
    if (r?.codigo === 0) {
      const [version, ejecutable] = r.salida.trim().split(/\r?\n/);
      if (extraerVersion(version)) return { version: extraerVersion(version), ruta: ejecutable, comando: c };
    }
  }
  return null;
}

/** Detecta una herramienta del catálogo → { id, nombre, instalado, version, ruta }. */
export function detectar(id) {
  const def = CATALOGO[id];
  if (!def) throw new Error(`Herramienta desconocida: ${id}`);
  let r = null;
  if (typeof def.detectar === 'function') r = def.detectar();
  else {
    const [cmd, ...args] = def.detectar;
    const donde = ruta(cmd);
    if (donde) {
      const s = correr(cmd, args);
      if (s && s.codigo === 0) r = { version: extraerVersion(s.salida) ?? 'instalado', ruta: donde };
    }
  }
  return { id, nombre: def.nombre, instalado: Boolean(r), version: r?.version ?? null, ruta: r?.ruta ?? null, ...(r?.comando ? { comando: r.comando } : {}) };
}

/** Cómo arreglar una herramienta faltante en este sistema. */
export function comoInstalar(id) {
  const def = CATALOGO[id];
  const i = def?.instalar?.[PLATAFORMA];
  if (!i) return null;
  if (typeof i === 'string') return { automatico: false, instruccion: i };
  return { automatico: true, cmd: i.cmd, args: i.args, sudo: i.sudo ?? null, nota: def.nota ?? null, texto: [i.cmd, ...i.args].join(' ') };
}

/** ¿Está descargado el Chromium de Playwright? */
export function chromiumPlaywright() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH
    || (PLATAFORMA === 'mac' ? path.join(HOME, 'Library', 'Caches', 'ms-playwright')
      : PLATAFORMA === 'win' ? path.join(process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local'), 'ms-playwright')
        : path.join(HOME, '.cache', 'ms-playwright'));
  try { return fs.readdirSync(base).filter((d) => /^chromium/.test(d)).map((d) => path.join(base, d)); } catch { return []; }
}

/** ¿Está corriendo el motor de Docker? */
export function dockerCorriendo() {
  const r = correr('docker', ['info'], { timeout: 10000 });
  return Boolean(r && r.codigo === 0);
}

/** ¿Qué paquetes de Python (distribuciones) tiene este intérprete? → Map nombre-normalizado → versión */
export function paquetesPython(interprete) {
  const r = correr(interprete, ['-c', 'import importlib.metadata as m,json;print(json.dumps({d.metadata["Name"]:d.version for d in m.distributions() if d.metadata["Name"]}))'], { timeout: 20000 });
  if (!r || r.codigo !== 0) return null;
  try {
    const obj = JSON.parse(r.salida.trim().split(/\r?\n/).pop());
    return new Map(Object.entries(obj).map(([k, v]) => [normalizarPaquete(k), v]));
  } catch { return null; }
}

export const normalizarPaquete = (n) => String(n).toLowerCase().replace(/[-_.]+/g, '-');
