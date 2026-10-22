#!/usr/bin/env node
// Guardia del Ecomdrop Bootcamp: hook PreToolUse de Claude Code.
//
// Complementa las reglas de ~/.claude/settings.json con lo que un patrón no puede expresar:
//   1. borrados recursivos (rm -r, Remove-Item -Recurse, rd /s, find -delete) FUERA del proyecto actual
//   2. llaves SSH, llaveros, credenciales del sistema y tokens guardados en archivos
//   3. archivos .env de OTROS proyectos (el .env del proyecto actual pide confirmación)
//
// Recibe por stdin el JSON del hook y responde con hookSpecificOutput.permissionDecision
// ("deny" o "ask"). Si no tiene nada que decir, no imprime nada y Claude Code sigue su flujo normal.
import os from 'node:os';
import path from 'node:path';

const ES_WIN = process.platform === 'win32';
const HOME = norm(os.homedir());

// ---------- rutas ----------
function norm(p) {
  let r = String(p).replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(r)) r = r[0].toLowerCase() + r.slice(1);
  r = r.replace(/\/+$/, '') || '/';
  return ES_WIN ? r.toLowerCase() : r;
}

function expandir(p, cwd) {
  let r = String(p).replace(/^["']|["']$/g, '');
  r = r.replace(/^~(?=$|[\\/])/, os.homedir())
    .replace(/^\$\{?HOME\}?(?=$|[\\/])/, os.homedir())
    .replace(/^\$env:USERPROFILE(?=$|[\\/])/i, os.homedir())
    .replace(/^%USERPROFILE%(?=$|[\\/])/i, os.homedir())
    .replace(/^\$\{?PWD\}?(?=$|[\\/])/, cwd);
  // Git Bash: /c/Users/... → c:/Users/...
  if (ES_WIN && /^\/[a-zA-Z]\//.test(r)) r = `${r[1]}:${r.slice(2)}`;
  return norm(path.resolve(cwd, r));
}

const dentro = (hijo, padre) => hijo === padre || hijo.startsWith(padre === '/' ? '/' : `${padre}/`);
const estrictamenteDentro = (hijo, padre) => hijo !== padre && dentro(hijo, padre);

// Rutas que Claude nunca debe leer ni tocar (se comparan sobre la ruta normalizada con «/»)
const SENSIBLES = [
  [/\/\.ssh(\/|$)/i, 'llaves SSH'],
  [/\/library\/keychains(\/|$)/i, 'llavero de macOS'],
  [/\/\.gnupg(\/|$)/i, 'llaves GPG'],
  [/\/\.local\/share\/keyrings(\/|$)/i, 'llavero de Linux'],
  [/\/appdata\/(roaming|local)\/microsoft\/(credentials|protect|vault)(\/|$)/i, 'credenciales de Windows'],
  [/\/\.aws\/(credentials|config)$/i, 'credenciales de AWS'],
  [/\/\.config\/gh\/hosts\.yml$/i, 'token de GitHub CLI'],
  [/\/\.docker\/config\.json$/i, 'credenciales de Docker'],
  [/\/\.(netrc|npmrc|pypirc)$/i, 'tokens de registro de paquetes'],
  [/\/\.claude\.json$/i, 'configuración de Claude Code con tokens de MCP'],
  [/\/\.ecomdrop\/\.env$/i, 'claves globales del kit'],
];
const PALABRAS_SENSIBLES = [
  [/\bsecurity\s+(find-(generic|internet)-password|dump-keychain|export|unlock-keychain)\b/i, 'acceso al llavero de macOS'],
  [/\bsecret-tool\s+(lookup|search)\b/i, 'acceso al llavero de Linux'],
  [/\bcmdkey\s+\/list\b|\bGet-StoredCredential\b|\bvaultcmd\b/i, 'credenciales de Windows'],
  [/\b(id_rsa|id_ed25519|id_ecdsa|id_dsa)\b/i, 'llaves SSH'],
];

const esEnv = (p) => /^\.env(\..+)?$/i.test(path.posix.basename(p)) && !/\.(example|sample|template|dist|defaults?)$/i.test(p);

function revisarRuta(ruta, ctx, modo) {
  for (const [re, que] of SENSIBLES) if (re.test(ruta)) return { decision: 'deny', motivo: `Bloqueado: ${ruta} contiene ${que}.` };
  if (esEnv(ruta)) {
    if (!ctx.proyecto || !dentro(ruta, ctx.proyecto)) {
      return { decision: 'deny', motivo: `Bloqueado: ${ruta} es el .env de otro proyecto. Trabaja solo con el .env del proyecto actual.` };
    }
    return { decision: 'ask', motivo: `${ruta} contiene claves. ¿Seguro que Claude debe ${modo === 'leer' ? 'leerlo' : 'modificarlo'}?` };
  }
  return null;
}

// ---------- shell ----------
function trozos(cmd) {
  // separa por ; && || | & y saltos de línea, respetando comillas
  const out = []; let actual = ''; let q = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) { if (c === q) q = null; actual += c; continue; }
    if (c === '"' || c === "'") { q = c; actual += c; continue; }
    if (c === '\n' || c === ';' || c === '|' || c === '&') { out.push(actual); actual = ''; continue; }
    actual += c;
  }
  out.push(actual);
  return out.map(s => s.trim()).filter(Boolean);
}

function palabras(s) {
  const out = []; const re = /"([^"]*)"|'([^']*)'|(\S+)/g; let m;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const PREFIJOS = new Set(['sudo', 'command', 'builtin', 'exec', 'nohup', 'time', 'doas']);
