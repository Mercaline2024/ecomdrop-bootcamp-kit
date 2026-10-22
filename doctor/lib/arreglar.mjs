// --fix: aplica los arreglos automáticos de un diagnóstico, en orden, mostrando cada comando.
// Nunca inventa valores de claves: solo crea las variables vacías para que el estudiante las complete.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as H from './herramientas.mjs';
import { leerEnv } from './proyecto.mjs';

const ES_WIN = process.platform === 'win32';
const HOME = os.homedir();
const SIE_DIR = path.join(process.env.ECOMDROP_PROYECTOS || path.join(HOME, 'proyectos'), 'super-inteligencia-ecommerce');
const MODELO = process.env.WHISPER_MODEL || path.join(HOME, 'whisper-models', 'ggml-large-v3-turbo.bin');
const MODELO_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin';

// Orden: primero lo que otros necesitan (fnm, uv, gestores), luego dependencias, luego descargas grandes.
const PRIORIDAD = { herramienta: 1, node: 2, 'instalar-node': 4, 'sie-npm': 4, 'instalar-python': 5, 'sie-python': 5, 'copiar-env': 6, 'completar-env': 6, playwright: 7, modelo: 8 };
const PRIMERO = ['fnm', 'uv', 'git', 'pnpm', 'yarn', 'bun'];

function ejecutar(cmd, args, { cwd, log }) {
  log.comando([cmd, ...args].join(' '));
  const r = H.spawnSeguro(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  return !r.error && r.status === 0;
}
// Windows PowerShell 5.1 no entiende «&&»: las partes se ejecutan una a una y se para en la primera que falle.
const enShell = (linea, cwd, log) => linea.split(' && ').every((parte) => (ES_WIN
  ? ejecutar('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', parte], { cwd, log })
  : ejecutar('bash', ['-c', parte], { cwd, log })));

