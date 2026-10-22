// Presentación: tabla en consola, texto para soporte y registro de --fix.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (cod) => (t) => (color ? `\x1b[${cod}m${t}\x1b[0m` : String(t));
export const verde = c('32'); export const rojo = c('31'); export const amarillo = c('33'); export const azul = c('34');
export const gris = c('90'); export const negrita = c('1');

const HOME = os.homedir();
export const ocultarHome = (t) => String(t ?? '').split(HOME).join('~');

const ancho = (t) => [...String(t).replace(/\x1b\[[0-9;]*m/g, '')].length;
const rellenar = (t, n) => String(t) + ' '.repeat(Math.max(0, n - ancho(t)));

function tabla(filas, cabecera) {
  const anchos = cabecera.map((_, i) => Math.max(ancho(cabecera[i]), ...filas.map((f) => ancho(f[i]))));
  const linea = (f) => `  ${f.map((x, i) => rellenar(x, anchos[i])).join('  ')}`;
  return [linea(cabecera.map((h) => negrita(h))), `  ${anchos.map((a) => gris('─'.repeat(a))).join('  ')}`, ...filas.map(linea)].join('\n');
}

const ESTADO = {
  ok: () => verde('✔ ok'),
  falta: () => rojo('✖ falta'),
  version: () => rojo('✖ versión'),
  opcional: () => amarillo('○ recomendado'),
};

const NOMBRE_SO = { mac: 'macOS', win: 'Windows', linux: 'Linux' };

export function imprimirReporte(r, { rutaJson } = {}) {
  const out = [];
  out.push('');
  out.push(`${negrita('ecomdrop-doctor')} ${gris(`v${r.doctor}`)} · ${NOMBRE_SO[r.sistema.plataforma] ?? r.sistema.plataforma} ${r.sistema.arquitectura}`);
  out.push(r.modo === 'sistema' ? gris('Revisión del equipo del estudiante') : `${gris('Proyecto:')} ${ocultarHome(r.proyecto.ruta)}  ${gris(`[${r.proyecto.tipos.join(', ') || 'sin archivos reconocidos'}]`)}`);
  out.push('');
  out.push(tabla(
    r.herramientas.map((h) => [h.nombre, h.requiere ?? (h.nivel === 'recomendado' ? gris('opcional') : '—'), h.version ?? gris('—'), ESTADO[h.estado]()]),
    ['Herramienta', 'Requiere', 'Instalado', 'Estado'],
  ));
  if (r.problemas.length) {
    out.push('');
    out.push(negrita('Problemas'));
    for (const p of r.problemas) {
      const marca = p.severidad === 'error' ? rojo('✖') : amarillo('!');
      out.push(`  ${marca} ${p.mensaje}`);
      if (p.arreglo?.automatico) out.push(`    ${azul('→ --fix:')} ${gris(p.arreglo.texto)}`);
      else if (p.arreglo?.instruccion) out.push(`    ${gris('→ ' + p.arreglo.instruccion)}`);
    }
  }
  out.push('');
  const { errores, avisos, automaticos } = r.resumen;
  if (r.resumen.listo) out.push(verde(negrita(`✔ Todo listo${avisos ? ` (${avisos} aviso${avisos > 1 ? 's' : ''})` : ''}.`)));
  else out.push(`${rojo(negrita(`✖ ${errores} problema${errores > 1 ? 's' : ''} por resolver`))}${avisos ? `, ${avisos} aviso${avisos > 1 ? 's' : ''}` : ''}.${automaticos ? ` ${azul(`ecomdrop-doctor --fix`)} arregla ${automaticos} automáticamente.` : ''}`);
  if (rutaJson) out.push(gris(`Reporte JSON: ${ocultarHome(rutaJson)}`));
  out.push('');
  console.log(out.join('\n'));
}

/** Texto plano para pegar en el chat de soporte: sin claves ni valores del .env, rutas con ~. */
export function textoSoporte(r) {
  const sie = path.join(process.env.ECOMDROP_PROYECTOS || path.join(HOME, 'proyectos'), 'super-inteligencia-ecommerce', '.instalacion.json');
  let instalacion = '—';
  try { instalacion = JSON.parse(fs.readFileSync(sie, 'utf8')).id ?? '—'; } catch { /* sin SIE */ }
  const l = [];
  l.push('=== Reporte para soporte · Ecomdrop Bootcamp Kit ===');
  l.push(`Fecha: ${r.generado}`);
  l.push(`Doctor: v${r.doctor} · modo ${r.modo}`);
  l.push(`Sistema: ${NOMBRE_SO[r.sistema.plataforma] ?? r.sistema.so} ${r.sistema.version} (${r.sistema.arquitectura}) · Node que corre el doctor ${r.sistema.node}`);
  l.push(`Instalación SIE: ${instalacion}`);
  if (r.modo === 'proyecto') l.push(`Proyecto: ${ocultarHome(r.proyecto.ruta)} [${r.proyecto.tipos.join(', ')}] · archivos: ${r.proyecto.archivos.join(', ') || '—'}`);
  l.push('');
  l.push('Herramientas:');
  for (const h of r.herramientas) l.push(`- ${h.nombre}: ${h.version ?? 'no instalado'}${h.requiere ? ` (requiere ${h.requiere})` : ''} → ${h.estado}`);
  l.push('');
  const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  l.push(`Problemas (${pl(r.resumen.errores, 'error', 'errores')}, ${pl(r.resumen.avisos, 'aviso', 'avisos')}):`);
  if (!r.problemas.length) l.push('- ninguno');
  for (const p of r.problemas) l.push(`- [${p.severidad}] ${p.codigo}: ${ocultarHome(p.mensaje)}`);
  if (r.proyecto.entorno) {
    l.push('');
    l.push(`Variables (.env): ${r.proyecto.entorno.declaradas.length} declaradas · faltan: ${r.proyecto.entorno.faltan.join(', ') || '—'} · vacías: ${r.proyecto.entorno.vacias.join(', ') || '—'} (los valores nunca se incluyen)`);
  }
  l.push('=== fin del reporte ===');
  return l.join('\n');
}

export const log = {
  paso: (t) => console.log(`\n${azul('━━')} ${negrita(t)}`),
  comando: (t) => console.log(gris(`  $ ${ocultarHome(t)}`)),
  info: (t) => console.log(`  ${azul('→')} ${t}`),
  ok: (t) => console.log(`  ${verde('✔')} ${t}`),
  aviso: (t) => console.log(`  ${amarillo('!')} ${t}`),
  error: (t) => console.log(`  ${rojo('✖')} ${t}`),
};
