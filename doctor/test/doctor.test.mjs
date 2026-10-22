// node --test doctor/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cumple, extraerVersion, versionParaInstalar } from '../lib/semver.mjs';
import { analizarProyecto, leerRequirements } from '../lib/proyecto.mjs';
import { diagnosticar } from '../lib/diagnostico.mjs';
import { arreglar } from '../lib/arreglar.mjs';
import { textoSoporte } from '../lib/salida.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(AQUI, 'fixtures');
const BIN = path.join(AQUI, '..', 'bin', 'ecomdrop-doctor.mjs');
const silencio = { paso() {}, comando() {}, info() {}, ok() {}, aviso() {}, error() {} };

// Equipo ficticio: lo que «está instalado» en las pruebas, sin depender de la máquina.
const equipo = (versiones) => (id) => ({ id, nombre: id, instalado: id in versiones, version: versiones[id] ?? null, ruta: id in versiones ? `/bin/${id}` : null });

test('semver: rangos de engines, .nvmrc y requires-python', () => {
  assert.ok(cumple('22.11.0', '>=20 <23'));
  assert.ok(!cumple('23.0.0', '>=20 <23'));
  assert.ok(cumple('22.3.1', '^22.1'));
  assert.ok(!cumple('23.1.0', '^22.1'));
  assert.ok(cumple('3.12.4', '~3.12'));
  assert.ok(!cumple('3.13.0', '~3.12'));
  assert.ok(cumple('18.20.0', '^16 || ^18'));
  assert.ok(cumple('22.0.0', '22'));
  assert.ok(cumple('22.9.0', '22.x'));
  assert.ok(cumple('20.0.0', '18 - 20'));
  assert.ok(cumple('3.11.2', '>=3.11'));
  assert.ok(cumple('24.1.0', 'lts/*'));
  assert.ok(cumple('1.0.0', 'algo-que-no-se-entiende'), 'un rango ilegible no bloquea');
  assert.equal(extraerVersion('git version 2.54.0'), '2.54.0');
  assert.equal(extraerVersion('Python 3.14.4'), '3.14.4');
  assert.equal(versionParaInstalar('v22.11.0'), '22.11.0');
  assert.equal(versionParaInstalar('lts/*'), 'lts');
  assert.equal(versionParaInstalar('>=20 <23'), '20');
});

test('lee requirements.txt con extras, comentarios, opciones y marcadores', () => {
  assert.deepEqual(leerRequirements('requests>=2.31  # http\nPillow[avif]>=10\n-r otros.txt\nopenpyxl==3.1.5 ; python_version >= "3.9"\ngit+https://x/y.git\n').map((d) => d.nombre),
    ['requests', 'Pillow', 'openpyxl']);
});

test('detecta Node, Python, Docker, .env y sus requisitos', () => {
  const p = analizarProyecto(path.join(FIX, 'completo'));
  assert.deepEqual(p.tipos, ['node', 'python', 'docker']);
  assert.equal(p.node.gestor, 'pnpm');
  assert.equal(p.node.gestorVersion, '9.12.0');
  assert.equal(p.node.versionArchivo.valor, '22');
  assert.equal(p.node.engines, '>=20 <23');
  assert.deepEqual(p.node.nativas, ['sharp']);
  assert.ok(p.node.usaPlaywright);
  assert.equal(p.python.requiresPython, '>=3.11');
  assert.deepEqual(p.python.pyproject.dependencias.map((d) => d.nombre), ['pandas', 'httpx']);
  assert.deepEqual(p.docker.servicios, ['api', 'db']);
  assert.deepEqual(p.docker.envFiles, ['.env.docker']);
  assert.deepEqual(p.entorno.faltan, ['SHOPIFY_TOKEN']);
  assert.deepEqual(p.entorno.vacias, ['KIE_API_KEY']);
});

