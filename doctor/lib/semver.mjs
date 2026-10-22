// Comparación de versiones mínima, sin dependencias: lo justo para engines, .nvmrc y requires-python.
// Soporta: 1.2.3, v20, 20.x, >=18, <21, ^22.1, ~3.12, =1.0, rangos con espacio (">=18 <21") y "||".

export function parsear(v) {
  const m = String(v ?? '').trim().replace(/^[v=]/i, '').match(/^(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/i);
  if (!m) return null;
  const n = (x) => (x === undefined || /x|\*/i.test(x) ? null : Number(x));
  return { mayor: Number(m[1]), menor: n(m[2]), parche: n(m[3]) };
}

/** Extrae la primera versión que aparece en un texto («git version 2.54.0» → 2.54.0). */
export function extraerVersion(texto) {
  const m = String(texto ?? '').match(/(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

export function comparar(a, b) {
  const x = typeof a === 'string' ? parsear(a) : a;
  const y = typeof b === 'string' ? parsear(b) : b;
  for (const k of ['mayor', 'menor', 'parche']) {
    const d = (x?.[k] ?? 0) - (y?.[k] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

function cumpleUno(version, cond) {
  const m = cond.match(/^(>=|<=|>|<|\^|~|=)?\s*(.+)$/);
  if (!m) return true;
  const [, op = '', resto] = m;
  const obj = parsear(resto);
  if (!obj) return true; // condición que no entendemos: no bloquea
  const c = comparar(version, obj);
  switch (op) {
    case '>=': return c >= 0;
    case '>': return c > 0;
    case '<=': return c <= 0;
    case '<': return c < 0;
    case '^': return c >= 0 && version.mayor === obj.mayor && (obj.mayor !== 0 || version.menor === obj.menor);
    case '~': return c >= 0 && version.mayor === obj.mayor && (obj.menor === null || version.menor === obj.menor);
    default: // exacta o comodín (20, 20.x, 3.12)
      return version.mayor === obj.mayor
        && (obj.menor === null || version.menor === obj.menor)
        && (obj.parche === null || version.parche === obj.parche);
  }
}

/** ¿La versión cumple el rango? Sin rango o con un rango ilegible, se considera que sí. */
export function cumple(version, rango) {
  const v = typeof version === 'string' ? parsear(version) : version;
  if (!v) return false;
  if (!rango || !String(rango).trim() || /^(\*|latest|lts.*|node|stable)$/i.test(String(rango).trim())) return true;
  return String(rango).split('||').some((alt) => {
    const partes = alt.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').split(/[\s,]+/).filter(Boolean);
    // rango con guion: "18 - 20"
    if (partes.length === 3 && partes[1] === '-') return cumpleUno(v, `>=${partes[0]}`) && cumpleUno(v, `<=${partes[2]}`);
    return partes.every((p) => cumpleUno(v, p));
  });
}

/** Versión concreta que conviene instalar para un rango (lo que se le pasa a fnm / uv). */
export function versionParaInstalar(rango) {
  const r = String(rango ?? '').trim();
  if (!r || /^lts|^\*$|^node$/i.test(r)) return 'lts';
  const m = r.match(/(\d+(?:\.\d+){0,2})/);
  if (!m) return 'lts';
  if (/^<|^<=/.test(r)) return 'lts';
  return m[1];
}