function quitarPrefijos(ws) {
  let i = 0;
  while (i < ws.length && (PREFIJOS.has(ws[i]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(ws[i]) || ws[i] === 'env' || (ws[i - 1] === 'sudo' && ws[i].startsWith('-')))) i++;
  return ws.slice(i);
}

function revisarBorrado(ws, ctx) {
  const prog = path.posix.basename((ws[0] || '').replace(/\\/g, '/')).toLowerCase().replace(/\.exe$/, '');
  let recursivo = false; let objetivos = []; let raizPermitida = false;
  if (prog === 'rm') {
    recursivo = ws.slice(1).some(w => /^-[a-zA-Z]*[rR]/.test(w) || w === '--recursive');
    objetivos = ws.slice(1).filter(w => !w.startsWith('-'));
  } else if (['remove-item', 'ri', 'rd', 'rmdir', 'del', 'erase'].includes(prog)) {
    // PowerShell: Remove-Item -Recurse · cmd: rd /s, del /s · Unix: rmdir solo borra carpetas vacías
    recursivo = ws.slice(1).some(w => /^-rec/i.test(w) || /^\/s$/i.test(w)) && (ES_WIN || prog !== 'rmdir');
    objetivos = ws.slice(1).filter(w => !w.startsWith('-') && !/^\/[a-z]$/i.test(w));
  } else if (prog === 'find') {
    const borra = ws.includes('-delete') || ws.some((w, i) => w === '-exec' && /(^|\/)rm$/.test(ws[i + 1] || ''));
    if (borra) { recursivo = true; raizPermitida = true; // find filtra: puede partir de la raíz del proyecto
      objetivos = ws.slice(1).filter((w, i, a) => !w.startsWith('-') && (i === 0 || !a[i - 1].startsWith('-'))).slice(0, 1); if (!objetivos.length) objetivos = ['.']; }
  } else if (prog === 'git' && ws[1] === 'clean') {
    return null; // git clean solo actúa dentro del repo; lo cubre la regla «ask» de settings.json
  }
  if (!recursivo) return null;
  if (!ctx.proyecto) {
    return { decision: 'deny', motivo: 'Bloqueado: borrado recursivo sin carpeta de proyecto. Abre Claude Code dentro de la carpeta de un proyecto (no en tu carpeta de usuario).' };
  }
  if (!objetivos.length) return null;
  for (const o of objetivos) {
    if (/\$\(|`|\$(?!\{?(HOME|PWD)\b)[A-Za-z_{]|%[A-Za-z_]+%(?<!%USERPROFILE%)/.test(o)) {
      return { decision: 'deny', motivo: `Bloqueado: «${o}» usa una variable o subcomando. Para borrar en forma recursiva usa rutas literales dentro del proyecto.` };
    }
    const base = o.split(/[*?[]/)[0] || '.';
    const ruta = expandir(base, ctx.cwd);
    const permitido = raizPermitida ? dentro(ruta, ctx.proyecto) : estrictamenteDentro(ruta, ctx.proyecto);
    if (ruta === '/' || /^[a-z]:$/.test(ruta) || ruta === HOME || !permitido) {
      return { decision: 'deny', motivo: `Bloqueado: borrado recursivo de ${ruta}, que está fuera del proyecto (${ctx.proyecto}) o es el proyecto entero.` };
    }
  }
  return null;
}

function revisarComando(cmd, ctx) {
  for (const [re, que] of PALABRAS_SENSIBLES) if (re.test(cmd)) return { decision: 'deny', motivo: `Bloqueado: el comando implica ${que}.` };
  let cwd = ctx.cwd;
  for (const t of trozos(cmd)) {
    const ws = quitarPrefijos(palabras(t));
    if (!ws.length) continue;
    if (/^(cd|pushd|set-location|sl)$/i.test(ws[0]) && ws[1]) { cwd = expandir(ws[1], cwd); continue; }
    const r = revisarBorrado(ws, { ...ctx, cwd });
    if (r) return r;
    for (const w of ws.slice(1)) {
      const limpio = w.replace(/^[<>]+/, '').replace(/^-{1,2}[A-Za-z-]+=/, '');
      if (!/[\\/~.]/.test(limpio) || /^[a-z]+:\/\//i.test(limpio)) continue;
      const r2 = revisarRuta(expandir(limpio, cwd), ctx, 'leer');
      if (r2) return r2;
    }
  }
  return null;
}

// ---------- principal ----------
function decidir(entrada) {
  const cwd = norm(entrada.cwd || process.cwd());
  let proyecto = norm(process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd());
  // abrir Claude en la carpeta de usuario o en la raíz no cuenta como proyecto
  if (proyecto === HOME || proyecto === '/' || /^[a-z]:$/.test(proyecto)) proyecto = null;
  const ctx = { cwd, proyecto };
  const t = entrada.tool_name || '';
  const e = entrada.tool_input || {};
  if (t === 'Bash' || t === 'PowerShell') return revisarComando(String(e.command || ''), ctx);
  const archivo = e.file_path || e.notebook_path || e.path;
  const modo = /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(t) ? 'modificar' : 'leer';
  if (archivo) { const r = revisarRuta(expandir(archivo, cwd), ctx, modo); if (r) return r; }
  if (t === 'Glob' && e.pattern) {
    const base = String(e.pattern).split(/[*?[{]/)[0];
    if (base) { const r = revisarRuta(expandir(base, archivo ? expandir(archivo, cwd) : cwd), ctx, 'leer'); if (r && r.decision === 'deny') return r; }
  }
  return null;
}

export { decidir };

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('guardia.mjs')) {
  let datos = '';
  process.stdin.on('data', d => { datos += d; });
  process.stdin.on('end', () => {
    try {
      const r = decidir(JSON.parse(datos || '{}'));
      if (r) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: r.decision, permissionDecisionReason: `[guardia Ecomdrop] ${r.motivo}` },
        }));
      }
    } catch {
      // nunca rompe la sesión: si no entiende la entrada, decide el flujo normal de permisos
    }
    process.exit(0);
  });
}
