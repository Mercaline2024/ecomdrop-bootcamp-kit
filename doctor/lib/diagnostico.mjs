// Compara lo que el proyecto (o el equipo del estudiante) necesita con lo que hay instalado.
// Devuelve un reporte serializable a JSON: es lo que lee la skill /setup-proyecto.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as H from './herramientas.mjs';
import { analizarProyecto } from './proyecto.mjs';
import { cumple, versionParaInstalar } from './semver.mjs';

export const VERSION_DOCTOR = '1.0.0';
const HOME = os.homedir();
const ECOMDROP_HOME = process.env.ECOMDROP_HOME || path.join(HOME, '.ecomdrop');
const PROYECTOS = process.env.ECOMDROP_PROYECTOS || path.join(HOME, 'proyectos');
const SIE_DIR = path.join(PROYECTOS, 'super-inteligencia-ecommerce');
const MODELO = process.env.WHISPER_MODEL || path.join(HOME, 'whisper-models', 'ggml-large-v3-turbo.bin');

/**
 * @param {string} dir carpeta del proyecto
 * @param {{ sistema?: boolean, detectar?: (id: string) => any, plataforma?: string }} op
 *   sistema: revisa el equipo del estudiante (SIE instalado, modelo, Claude Code) en vez de un proyecto.
 *   detectar / plataforma: inyectables para las pruebas.
 */
