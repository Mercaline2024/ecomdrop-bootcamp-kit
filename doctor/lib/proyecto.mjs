// Lee lo que un proyecto declara que necesita. Solo lectura: nunca modifica nada.
import fs from 'node:fs';
import path from 'node:path';

const leer = (ruta) => { try { return fs.readFileSync(ruta, 'utf8'); } catch { return null; } };
const existe = (ruta) => fs.existsSync(ruta);
const leerJSON = (ruta) => { const t = leer(ruta); if (t === null) return undefined; try { return JSON.parse(t); } catch { return null; } };

/** Claves de un archivo .env (sin valores: solo si están vacías o no). */
export function leerEnv(ruta) {
  const t = leer(ruta);
  if (t === null) return null;
  const claves = {};
  for (const linea of t.split(/\r?\n/)) {
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const valor = m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
    claves[m[1]] = valor !== '';
  }
  return claves;
}

/** Nombres de paquete de un requirements.txt (sin versiones, extras ni opciones). */
export function leerRequirements(texto) {
  const out = [];
  for (const crudo of String(texto ?? '').split(/\r?\n/)) {
    const l = crudo.replace(/#.*$/, '').trim();
    if (!l || l.startsWith('-') || /^(git\+|https?:|\.|\/)/.test(l)) continue;
    const m = l.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(\[[^\]]*\])?\s*(.*)$/);
    if (m) out.push({ nombre: m[1], rango: m[3].split(';')[0].trim() || null });
  }
  return out;
}

/** Lo mínimo de un pyproject.toml: requires-python y la lista de dependencies. */
export function leerPyproject(texto) {
  if (!texto) return null;
  const requiresPython = texto.match(/^\s*requires-python\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
  const bloque = texto.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m)?.[1] ?? '';
  const dependencias = [...bloque.matchAll(/["']([^"']+)["']/g)].map((m) => leerRequirements(m[1])[0]).filter(Boolean);
  return { requiresPython, dependencias, nombre: texto.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1] ?? null };
}

/** Servicios de un docker-compose (lectura superficial, sin parser YAML). */
export function leerCompose(texto) {
  if (!texto) return null;
  const servicios = [];
  const lineas = texto.split(/\r?\n/);
  const i = lineas.findIndex((l) => /^services:\s*$/.test(l));
  if (i >= 0) {
    for (const l of lineas.slice(i + 1)) {
      if (/^\S/.test(l)) break;
      const m = l.match(/^ {2}([A-Za-z0-9._-]+):\s*$/);
      if (m) servicios.push(m[1]);
    }
  }
  const envFiles = [...texto.matchAll(/env_file:\s*(?:\[?\s*["']?([^"'\]\n]+)["']?)/g)].map((m) => m[1].trim());
  return { servicios, envFiles };
}

const LOCKS = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
];

export function analizarProyecto(dir) {
  const p = (f) => path.join(dir, f);
  const r = { ruta: dir, tipos: [], archivos: [] };
  const marcar = (f) => { if (existe(p(f))) { r.archivos.push(f); return true; } return false; };

  // ── Node ──
  const pkg = leerJSON(p('package.json'));
  if (pkg !== undefined) {
    marcar('package.json');
    r.tipos.push('node');
    const lock = LOCKS.find(([f]) => marcar(f));
    const declarado = pkg?.packageManager?.match(/^(npm|pnpm|yarn|bun)@?([^+]*)/);
    const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
    const versionNode = [['.nvmrc'], ['.node-version']].map(([f]) => (marcar(f) ? { archivo: f, valor: leer(p(f)).trim().split(/\s/)[0] } : null)).find(Boolean);
    r.node = {
      valido: pkg !== null,
      nombre: pkg?.name ?? null,
      engines: pkg?.engines?.node ?? null,
      versionArchivo: versionNode ?? null,
      gestor: declarado?.[1] ?? lock?.[1] ?? 'npm',
      gestorVersion: declarado?.[2] || null,
      lockfile: lock?.[0] ?? null,
      dependencias: Object.keys(deps),
      instaladas: Object.keys(deps).filter((d) => existe(p(path.join('node_modules', d, 'package.json')))),
      nodeModules: existe(p('node_modules')),
      scripts: pkg?.scripts ?? {},
      usaPlaywright: 'playwright' in deps || '@playwright/test' in deps,
      nativas: Object.keys(deps).filter((d) => /^(sharp|canvas|bcrypt|better-sqlite3|sqlite3|node-sass|@napi-rs\/.+|argon2|re2)$/.test(d)),
    };
  }

  // ── Python ──
  const req = leer(p('requirements.txt'));
  const py = leerPyproject(leer(p('pyproject.toml')));
  if (req !== null || py) {
    if (req !== null) marcar('requirements.txt');
    if (py) marcar('pyproject.toml');
    marcar('uv.lock'); marcar('.python-version'); marcar('poetry.lock');
    r.tipos.push('python');
    r.python = {
      requirements: req !== null ? leerRequirements(req) : [],
      pyproject: py,
      requiresPython: py?.requiresPython ?? (existe(p('.python-version')) ? leer(p('.python-version')).trim() : null),
      uvLock: existe(p('uv.lock')),
      venv: ['.venv', 'venv'].find((v) => existe(p(v))) ?? null,
    };
  }

  // ── Docker ──
  const compose = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'].find(marcar);
  const dockerfile = marcar('Dockerfile');
  if (compose || dockerfile) {
    r.tipos.push('docker');
    r.docker = { compose: compose ?? null, dockerfile, ...(compose ? leerCompose(leer(p(compose))) : { servicios: [], envFiles: [] }) };
  }

  // ── Variables de entorno ──
  const ejemplo = ['.env.example', '.env.sample', '.env.template'].find(marcar);
  if (ejemplo) {
    const declaradas = leerEnv(p(ejemplo)) ?? {};
    const actuales = leerEnv(p('.env'));
    r.entorno = {
      ejemplo,
      archivo: actuales ? '.env' : null,
      declaradas: Object.keys(declaradas),
      faltan: actuales ? Object.keys(declaradas).filter((k) => !(k in actuales)) : Object.keys(declaradas),
      vacias: actuales ? Object.keys(declaradas).filter((k) => k in actuales && !actuales[k]) : [],
    };
  }

  // ── SIE: una tienda (tienda.json / sie/) o el propio SIE (tienda.ejemplo.json) ──
  // el propio SIE trae tienda.ejemplo.json (y un enlace sie -> .); una tienda trae tienda.json o el submódulo sie/
  const esSie = existe(p('tienda.ejemplo.json'));
  const esTienda = existe(p('tienda.json')) || (!esSie && existe(p('sie/tienda.ejemplo.json')));
  if (esTienda || esSie) {
    r.tipos.push('sie');
    let tienda = null;
    if (existe(p('tienda.json'))) {
      const t = leerJSON(p('tienda.json'));
      tienda = t === null ? { valido: false } : { valido: true, dominio: t?.tienda?.dominio ?? null, esEjemplo: t?.tienda?.dominio === 'mitienda.com' && t?.tienda?.slug === 'mitienda' };
    }
    const env = leerEnv(p('.env'));
    r.sie = {
      rol: esTienda ? 'tienda' : 'sie',
      tienda,
      submodulo: existe(p('sie')),
      kieKey: Boolean(env?.KIE_API_KEY),
    };
  }

  return r;
}
