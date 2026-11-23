// Geometrías del valle hechas de piezas (cajas, conos, cilindros) con color por vértice.
// Unidades del valle: una persona mide ~0,046 (en la mesa a escala 0,12 son ~5,5 mm).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

function pieza(g, color, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  if (g.index) g = g.toNonIndexed();   // todo sin índice: mergeGeometries no mezcla
  g.deleteAttribute('uv');
  _m.compose(_p.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...s));
  g.applyMatrix4(_m);
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const unir = (...ps) => mergeGeometries(ps);
const caja = (w, h, d, color, p, r, s) => pieza(new THREE.BoxGeometry(w, h, d), color, p, r, s);
const cil = (r1, r2, h, n, color, p, r, s) => pieza(new THREE.CylinderGeometry(r1, r2, h, n), color, p, r, s);
const cono = (r, h, n, color, p, r2, s) => pieza(new THREE.ConeGeometry(r, h, n), color, p, r2, s);
// tejado a dos aguas: prisma triangular a lo largo de x, con la cumbrera arriba
function tejado(ancho, fondo, alto, color, y) {
  const g = new THREE.CylinderGeometry(fondo * 0.58, fondo * 0.58, ancho, 3);
  g.rotateX(-Math.PI / 2); g.rotateY(Math.PI / 2);
  const k = alto / (fondo * 0.58 * 1.5);
  return pieza(g, color, [0, y + fondo * 0.29 * k, 0], [0, 0, 0], [1, k, 1]);
}
// caja alta con franjas (pisos) para torres que se estiran con la escala y; la geometría
// necesita segmentos de altura: la franja es suave, pero a este tamaño se lee como pisos
function franjas(geo, c1, c2, pisos) {
  const a = new THREE.Color(c1), b = new THREE.Color(c2), pos = geo.attributes.position, col = geo.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), c = y > 0.03 && y < 0.97 && Math.round(y * pisos) % 2 ? b : a;
    col.setXYZ(i, c.r, c.g, c.b);
  }
  return geo;
}

