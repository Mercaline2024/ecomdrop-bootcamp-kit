#!/usr/bin/env node
// ecomdrop-doctor: revisa un proyecto (o el equipo) y dice qué falta para que funcione.
//
//   ecomdrop-doctor [carpeta]        tabla en consola + reporte JSON en <carpeta>/.ecomdrop/doctor-report.json
//   ecomdrop-doctor --fix            instala lo que falta (pide confirmación de sudo/UAC solo si hace falta)
//   ecomdrop-doctor --report         texto para copiar y enviar a soporte
//   ecomdrop-doctor --json           el reporte JSON por la salida estándar
//   ecomdrop-doctor --sistema        revisa el equipo del estudiante (SIE, modelo, Claude Code) en vez de un proyecto
//   ecomdrop-doctor --sin-sudo       con --fix: no ejecuta nada que necesite permisos de administrador
//
// Código de salida: 0 si no hay errores, 1 si los hay, 2 si los argumentos son inválidos.
import fs from 'node:fs';
import path from 'node:path';

import { arreglar } from '../lib/arreglar.mjs';
import { diagnosticar, VERSION_DOCTOR } from '../lib/diagnostico.mjs';
import { imprimirReporte, log, negrita, textoSoporte } from '../lib/salida.mjs';

const args = process.argv.slice(2);
const banderas = new Set(args.filter((a) => a.startsWith('-')));
const conocidas = new Set(['--fix', '--report', '--json', '--sistema', '--sin-sudo', '--no-guardar', '-h', '--help', '-v', '--version']);
const desconocidas = [...banderas].filter((b) => !conocidas.has(b));

if (banderas.has('-h') || banderas.has('--help')) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
if (banderas.has('-v') || banderas.has('--version')) { console.log(VERSION_DOCTOR); process.exit(0); }
if (desconocidas.length) { console.error(`Opción desconocida: ${desconocidas.join(' ')}. Usa --help.`); process.exit(2); }

const carpeta = path.resolve(args.find((a) => !a.startsWith('-')) ?? process.cwd());
if (!fs.existsSync(carpeta) || !fs.statSync(carpeta).isDirectory()) { console.error(`No existe la carpeta: ${carpeta}`); process.exit(2); }

const sistema = banderas.has('--sistema');
const guardarJson = (r) => {
  if (banderas.has('--no-guardar')) return null;
  const dir = sistema ? path.join(process.env.ECOMDROP_HOME || path.join(process.env.HOME || process.env.USERPROFILE, '.ecomdrop')) : path.join(carpeta, '.ecomdrop');
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (!sistema && !fs.existsSync(path.join(dir, '.gitignore'))) fs.writeFileSync(path.join(dir, '.gitignore'), '*\n'); // nunca se sube a git
    const ruta = path.join(dir, 'doctor-report.json');
    fs.writeFileSync(ruta, JSON.stringify(r, null, 2) + '\n');
    return ruta;
  } catch { return null; }
};

let reporte = diagnosticar(carpeta, { sistema });

if (banderas.has('--fix')) {
  if (!reporte.problemas.some((p) => p.arreglo?.automatico)) {
    console.log('\nNo hay nada que se pueda arreglar automáticamente.');
  } else {
    console.log(`\n${negrita('Aplicando arreglos automáticos…')}`);
    const r = arreglar(reporte, { log, sudoPermitido: !banderas.has('--sin-sudo') });
    console.log(`\n${negrita('Resultado:')} ${r.aplicados.length} aplicados, ${r.fallidos.length} fallidos.`);
    reporte = diagnosticar(carpeta, { sistema }); // se vuelve a revisar con lo recién instalado
  }
}

const rutaJson = guardarJson(reporte);
if (banderas.has('--json')) console.log(JSON.stringify(reporte, null, 2));
else if (banderas.has('--report')) console.log(`\n${textoSoporte(reporte)}\n\nCopia todo el bloque de arriba y pégalo en el chat de soporte del bootcamp.\n`);
else imprimirReporte(reporte, { rutaJson });

process.exit(reporte.resumen.errores ? 1 : 0);
