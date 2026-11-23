// Obras públicas del valle: calles entre las manzanas, la carretera entre los dos pueblos (con
// puente sobre el río), la vía del tren y la pista del aeropuerto. Cambian de material con la época:
// senda de tierra → calzada romana → macadán → asfalto. También dejan las RUTAS que usa el tráfico.
import * as THREE from 'three';
import { crearPool, poner, MATERIALES } from './actores.js';
import { SITIOS, AEROPUERTO } from './terreno.js';

const ESTILO = {
  2: { color: '#9a7a58', ancho: 0.016 },
  3: { color: '#b8ab90', ancho: 0.022 }, 4: { color: '#a89a80', ancho: 0.022 },
  5: { color: '#7a7068', ancho: 0.024 }, 6: { color: '#3a3a3e', ancho: 0.028 }, 7: { color: '#cfd8e2', ancho: 0.028 },
};
const TRAMO = 0.07;

export function crearObras(terreno, padre, actores) {
  const grupo = new THREE.Group(); grupo.name = 'obras';
  padre.add(grupo);
  const tramos = crearPool(grupo, actores.G.tramo, 5000, MATERIALES.normal);
  const { altura, distRio, enLago, dentro } = terreno;
  const _c = new THREE.Color();
  let clave = '', n = 0, mar = 0;
  const rutas = { calles: [], carretera: null, tren: null, aeropuerto: null };

  // altura de la calzada: sigue el suelo y sube en puente sobre el río
  function yCalzada(x, z) {
    const d = distRio(x, z);
    let y = altura(x, z);
    if (d < 0.14) y += 0.075 * Math.sqrt(1 - d / 0.14);
    return Math.max(y, mar + 0.012) + 0.002;
  }
  // un tramo recto de calzada entre dos puntos
  function tramo(ax, az, bx, bz, ancho, color, dy = 0) {
    if (n >= tramos.instanceMatrix.count) return;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, largo = Math.hypot(bx - ax, bz - az);
    poner(tramos, n, mx, yCalzada(mx, mz) + dy, mz, Math.atan2(bx - ax, bz - az), ancho, 1, largo + 0.004);
    tramos.setColorAt(n, _c.set(color));
    n++;
  }
  // polilínea muestreada: devuelve los puntos (con su y) para el tráfico
  function camino(pts, ancho, color, filtro = () => true, dy = 0) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], k = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / TRAMO));
      for (let s = 0; s < k; s++) {
        const x0 = ax + (bx - ax) * s / k, z0 = az + (bz - az) * s / k, x1 = ax + (bx - ax) * (s + 1) / k, z1 = az + (bz - az) * (s + 1) / k;
        if (!filtro(x0, z0) || !filtro(x1, z1)) { if (out.length > 1) out.corte = true; continue; }
        tramo(x0, z0, x1, z1, ancho, color, dy);
        if (!out.length) out.push({ x: x0, y: yCalzada(x0, z0), z: z0 });
        out.push({ x: x1, y: yCalzada(x1, z1), z: z1 });
      }
    }
    return out;
  }
  const enSuelo = (x, z) => dentro(x, z, 0.1) && altura(x, z) > mar + 0.01 && !enLago(x, z);

  function sincronizar(V) {
    mar = V.mar;
    const pu = Object.fromEntries(V.pueblos.filter(p => p.ruinas < 0.5).map(p => [p.id, p]));
    const urb = Object.fromEntries(actores.urbano.map(u => [u.id, u]));
    const nivMax = Math.max(0, ...V.pueblos.map(p => (p.ruinas < 0.5 ? p.nivel : 0)));
    const k = [Object.values(pu).map(p => `${p.id}${p.nivel}`).join(), Object.values(urb).map(u => u.r.toFixed(2)).join(), Math.round(mar * 40)].join('|');
    if (k === clave) return; clave = k;
    n = 0; rutas.calles = []; rutas.carretera = rutas.tren = rutas.aeropuerto = null;

    // calles en rejilla, entre filas de parcelas
    for (const id of Object.keys(pu)) {
      const p = pu[id], u = urb[id], E = ESTILO[Math.min(7, p.nivel)];
      if (!u || p.nivel < 3) continue;
      const R = actores.rejilla(id), r = u.r * 0.95, paso = R.paso * 2;
      const dentroCiudad = (x, z) => Math.hypot(x - p.x, z - p.z) < r && enSuelo(x, z);
      for (let off = R.paso * 1.5; off < R.R * 2; off += paso) {
        const x = R.x0 + off, z = R.z0 + off;
        const v = camino([[x, p.z - r], [x, p.z + r]], E.ancho, E.color, dentroCiudad);
        const h = camino([[p.x - r, z], [p.x + r, z]], E.ancho, E.color, dentroCiudad);
        if (v.length > 3) rutas.calles.push(v);
        if (h.length > 3) rutas.calles.push(h);
      }
    }
    // carretera entre los pueblos (senda en el Neolítico, calzada en Roma, autovía hoy)
    if (pu.A && pu.B && Math.min(pu.A.nivel, pu.B.nivel) >= 2) {
      const E = ESTILO[Math.min(7, Math.max(pu.A.nivel, pu.B.nivel))];
      const A = SITIOS.A, B = SITIOS.B, m = [(A.x + B.x) / 2 + 0.1, (A.z + B.z) / 2 + 0.55];
      rutas.carretera = camino([[A.x, A.z], m, [B.x, B.z]], E.ancho * 1.3, E.color, enSuelo);
      if (nivMax >= 6) camino([[A.x, A.z], m, [B.x, B.z]], 0.004, '#e8e8e0', enSuelo, 0.0015);   // línea central
      // tren desde la era industrial: balasto oscuro con dos raíles claros
      if (nivMax >= 5) {
        const off = 0.11, t = [[A.x, A.z - off], [m[0], m[1] - off], [B.x, B.z - off]];
        rutas.tren = camino(t, 0.03, '#4a4038', enSuelo);
      }
    }
    // aeropuerto: pista y carretera de acceso
    if (nivMax >= 6) {
      const a = AEROPUERTO;
      tramo(a.x - a.largo / 2, a.z, a.x + a.largo / 2, a.z, 0.13, '#2e2e30');
      for (let x = a.x - a.largo / 2 + 0.05; x < a.x + a.largo / 2 - 0.05; x += 0.1) tramo(x, a.z, x + 0.05, a.z, 0.006, '#f0f0f0', 0.001);
      const desde = pu.A ? SITIOS.A : SITIOS.B;
      rutas.aeropuerto = camino([[desde.x, desde.z], [a.x - 0.2, desde.z + 0.6], [a.x, a.z + 0.3]], ESTILO[6].ancho, ESTILO[6].color, enSuelo);
    }
    tramos.count = n; tramos.instanceMatrix.needsUpdate = true; tramos.instanceColor.needsUpdate = true;
  }

  return { grupo, rutas, sincronizar, yCalzada };
}