/** Añade al PATH de este proceso las carpetas donde los instaladores dejan binarios nuevos. */
function refrescarPath() {
  const extra = [path.join(HOME, '.local', 'bin'), path.join(HOME, '.fnm'), path.join(HOME, '.bun', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  process.env.PATH = [...extra.filter((d) => fs.existsSync(d)), process.env.PATH].join(path.delimiter);
}

function copiarEnv(dir, ejemplo, log) {
  const destino = path.join(dir, '.env');
  if (fs.existsSync(destino)) return completarEnv(dir, ejemplo, log);
  fs.copyFileSync(path.join(dir, ejemplo), destino);
  try { fs.chmodSync(destino, 0o600); } catch { /* Windows */ }
  log.ok(`.env creado a partir de ${ejemplo}. Revisa y completa sus valores.`);
  return true;
}

function completarEnv(dir, ejemplo, log) {
  const destino = path.join(dir, '.env');
  const actuales = leerEnv(destino) ?? {};
  const faltan = Object.keys(leerEnv(path.join(dir, ejemplo)) ?? {}).filter((k) => !(k in actuales));
  if (!faltan.length) return true;
  fs.appendFileSync(destino, `\n# Añadidas por ecomdrop-doctor desde ${ejemplo}: completa sus valores\n${faltan.map((k) => `${k}=`).join('\n')}\n`);
  log.ok(`Añadidas a .env (vacías): ${faltan.join(', ')}`);
  return true;
}

function descargarModelo(log) {
  fs.mkdirSync(path.dirname(MODELO), { recursive: true });
  const ok = ejecutar('curl', ['-fL', '--retry', '5', '--retry-delay', '3', '-C', '-', '-o', `${MODELO}.part`, MODELO_URL], { log });
  if (ok) fs.renameSync(`${MODELO}.part`, MODELO);
  return ok;
}

/**
 * @returns {{ aplicados: string[], fallidos: string[], manuales: object[] }}
 */
export function arreglar(reporte, { log, sudoPermitido = true }) {
  const dir = reporte.proyecto.ruta;
  const auto = reporte.problemas.filter((p) => p.arreglo?.automatico);
  const manuales = reporte.problemas.filter((p) => p.arreglo && !p.arreglo.automatico);
  auto.sort((a, b) => (PRIORIDAD[a.arreglo.accion] ?? 9) - (PRIORIDAD[b.arreglo.accion] ?? 9)
    || (PRIMERO.includes(b.arreglo.id) - PRIMERO.includes(a.arreglo.id)));

  const aplicados = []; const fallidos = [];
  const hechos = new Set();
  for (const p of auto) {
    const a = p.arreglo;
    const clave = `${a.accion}:${a.texto}`;
    if (hechos.has(clave)) continue;
    hechos.add(clave);
    log.paso(p.mensaje);
    let ok = false;
    switch (a.accion) {
      case 'herramienta': {
        const como = H.comoInstalar(a.id);
        if (como?.sudo) {
          if (!sudoPermitido) { log.aviso(`Se salta: necesita permisos de administrador (${como.sudo}).`); fallidos.push(p.codigo); continue; }
          log.aviso(`Se pedirá tu contraseña de administrador. Motivo: ${como.sudo}.`);
          if (!ES_WIN && !process.env.CI) ejecutar('sudo', ['apt-get', 'update', '-y'], { log });
        }
        if (como?.cmd === 'winget' || como?.cmd === 'brew') log.info(como.cmd === 'winget' ? 'Si Windows muestra un aviso de permisos (UAC), acéptalo: es el instalador oficial.' : 'Homebrew no necesita contraseña.');
        ok = como ? ejecutar(como.cmd, como.args, { cwd: dir, log }) : false;
        if (ok && como?.nota) log.info(como.nota);
        break;
      }
      case 'node': {
        if (!H.detectar('fnm').instalado) {
          const fnm = H.comoInstalar('fnm');
          if (!fnm || !ejecutar(fnm.cmd, fnm.args, { log })) { fallidos.push(p.codigo); continue; }
          refrescarPath();
        }
        ok = a.version === 'lts'
          ? ejecutar('fnm', ['install', '--lts'], { log }) && ejecutar('fnm', ['default', 'lts-latest'], { log })
          : ejecutar('fnm', ['install', a.version], { log });
        if (ok && a.version !== 'lts') log.info(`Node ${a.version} instalado. Al entrar a esta carpeta en una terminal nueva, fnm lo activa solo (o ejecuta: fnm use ${a.version}).`);
        break;
      }
      case 'instalar-node': ok = enShell(a.texto, dir, log); break;
      case 'instalar-python': case 'sie-python': ok = enShell(a.texto, dir, log); break;
      case 'copiar-env': ok = copiarEnv(dir, reporte.proyecto.entorno.ejemplo, log); break;
      case 'completar-env': ok = completarEnv(dir, reporte.proyecto.entorno.ejemplo, log); break;
      case 'sie-npm': ok = ejecutar('npm', ['install', '--no-audit', '--no-fund'], { cwd: SIE_DIR, log }); break;
      case 'playwright': {
        const cwd = reporte.modo === 'sistema' ? SIE_DIR : dir;
        if (process.platform === 'linux') {
          if (!sudoPermitido) { log.aviso('Se salta install-deps: necesita sudo.'); }
          else { log.aviso('Se pedirá tu contraseña: Chromium necesita librerías del sistema (apt).'); ejecutar('sudo', ['env', `PATH=${process.env.PATH}`, 'npx', 'playwright', 'install-deps', 'chromium'], { cwd, log }); }
        }
        ok = ejecutar('npx', ['playwright', 'install', 'chromium'], { cwd, log });
        break;
      }
      case 'modelo': ok = descargarModelo(log); break;
      default: log.aviso(`Acción desconocida: ${a.accion}`);
    }
    refrescarPath();
    (ok ? aplicados : fallidos).push(p.codigo);
    if (ok) log.ok('Listo'); else log.error('No se pudo arreglar automáticamente.');
  }
  return { aplicados, fallidos, manuales };
}