test('diagnóstico: compara lo requerido con lo instalado', () => {
  const r = diagnosticar(path.join(FIX, 'completo'), { detectar: equipo({ git: '2.54.0', node: '25.9.0', npm: '11.0.0', python: '3.10.4', docker: '29.0.0' }) });
  const h = Object.fromEntries(r.herramientas.map((x) => [x.id, x]));
  assert.equal(h.node.estado, 'version', 'Node 25 no cumple .nvmrc 22');
  assert.equal(h.node.requiere, '22');
  assert.equal(h.node.arreglo.texto, 'fnm install 22 && fnm use 22');
  assert.equal(h.pnpm.estado, 'falta');
  assert.equal(h.python.estado, 'version', 'Python 3.10 no cumple >=3.11');
  assert.equal(h.uv.estado, 'opcional');
  assert.equal(h.compose.estado, 'falta');
  const codigos = r.problemas.map((p) => p.codigo);
  for (const c of ['dependencias-node', 'dependencias-nativas', 'env-incompleto', 'env-vacias', 'env-file-compose', 'version-node', 'falta-pnpm']) assert.ok(codigos.includes(c), c);
  assert.equal(r.problemas.find((p) => p.codigo === 'dependencias-node').arreglo.texto, 'pnpm install --frozen-lockfile');
  assert.equal(r.resumen.listo, false);
  assert.ok(r.resumen.automaticos > 0 && r.resumen.manuales > 0);
  JSON.parse(JSON.stringify(r)); // serializable
});

test('diagnóstico: señala el conflicto entre .nvmrc y engines (lo resuelve la skill)', () => {
  const r = diagnosticar(path.join(FIX, 'conflicto'), { detectar: equipo({ git: '2.5', node: '22.11.0', npm: '10' }) });
  const c = r.problemas.find((p) => p.codigo === 'conflicto-version-node');
  assert.ok(c);
  assert.equal(c.arreglo.automatico, false);
});

test('diagnóstico de una tienda del SIE: herramientas de video, tienda.json de ejemplo y clave', () => {
  const r = diagnosticar(path.join(FIX, 'tienda'), { detectar: equipo({ git: '2.5', node: '24.1.0', python: '3.12.0', ffmpeg: '8.1' }), plataforma: 'linux' });
  assert.ok(r.proyecto.tipos.includes('sie'));
  const faltan = r.herramientas.filter((h) => h.estado === 'falta').map((h) => h.id);
  assert.deepEqual(faltan.sort(), ['curl', 'ffprobe', 'imagemagick', 'whisper'].sort());
  assert.ok(r.problemas.some((p) => p.codigo === 'tienda-json-ejemplo'));
  assert.ok(r.problemas.some((p) => p.codigo === 'env-falta'));
});

test('--fix: crea y completa el .env sin inventar valores', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-'));
  fs.writeFileSync(path.join(tmp, '.env.example'), 'A=\nB=valor-de-ejemplo\n');
  const det = equipo({ git: '2.5' });
  let r = diagnosticar(tmp, { detectar: det });
  arreglar(r, { log: silencio });
  assert.equal(fs.readFileSync(path.join(tmp, '.env'), 'utf8'), 'A=\nB=valor-de-ejemplo\n');
  fs.writeFileSync(path.join(tmp, '.env.example'), 'A=\nB=valor-de-ejemplo\nC=\n');
  r = diagnosticar(tmp, { detectar: det });
  arreglar(r, { log: silencio });
  assert.match(fs.readFileSync(path.join(tmp, '.env'), 'utf8'), /\nC=\n$/);
  assert.equal(diagnosticar(tmp, { detectar: det }).problemas.filter((p) => p.severidad === 'error').length, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('--report: no incluye valores del .env ni la carpeta personal', () => {
  const tmp = fs.mkdtempSync(path.join(os.homedir(), '.doctor-prueba-'));
  fs.writeFileSync(path.join(tmp, '.env.example'), 'SHOPIFY_TOKEN=\n');
  fs.writeFileSync(path.join(tmp, '.env'), 'SHOPIFY_TOKEN=shpat_supersecreto123\n');
  const texto = textoSoporte(diagnosticar(tmp, { detectar: equipo({ git: '2.5' }) }));
  assert.ok(!texto.includes('shpat_supersecreto123'));
  assert.ok(!texto.includes(os.homedir()));
  assert.ok(texto.includes('~/.doctor-prueba-'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('CLI: guarda el JSON en .ecomdrop/ (ignorado por git) y devuelve código 1 si hay errores', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-cli-'));
  fs.writeFileSync(path.join(tmp, '.env.example'), 'X=\n');
  const r = spawnSync(process.execPath, [BIN, tmp], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /No hay \.env/);
  const json = JSON.parse(fs.readFileSync(path.join(tmp, '.ecomdrop', 'doctor-report.json'), 'utf8'));
  assert.equal(json.modo, 'proyecto');
  assert.equal(fs.readFileSync(path.join(tmp, '.ecomdrop', '.gitignore'), 'utf8'), '*\n');
  const fix = spawnSync(process.execPath, [BIN, tmp, '--fix'], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.equal(fix.status, 0, fix.stdout);
  assert.equal(spawnSync(process.execPath, [BIN, '--opcion-rara'], { encoding: 'utf8' }).status, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});