export function diagnosticar(dir, op = {}) {
  const plataforma = op.plataforma ?? H.PLATAFORMA;
  const detectar = op.detectar ?? H.detectar;
  const cache = new Map();
  const tool = (id) => { if (!cache.has(id)) cache.set(id, detectar(id)); return cache.get(id); };

  const proyecto = op.sistema ? { ruta: dir, tipos: ['sistema'], archivos: [] } : analizarProyecto(dir);
  const requeridas = new Map(); // id → { nivel: 'requerido'|'recomendado', rango, motivo }
  const problemas = [];
  const pedir = (id, nivel, motivo, rango = null) => {
    const previo = requeridas.get(id);
    if (!previo || (previo.nivel === 'recomendado' && nivel === 'requerido')) requeridas.set(id, { nivel, motivo, rango: rango ?? previo?.rango ?? null });
    else if (rango && !previo.rango) previo.rango = rango;
  };
  const problema = (severidad, codigo, mensaje, arreglo = null) => problemas.push({ severidad, codigo, mensaje, arreglo });

  pedir('git', 'requerido', 'control de versiones');

  // ── Node ──
  const n = proyecto.node;
  if (n) {
    if (!n.valido) problema('error', 'package-json-invalido', 'package.json no es JSON válido.');
    const rango = n.versionArchivo?.valor ?? n.engines ?? null;
    pedir('node', 'requerido', n.versionArchivo ? `lo fija ${n.versionArchivo.archivo}` : n.engines ? 'lo pide engines.node' : 'el proyecto usa Node', rango);
    pedir(n.gestor, 'requerido', n.lockfile ? `el proyecto tiene ${n.lockfile}` : `packageManager: ${n.gestor}`, n.gestorVersion);
    if (n.versionArchivo && n.engines) {
      // conflicto entre .nvmrc y engines: lo resuelve la skill, el doctor solo lo señala
      const v = versionParaInstalar(n.versionArchivo.valor);
      if (v !== 'lts' && !cumple(v, n.engines)) {
        problema('error', 'conflicto-version-node', `${n.versionArchivo.archivo} pide Node ${n.versionArchivo.valor}, pero engines.node pide ${n.engines}.`, { automatico: false, instruccion: 'Decide cuál manda y alinea los dos archivos.' });
      }
    }
    const faltanDeps = n.dependencias.filter((d) => !n.instaladas.includes(d));
    if (n.dependencias.length && faltanDeps.length) {
      problema('error', 'dependencias-node', `${faltanDeps.length === 1 ? 'Falta' : 'Faltan'} ${faltanDeps.length} de ${n.dependencias.length} ${n.dependencias.length === 1 ? 'dependencia' : 'dependencias'} de Node${faltanDeps.length <= 5 ? ` (${faltanDeps.join(', ')})` : ''}.`, {
        automatico: true, accion: 'instalar-node', texto: comandoInstalarNode(n),
      });
    }
    if (n.nativas.length) {
      problema('aviso', 'dependencias-nativas', `Dependencias nativas: ${n.nativas.join(', ')}. Si fallan al instalar necesitan herramientas de compilación.`, {
        automatico: false,
        instruccion: plataforma === 'mac' ? 'xcode-select --install' : plataforma === 'win' ? 'winget install Microsoft.VisualStudio.2022.BuildTools (con «Desarrollo para el escritorio con C++»)' : 'sudo apt-get install -y build-essential python3',
      });
    }
    if (n.usaPlaywright && !H.chromiumPlaywright().length && !op.detectar) {
      problema('error', 'playwright-chromium', 'El proyecto usa Playwright pero Chromium no está descargado.', { automatico: true, accion: 'playwright', texto: 'npx playwright install chromium' });
    }
  }

  // ── Python ──
  const py = proyecto.python;
  if (py) {
    pedir('python', 'requerido', 'requirements.txt / pyproject.toml', py.requiresPython);
    pedir('uv', 'recomendado', 'instala las dependencias de Python rápido y sin tocar el sistema');
    const declaradas = [...py.requirements, ...(py.pyproject?.dependencias ?? [])];
    if (declaradas.length && !op.detectar) {
      const interprete = py.venv ? path.join(dir, py.venv, plataforma === 'win' ? 'Scripts/python.exe' : 'bin/python') : (tool('python').comando ?? 'python3');
      const instalados = H.paquetesPython(interprete);
      if (instalados) {
        const faltan = declaradas.filter((d) => !instalados.has(H.normalizarPaquete(d.nombre)));
        if (faltan.length) {
          problema('error', 'dependencias-python', `Faltan ${faltan.length} paquetes de Python en ${py.venv ? py.venv : 'el Python del sistema'}: ${faltan.map((f) => f.nombre).join(', ')}.`, {
            automatico: true, accion: 'instalar-python', texto: comandoInstalarPython(py, interprete, Boolean(proyecto.sie)),
          });
        }
      }
    }
  }

  // ── Docker ──
  const dk = proyecto.docker;
  if (dk) {
    pedir('docker', 'requerido', dk.compose ? `el proyecto tiene ${dk.compose}` : 'el proyecto tiene Dockerfile');
    if (dk.compose) pedir('compose', 'requerido', `servicios: ${dk.servicios.join(', ') || '—'}`);
    if (!op.detectar && tool('docker').instalado && !H.dockerCorriendo()) {
      problema('aviso', 'docker-detenido', 'Docker está instalado pero el motor no está corriendo.', { automatico: false, instruccion: plataforma === 'linux' ? 'sudo systemctl start docker' : 'Abre Docker Desktop y espera a que diga «Running».' });
    }
    for (const f of dk.envFiles ?? []) {
      if (!fs.existsSync(path.join(dir, f))) problema('error', 'env-file-compose', `docker-compose usa env_file «${f}», que no existe.`, { automatico: false, instruccion: `Crea ${f} (puedes partir de .env.example).` });
    }
  }

  // ── Variables de entorno ──
  const env = proyecto.entorno;
  if (env) {
    if (!env.archivo) {
      problema('error', 'env-falta', `No hay .env. El proyecto declara ${env.declaradas.length} variables en ${env.ejemplo}.`, { automatico: true, accion: 'copiar-env', texto: `copiar ${env.ejemplo} → .env` });
    } else if (env.faltan.length) {
      problema('error', 'env-incompleto', `A .env le faltan ${env.faltan.length} variables: ${env.faltan.join(', ')}.`, { automatico: true, accion: 'completar-env', texto: `añadir las claves que faltan desde ${env.ejemplo} (vacías)` });
    }
    if (env.vacias.length) {
      problema('aviso', 'env-vacias', `Variables sin valor en .env: ${env.vacias.join(', ')}.`, { automatico: false, instruccion: 'Escribe sus valores (las claves no se inventan: pídeselas al estudiante o al servicio).' });
    }
  }

  // ── SIE (tienda o equipo del estudiante) ──
  const esSie = proyecto.sie || op.sistema;
  if (esSie) {
    const motivo = 'lo usan las skills del SIE';
    for (const id of ['node', 'python', 'ffmpeg', 'ffprobe', 'whisper', 'curl']) pedir(id, 'requerido', motivo);
    pedir(plataforma === 'mac' ? 'sips' : 'imagemagick', 'requerido', 'procesar imágenes');
    for (const id of ['gh', 'shopify', 'claude', 'uv']) pedir(id, 'recomendado', motivo);
    if (!op.detectar && tool('python').instalado) {
      const libs = H.paquetesPython(tool('python').comando ?? 'python3');
      const faltan = libs ? ['Pillow', 'openpyxl'].filter((l) => !libs.has(H.normalizarPaquete(l))) : [];
      if (faltan.length) {
        problema('error', 'sie-python', `${faltan.length > 1 ? 'Faltan' : 'Falta'} ${faltan.join(' y ')} en el Python del sistema (${faltan.length > 1 ? 'los usan' : 'lo usan'} los scripts del SIE).`, {
          automatico: true, accion: 'sie-python', texto: `uv pip install --python ${tool('python').comando ?? 'python3'} --break-system-packages ${faltan.map((f) => `"${f}"`).join(' ')}`,
        });
      }
    }
    if (!op.detectar && !fs.existsSync(MODELO)) {
      problema(process.env.ECOMDROP_SALTAR_MODELO === '1' ? 'aviso' : 'error', 'modelo-whisper', `Falta el modelo de transcripción (${MODELO.replace(HOME, '~')}).`, { automatico: true, accion: 'modelo', texto: 'descargar ggml-large-v3-turbo.bin (~1,6 GB)' });
    }
  }
  if (proyecto.sie?.rol === 'tienda') {
    const t = proyecto.sie.tienda;
    if (!t) problema('aviso', 'tienda-json-falta', 'No hay tienda.json en esta carpeta.', { automatico: false, instruccion: 'Abre Claude aquí y di «da de alta esta tienda».' });
    else if (!t.valido) problema('error', 'tienda-json-invalido', 'tienda.json no es JSON válido.', { automatico: false, instruccion: 'Corrige el JSON (una coma o comilla de más).' });
    else if (t.esEjemplo) problema('aviso', 'tienda-json-ejemplo', 'tienda.json sigue con los datos de ejemplo (Mi Tienda).', { automatico: false, instruccion: 'Di a Claude «da de alta esta tienda» para rellenarlo.' });
    if (!proyecto.sie.kieKey && !env) problema('error', 'kie-key', 'Falta KIE_API_KEY en .env.', { automatico: false, instruccion: 'Pégala en el .env de la tienda (o en el asistente de instalación, pestaña Claves).' });
  }
  if (op.sistema) {
    const sieOk = fs.existsSync(path.join(SIE_DIR, 'tienda.ejemplo.json'));
    if (!sieOk) problema('error', 'sie-falta', `El SIE no está instalado en ${SIE_DIR.replace(HOME, '~')}.`, { automatico: false, instruccion: 'Ejecuta el paso «Instalar el SIE» del asistente (necesitas acceso en GitHub).' });
    // solo se revisa lo que el SIE declara en su package.json
    let depsSie = [];
    try { const pk = JSON.parse(fs.readFileSync(path.join(SIE_DIR, 'package.json'), 'utf8')); depsSie = Object.keys({ ...pk.dependencies, ...pk.devDependencies }); } catch { /* sin package.json */ }
    if (sieOk) {
      const faltan = depsSie.filter((d) => !fs.existsSync(path.join(SIE_DIR, 'node_modules', d, 'package.json')));
      if (faltan.length) problema('error', 'sie-dependencias', `Faltan dependencias de Node del SIE: ${faltan.join(', ')}.`, { automatico: true, accion: 'sie-npm', texto: `npm install (en ${SIE_DIR.replace(HOME, '~')})` });
    }
    if (!op.detectar && depsSie.includes('playwright') && !H.chromiumPlaywright().length) problema('error', 'playwright-chromium', 'Chromium de Playwright no está descargado.', { automatico: true, accion: 'playwright', texto: 'npx playwright install chromium' });
    const envGlobal = path.join(ECOMDROP_HOME, '.env');
    const kie = fs.existsSync(envGlobal) && /^KIE_API_KEY=.+$/m.test(fs.readFileSync(envGlobal, 'utf8'));
    if (!kie) problema('aviso', 'kie-key-global', 'KIE_API_KEY no está guardada en el kit.', { automatico: false, instruccion: 'Agrégala en el asistente (pestaña Claves) o en el .env de cada tienda.' });
    const settings = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude'), 'settings.json');
    if (!fs.existsSync(settings) || !/guardia[\\/]+guardia\.mjs/.test(fs.readFileSync(settings, 'utf8'))) {
      problema('aviso', 'claude-config', 'La configuración del kit no está aplicada en Claude Code (permisos y guardia).', { automatico: false, instruccion: 'Ejecuta el paso «Configurar Claude Code» del asistente.' });
    }
  }

  // ── Herramientas: requerido vs instalado ──
  const herramientas = [...requeridas.entries()].map(([id, req]) => {
    const t = tool(id);
    let estado = t.instalado ? 'ok' : req.nivel === 'requerido' ? 'falta' : 'opcional';
    if (t.instalado && req.rango && t.version && !cumple(t.version, req.rango)) estado = 'version';
    const arreglo = estado === 'ok' ? null : arregloHerramienta(id, req, plataforma);
    return { id, nombre: t.nombre, nivel: req.nivel, motivo: req.motivo, requiere: req.rango, instalado: t.instalado, version: t.version, ruta: t.ruta, estado, arreglo };
  });

  for (const h of herramientas) {
    if (h.estado === 'falta') problema('error', `falta-${h.id}`, `Falta ${h.nombre} (${h.motivo}).`, h.arreglo);
    if (h.estado === 'version') problema('error', `version-${h.id}`, `${h.nombre} ${h.version} no cumple ${h.requiere} (${h.motivo}).`, h.arreglo);
  }

  const errores = problemas.filter((p) => p.severidad === 'error').length;
  return {
    doctor: VERSION_DOCTOR,
    generado: new Date().toISOString(),
    modo: op.sistema ? 'sistema' : 'proyecto',
    sistema: { plataforma, so: process.platform, arquitectura: process.arch, version: os.release(), node: process.version },
    proyecto: { ruta: dir, tipos: proyecto.tipos, archivos: proyecto.archivos, node: proyecto.node ?? null, python: proyecto.python ?? null, docker: proyecto.docker ?? null, entorno: proyecto.entorno ?? null, sie: proyecto.sie ?? null },
    herramientas,
    problemas,
    resumen: {
      errores,
      avisos: problemas.filter((p) => p.severidad === 'aviso').length,
      automaticos: problemas.filter((p) => p.arreglo?.automatico).length,
      manuales: problemas.filter((p) => p.arreglo && !p.arreglo.automatico).length,
      listo: errores === 0,
    },
  };
}