export function crearGeometrias() {
  const G = {};
  // ---------- seres ----------
  G.cuerpo = unir(
    cil(0.0072, 0.0105, 0.026, 6, '#ffffff', [0, 0.019, 0]),
    caja(0.013, 0.008, 0.009, '#5a5a5a', [0, 0.004, 0]),
  );
  G.cabeza = pieza(new THREE.SphereGeometry(0.0078, 8, 6), '#ffffff', [0, 0.0395, 0]);
  G.sauropodo = unir(
    caja(0.16, 0.085, 0.09, '#ffffff', [0, 0.115, 0]).rotateY(Math.PI / 2),
    caja(0.036, 0.036, 0.17, '#ffffff', [0, 0.2, 0.13], [-0.85, 0, 0]),
    caja(0.042, 0.032, 0.06, '#ffffff', [0, 0.275, 0.205]),
    caja(0.032, 0.03, 0.2, '#ffffff', [0, 0.1, -0.17], [0.25, 0, 0]),
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => caja(0.032, 0.085, 0.032, '#d8d8d0', [sx * 0.03, 0.04, sz * 0.055])),
  );
  G.teropodo = unir(
    caja(0.06, 0.06, 0.11, '#ffffff', [0, 0.09, 0], [-0.15, 0, 0]),
    caja(0.046, 0.046, 0.075, '#ffffff', [0, 0.14, 0.085]),
    caja(0.04, 0.012, 0.06, '#f0e0d0', [0, 0.115, 0.09]),
    caja(0.026, 0.026, 0.12, '#ffffff', [0, 0.085, -0.1], [0.15, 0, 0]),
    caja(0.022, 0.065, 0.026, '#d0c8c0', [0.022, 0.032, 0]),
    caja(0.022, 0.065, 0.026, '#d0c8c0', [-0.022, 0.032, 0]),
  );
  G.mamifero = unir(
    caja(0.03, 0.026, 0.062, '#ffffff', [0, 0.031, 0]),
    caja(0.022, 0.022, 0.028, '#ffffff', [0, 0.046, 0.04]),
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => caja(0.008, 0.02, 0.008, '#c8c0b8', [sx * 0.01, 0.01, sz * 0.022])),
    caja(0.006, 0.006, 0.02, '#ffffff', [0, 0.036, -0.038], [0.5, 0, 0]),
  );
  // ---------- plantas ----------
  G.frondoso = unir(cil(0.006, 0.009, 0.05, 5, '#6a4a2e', [0, 0.025, 0]), pieza(new THREE.IcosahedronGeometry(0.04, 0), '#ffffff', [0, 0.075, 0]));
  G.pino = unir(cil(0.005, 0.007, 0.03, 5, '#5a3e28', [0, 0.015, 0]), cono(0.03, 0.1, 6, '#ffffff', [0, 0.08, 0]));
  G.helecho = unir(cil(0.005, 0.008, 0.09, 5, '#6a5a3a', [0, 0.045, 0]), cono(0.055, 0.03, 7, '#ffffff', [0, 0.1, 0], [Math.PI, 0, 0]));
  // ---------- edificios (base en y = 0, frente hacia +z) ----------
  G.tienda = cono(0.022, 0.04, 6, '#a08060', [0, 0.02, 0]);
  G.fogata = unir(cono(0.008, 0.016, 5, '#ffb43a', [0, 0.008, 0]), cono(0.005, 0.022, 4, '#ff6a1a', [0.004, 0.011, 0]));
  G.choza = unir(cil(0.024, 0.026, 0.026, 8, '#9a7a52', [0, 0.013, 0]), cono(0.033, 0.03, 8, '#c8b060', [0, 0.041, 0]));
  G.campo = unir(caja(0.085, 0.004, 0.085, '#ffffff', [0, 0.002, 0]), ...[-0.03, -0.01, 0.01, 0.03].map(x => caja(0.006, 0.006, 0.08, '#e8e8e0', [x, 0.004, 0])));
  G.casaPiedra = unir(caja(0.05, 0.032, 0.04, '#d8c8a8', [0, 0.016, 0]), tejado(0.054, 0.044, 0.018, '#b85a3a', 0.032));
  G.templo = unir(
    caja(0.15, 0.02, 0.1, '#e8e2d4', [0, 0.01, 0]),
    ...Array.from({ length: 12 }, (_, i) => { const lado = i < 6 ? 1 : -1, x = -0.06 + (i % 6) * 0.024; return cil(0.0045, 0.0045, 0.05, 6, '#f2eee4', [x, 0.045, lado * 0.038]); }),
    caja(0.15, 0.01, 0.1, '#e8e2d4', [0, 0.075, 0]),
    tejado(0.15, 0.1, 0.03, '#d8cfc0', 0.08),
  );
  G.casaMadera = unir(caja(0.045, 0.035, 0.04, '#8a6a48', [0, 0.0175, 0]), tejado(0.05, 0.046, 0.03, '#4a3a30', 0.035));
  G.castillo = unir(
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].flatMap(([sx, sz]) => [cil(0.022, 0.024, 0.12, 8, '#8a8680', [sx * 0.08, 0.06, sz * 0.08]), cono(0.026, 0.04, 8, '#5a4a5a', [sx * 0.08, 0.14, sz * 0.08])]),
    caja(0.16, 0.07, 0.012, '#8a8680', [0, 0.035, 0.08]), caja(0.16, 0.07, 0.012, '#8a8680', [0, 0.035, -0.08]),
    caja(0.012, 0.07, 0.16, '#8a8680', [0.08, 0.035, 0]), caja(0.012, 0.07, 0.16, '#8a8680', [-0.08, 0.035, 0]),
    caja(0.06, 0.14, 0.06, '#9a968e', [0, 0.07, 0]), cono(0.05, 0.05, 4, '#5a4a5a', [0, 0.165, 0], [0, Math.PI / 4, 0]),
  );
  G.iglesia = unir(
    caja(0.05, 0.04, 0.09, '#d8d0c0', [0, 0.02, 0]), tejado(0.09, 0.054, 0.025, '#8a4a3a', 0.04).rotateY(Math.PI / 2),
    caja(0.026, 0.1, 0.026, '#d8d0c0', [0, 0.05, 0.05]), cono(0.02, 0.05, 4, '#5a4a4a', [0, 0.125, 0.05], [0, Math.PI / 4, 0]),
  );
  G.casaLadrillo = unir(caja(0.05, 0.05, 0.045, '#a0583a', [0, 0.025, 0]), tejado(0.054, 0.049, 0.02, '#4a3430', 0.05));
  G.fabrica = unir(
    caja(0.12, 0.05, 0.07, '#7a6a60', [0, 0.025, 0]),
    ...[-0.04, 0, 0.04].map(x => tejado(0.035, 0.07, 0.02, '#5a504a', 0.05).rotateY(Math.PI / 2).translate(x, 0, 0)),
    cil(0.008, 0.011, 0.15, 8, '#6a3a2a', [0.045, 0.075, -0.025]), cil(0.008, 0.011, 0.13, 8, '#6a3a2a', [0.02, 0.065, -0.025]),
  );
  G.torre = franjas(pieza(new THREE.BoxGeometry(0.06, 1, 0.06, 1, 28, 1), '#9aa4ad', [0, 0.5, 0]), '#9aa4ad', '#2a3a4a', 28);
  G.casaModerna = unir(caja(0.05, 0.03, 0.05, '#e4e2dc', [0, 0.015, 0]), caja(0.02, 0.012, 0.05, '#4a6a8a', [0.015, 0.036, 0]));
  G.torreFuturo = franjas(pieza(new THREE.CylinderGeometry(0.024, 0.04, 1, 10, 44), '#e8f4ff', [0, 0.5, 0]), '#e8f4ff', '#3ad0ff', 44);
  G.domo = pieza(new THREE.SphereGeometry(0.085, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#9fe0ff');
  G.ruina = unir(caja(0.04, 0.014, 0.03, '#4a4642', [0, 0.007, 0]), caja(0.014, 0.04, 0.014, '#3a3632', [0.014, 0.02, 0.006], [0, 0, 0.2]), caja(0.03, 0.01, 0.02, '#2e2a26', [-0.012, 0.005, -0.012], [0, 0.6, 0]));
  // ---------- monumentos ----------
  G.coliseo = unir(
    pieza(new THREE.CylinderGeometry(0.12, 0.125, 0.08, 32, 1, true), '#d8c8a8', [0, 0.04, 0], [0, 0, 0], [1.25, 1, 1]),
    ...Array.from({ length: 32 }, (_, i) => { const a = i / 32 * Math.PI * 2; return caja(0.009, 0.08, 0.004, '#a89878', [Math.cos(a) * 0.1265 * 1.25, 0.04, Math.sin(a) * 0.1265], [0, -a + Math.PI / 2, 0]); }),
    pieza(new THREE.CylinderGeometry(0.085, 0.115, 0.06, 28, 1, true), '#9a8a70', [0, 0.035, 0], [0, 0, 0], [1.25, 1, 1]),
    pieza(new THREE.CylinderGeometry(0.085, 0.085, 0.008, 24), '#d8c08a', [0, 0.008, 0], [0, 0, 0], [1.25, 1, 1]),
  );
  G.arco = unir(caja(0.012, 0.1, 0.014, '#c8b898', [0.026, 0.05, 0]), caja(0.012, 0.1, 0.014, '#c8b898', [-0.026, 0.05, 0]), caja(0.066, 0.016, 0.018, '#b8a888', [0, 0.1, 0]));
  G.molino = unir(cil(0.012, 0.018, 0.06, 8, '#e8e0d0', [0, 0.03, 0]), cono(0.016, 0.02, 8, '#7a4a3a', [0, 0.07, 0]),
    caja(0.004, 0.07, 0.002, '#6a5a4a', [0, 0.062, 0.02], [0, 0, 0.6]), caja(0.004, 0.07, 0.002, '#6a5a4a', [0, 0.062, 0.02], [0, 0, -0.97]));
  G.estadio = unir(
    pieza(new THREE.CylinderGeometry(0.13, 0.11, 0.05, 32, 1, true), '#b8bcc4', [0, 0.025, 0], [0, 0, 0], [1.3, 1, 1]),
    pieza(new THREE.CylinderGeometry(0.1, 0.1, 0.006, 24), '#4a9a4a', [0, 0.004, 0], [0, 0, 0], [1.3, 1, 1]),
  );
  G.terminal = unir(caja(0.32, 0.035, 0.07, '#c8d0d8', [0, 0.0175, 0]), caja(0.3, 0.012, 0.075, '#5a7a9a', [0, 0.02, 0.002]),
    cil(0.009, 0.011, 0.11, 8, '#d8d8d8', [0.2, 0.055, 0]), cil(0.02, 0.016, 0.02, 8, '#3a5a7a', [0.2, 0.115, 0]));
  G.estacion = unir(caja(0.12, 0.035, 0.05, '#a86a4a', [0, 0.0175, 0]), tejado(0.13, 0.055, 0.02, '#4a3a3a', 0.035), cil(0.006, 0.006, 0.07, 6, '#4a3a3a', [0.05, 0.035, 0.02]));
  G.puerto = unir(caja(0.05, 0.012, 0.22, '#7a6248', [0, 0.006, 0]), ...[-0.08, 0, 0.08].map(z => cil(0.004, 0.004, 0.05, 5, '#5a4a38', [0.022, -0.012, z])));
  // ---------- vehículos (frente hacia +z) ----------
  G.carro = unir(caja(0.022, 0.012, 0.032, '#8a6a48', [0, 0.014, -0.012]), cil(0.007, 0.007, 0.03, 8, '#4a3a2a', [0, 0.007, -0.012], [0, 0, Math.PI / 2]),
    caja(0.012, 0.016, 0.03, '#6a4a30', [0, 0.02, 0.025]), caja(0.01, 0.01, 0.012, '#6a4a30', [0, 0.03, 0.044]));
  G.coche = unir(caja(0.018, 0.01, 0.036, '#ffffff', [0, 0.008, 0]), caja(0.016, 0.009, 0.018, '#2a3a4a', [0, 0.017, -0.002]));
  G.locomotora = unir(caja(0.028, 0.03, 0.07, '#2a2a2a', [0, 0.02, 0]), cil(0.006, 0.008, 0.02, 8, '#1a1a1a', [0, 0.042, 0.022]), caja(0.028, 0.018, 0.02, '#8a2a2a', [0, 0.042, -0.025]));
  G.vagon = caja(0.026, 0.026, 0.06, '#ffffff', [0, 0.018, 0]);
  G.trirreme = unir(caja(0.04, 0.016, 0.14, '#7a5a3a', [0, 0.006, 0]), cono(0.02, 0.03, 4, '#7a5a3a', [0, 0.006, 0.08], [Math.PI / 2, Math.PI / 4, 0]),
    cil(0.003, 0.003, 0.09, 5, '#5a4a3a', [0, 0.055, 0]), caja(0.075, 0.055, 0.003, '#e8dcc0', [0, 0.065, 0]),
    ...[-0.05, -0.025, 0, 0.025, 0.05].flatMap(z => [caja(0.05, 0.002, 0.003, '#5a4a3a', [0.04, 0.0, z], [0, 0, -0.4]), caja(0.05, 0.002, 0.003, '#5a4a3a', [-0.04, 0.0, z], [0, 0, 0.4])]));
  G.vapor = unir(caja(0.05, 0.022, 0.18, '#2a2a2a', [0, 0.007, 0]), caja(0.05, 0.008, 0.18, '#8a2a2a', [0, -0.006, 0]), caja(0.036, 0.022, 0.07, '#e8e4dc', [0, 0.028, -0.01]), cil(0.008, 0.008, 0.05, 8, '#c8a040', [0, 0.06, 0.0]));
  G.carguero = unir(caja(0.06, 0.024, 0.28, '#3a4a6a', [0, 0.008, 0]), caja(0.06, 0.008, 0.28, '#8a2a2a', [0, -0.006, 0]), caja(0.05, 0.035, 0.04, '#e8e8e8', [0, 0.035, -0.11]),
    ...[[-0.08, '#c84a3a'], [-0.04, '#3a7ac8'], [0, '#e8a83a'], [0.04, '#4a9a5a'], [0.08, '#c84a3a']].map(([z, c]) => caja(0.046, 0.02, 0.035, c, [0, 0.03, z])));
  G.avion = unir(pieza(new THREE.CylinderGeometry(0.009, 0.006, 0.13, 8), '#f2f2f2', [0, 0, 0], [Math.PI / 2, 0, 0]),
    cono(0.009, 0.02, 8, '#f2f2f2', [0, 0, 0.075], [Math.PI / 2, 0, 0]),
    caja(0.14, 0.003, 0.028, '#e0e0e8', [0, -0.002, 0.005]), caja(0.045, 0.003, 0.016, '#e0e0e8', [0, 0.004, -0.056]), caja(0.003, 0.025, 0.02, '#c83a3a', [0, 0.014, -0.056]));
  G.nave = unir(pieza(new THREE.SphereGeometry(0.02, 12, 6), '#e8f4ff', [0, 0, 0], [0, 0, 0], [1, 0.4, 1.6]), pieza(new THREE.TorusGeometry(0.022, 0.004, 6, 16), '#3ad0ff', [0, -0.002, 0], [Math.PI / 2, 0, 0], [1, 1.5, 1]));
  // ---------- vida de mar y cielo ----------
  G.pez = unir(caja(0.01, 0.008, 0.028, '#ffffff', [0, 0, 0]), caja(0.002, 0.012, 0.01, '#ffffff', [0, 0, -0.018]));
  G.ave = unir(caja(0.006, 0.005, 0.02, '#ffffff', [0, 0, 0]), caja(0.03, 0.002, 0.012, '#ffffff', [0.016, 0.004, 0], [0, 0, 0.35]), caja(0.03, 0.002, 0.012, '#ffffff', [-0.016, 0.004, 0], [0, 0, -0.35]));
  G.humo = pieza(new THREE.IcosahedronGeometry(0.018, 0), '#9a9a9a');
  G.tramo = caja(1, 0.006, 1, '#ffffff', [0, 0.003, 0]);
  return G;
}

// radio que ocupa cada edificio (para no pisarse)
export const RADIO = { coliseo: 0.17, molino: 0.03, estadio: 0.18, estacion: 0.07, arco: 0, terminal: 0, puerto: 0, tienda: 0.028, fogata: 0.01, choza: 0.034, campo: 0.05, casaPiedra: 0.034, templo: 0.095, casaMadera: 0.032, castillo: 0.13, iglesia: 0.06, casaLadrillo: 0.035, fabrica: 0.075, torre: 0.04, casaModerna: 0.036, torreFuturo: 0.045, domo: 0.09, ruina: 0.03 };
export const CAPACIDAD = { coliseo: 2, molino: 10, estadio: 2, estacion: 2, arco: 90, terminal: 1, puerto: 2, tienda: 80, fogata: 30, choza: 90, campo: 160, casaPiedra: 130, templo: 4, casaMadera: 130, castillo: 2, iglesia: 4, casaLadrillo: 150, fabrica: 24, torre: 130, casaModerna: 130, torreFuturo: 90, domo: 12, ruina: 180 };