function arregloHerramienta(id, req, plataforma) {
  if (id === 'node') {
    const v = versionParaInstalar(req.rango);
    return { automatico: true, accion: 'node', version: v, texto: v === 'lts' ? 'fnm install --lts && fnm default lts-latest' : `fnm install ${v} && fnm use ${v}` };
  }
  if (id === 'npm') return { automatico: false, instruccion: 'npm viene con Node: reinstala Node con fnm.' };
  if (id === 'sips') return { automatico: false, instruccion: 'sips viene con macOS.' };
  const como = plataforma === H.PLATAFORMA ? H.comoInstalar(id) : null;
  if (!como) return { automatico: false, instruccion: 'Instálalo manualmente o vuelve a ejecutar el instalador del bootcamp.' };
  return como.automatico ? { automatico: true, accion: 'herramienta', id, texto: como.texto, sudo: como.sudo, nota: como.nota } : { automatico: false, instruccion: como.instruccion };
}

function comandoInstalarNode(n) {
  if (n.gestor === 'pnpm') return n.lockfile ? 'pnpm install --frozen-lockfile' : 'pnpm install';
  if (n.gestor === 'yarn') return 'yarn install';
  if (n.gestor === 'bun') return 'bun install';
  return n.lockfile === 'package-lock.json' || n.lockfile === 'npm-shrinkwrap.json' ? 'npm ci' : 'npm install';
}

function comandoInstalarPython(py, interprete, esSie) {
  // los scripts del SIE llaman a python3 del sistema: ahí van sus librerías, no a un .venv
  if (esSie && !py.venv) return `uv pip install --python ${interprete} --break-system-packages -r requirements.txt`;
  if (py.pyproject && py.uvLock) return 'uv sync';
  if (py.venv) return `uv pip install --python ${interprete} -r requirements.txt`;
  if (py.pyproject) return 'uv sync';
  return 'uv venv && uv pip install -r requirements.txt';
}
