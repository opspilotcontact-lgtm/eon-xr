// Tráfico del valle: carros, coches, el tren, barcos, aviones que despegan, dan la vuelta al valle
// y aterrizan, naves del futuro y el humo de las fábricas. Todo sigue las rutas de obras.js
// o recorridos fijos (mar y cielo). Lo que aparece depende de la era más avanzada del valle.
import * as THREE from 'three';
import { crearPool, poner, MATERIALES, mulberry32 } from './actores.js';
import { AEROPUERTO } from './terreno.js';

function preparar(pts, cerrada = false) {
  const p = cerrada ? [...pts, pts[0]] : pts, cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z));
  return { p, cum, L: cum[cum.length - 1], cerrada };
}
// posición y orientación a la distancia s de la ruta
function enRuta(r, s, out) {
  const { p, cum } = r;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  const a = p[lo], b = p[hi], t = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
  out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t; out.z = a.z + (b.z - a.z) * t;
  out.dx = b.x - a.x; out.dy = b.y - a.y; out.dz = b.z - a.z;
  return out;
}

export function crearTrafico(terreno, padre, actores, obras, semilla) {
  const rnd = mulberry32((semilla ^ 0x7af1c) >>> 0);
  const G = actores.G;
  const grupo = new THREE.Group(); grupo.name = 'trafico';
  padre.add(grupo);
  const pool = (geo, cap, m = MATERIALES.normal) => crearPool(grupo, geo, cap, m);
  const M = {
    carro: pool(G.carro, 12), coche: pool(G.coche, 70), locomotora: pool(G.locomotora, 2), vagon: pool(G.vagon, 8),
    trirreme: pool(G.trirreme, 4), vapor: pool(G.vapor, 3), carguero: pool(G.carguero, 3), avion: pool(G.avion, 5), nave: pool(G.nave, 18), humo: pool(G.humo, 160),
  };
  const _c = new THREE.Color(), q = {};
  let vehiculos = [], naves = [], humos = [], clave = '', nivMax = 0, V = null;

  // recorrido de los barcos: un bucle por el mar del oeste, entre la costa y la isla
  const MAR = [[-3.2, 1.45], [-4.1, 1.05], [-4.15, -0.5], [-3.65, -1.35], [-3.25, -0.3]].map(([x, z]) => ({ x, y: 0, z }));
  // recorrido de los aviones: carrera en la pista, despegue, vuelta al valle y aterrizaje
  const a = AEROPUERTO, yPista = terreno.altura(a.x, a.z) + 0.012;
  const vuelo = (() => {
    const W = new THREE.Vector3(a.x - a.largo / 2 + 0.05, yPista, a.z), E = new THREE.Vector3(a.x + a.largo / 2 - 0.05, yPista, a.z);
    const curva = new THREE.CatmullRomCurve3([
      W, new THREE.Vector3(a.x, yPista, a.z), E,
      new THREE.Vector3(a.x + a.largo / 2 + 1.1, 0.55, a.z - 0.1), new THREE.Vector3(4.2, 1.2, 1.2), new THREE.Vector3(3.9, 1.4, -3.4),
      new THREE.Vector3(-0.5, 1.5, -4.3), new THREE.Vector3(-4.3, 1.3, -2.2), new THREE.Vector3(-4.4, 1.0, 2.3),
      new THREE.Vector3(a.x - a.largo / 2 - 1.7, 0.45, a.z + 0.1), new THREE.Vector3(a.x - a.largo / 2 - 0.5, yPista + 0.08, a.z),
    ], true, 'centripetal');
    return preparar(curva.getSpacedPoints(420).map(v => ({ x: v.x, y: v.y, z: v.z })), true);
  })();

  function rutaAzar() {
    const r = obras.rutas, lista = [...r.calles, ...(r.carretera?.length > 3 ? [r.carretera, r.carretera] : []), ...(r.aeropuerto?.length > 3 ? [r.aeropuerto] : [])];
    return lista.length ? lista[Math.floor(rnd() * lista.length)] : null;
  }
  function nuevoEnRuta(tipo, pts, vel, color) {
    if (!pts || pts.length < 2) return;
    const r = pts._r || (pts._r = preparar(pts));
    vehiculos.push({ tipo, r, s: rnd() * r.L, dir: rnd() < 0.5 ? 1 : -1, vel, color });
  }

  function sincronizar(v) {
    V = v;
    const vivos = v.pueblos.filter(p => p.ruinas < 0.5);
    nivMax = Math.max(0, ...vivos.map(p => p.nivel));
    const r = obras.rutas;
    const k = [nivMax, r.calles.length, r.carretera?.length, r.tren?.length, r.aeropuerto?.length, vivos.some(p => p.id === 'A'), Math.round(v.mar * 20)].join('|');
    if (k === clave) return; clave = k;
    vehiculos = []; naves = [];
    const L = nivMax;
    // carros de bueyes por la calzada romana y medieval
    if (L === 3 || L === 4) for (let i = 0; i < 9; i++) nuevoEnRuta('carro', rutaAzar(), 0.03, '#ffffff');
    // coches: pocos al principio del siglo XX, muchos hoy
    const nCoches = L === 5 ? 8 : L === 6 ? 55 : L >= 7 ? 22 : 0;
    const COLORES = ['#c83a3a', '#3a6ac8', '#e8e8e8', '#2a2a2a', '#e8c83a', '#4a8a4a', '#8a8a8a'];
    for (let i = 0; i < nCoches; i++) nuevoEnRuta('coche', rutaAzar(), 0.09 + rnd() * 0.05, L === 5 ? '#2a2a2a' : COLORES[Math.floor(rnd() * COLORES.length)]);
    // tren
    if (L >= 5 && r.tren?.length > 4) {
      const rt = r.tren._r || (r.tren._r = preparar(r.tren)), s0 = rt.L * 0.3;
      vehiculos.push({ tipo: 'tren', r: rt, s: s0, dir: 1, vel: L >= 7 ? 0.35 : 0.12, color: L === 5 ? '#6a4a3a' : L === 6 ? '#c8ccd2' : '#f2f6fa' });
    }
    // barcos: trirremes en Roma, vapores en la era industrial, cargueros hoy
    const hayMar = v.mar > terreno.altura(-3.9, 0) + 0.06 && vivos.some(p => p.id === 'A' && p.nivel >= 3);
    if (hayMar) {
      const rm = preparar(MAR.map(p => ({ ...p, y: v.mar })), true);
      const flota = L <= 4 ? ['trirreme', 'trirreme', 'trirreme'] : L === 5 ? ['vapor', 'vapor', 'trirreme'] : ['carguero', 'carguero', 'vapor'];
      flota.forEach((t, i) => vehiculos.push({ tipo: t, r: rm, s: rm.L * i / flota.length, dir: 1, vel: t === 'carguero' ? 0.09 : t === 'vapor' ? 0.1 : 0.07, color: '#ffffff' }));
    }
    // aviones
    if (L >= 6) for (let i = 0; i < (L >= 7 ? 5 : 3); i++) vehiculos.push({ tipo: 'avion', r: vuelo, s: vuelo.L * i / (L >= 7 ? 5 : 3), dir: 1, vel: 0.5, color: '#ffffff' });
    // naves del futuro sobre la ciudad
    if (L >= 7) {
      const c = vivos.find(p => p.nivel >= 7) || vivos[0];
      for (let i = 0; i < 16; i++) naves.push({ cx: c.x, cz: c.z, x: c.x, y: 0.5, z: c.z, tx: c.x, ty: 0.5, tz: c.z, rot: 0 });
    }
  }

  // humo de las fábricas y de la locomotora de vapor
  let tHumo = 0;
  function emitir(x, y, z) { if (humos.length < M.humo.instanceMatrix.count) humos.push({ x, y, z, t: 0, vida: 2.6 + rnd(), dx: (rnd() - 0.5) * 0.02 }); }

  function porFrame(dt) {
    if (!V) return;
    const n = { carro: 0, coche: 0, locomotora: 0, vagon: 0, trirreme: 0, vapor: 0, carguero: 0, avion: 0, nave: 0, humo: 0 };
    tHumo -= dt;
    const tocaHumo = tHumo <= 0;
    if (tocaHumo) tHumo = 0.35;
    for (const v of vehiculos) {
      v.s += v.dir * v.vel * dt;
      if (v.r.cerrada) v.s = ((v.s % v.r.L) + v.r.L) % v.r.L;
      else if (v.s > v.r.L || v.s < 0) {
        // al final de la calle: media vuelta (o a otra calle si es un coche)
        v.dir *= -1; v.s = Math.max(0, Math.min(v.r.L, v.s));
        if (v.tipo === 'coche' && rnd() < 0.5) { const p = rutaAzar(); if (p) { v.r = p._r || (p._r = preparar(p)); v.s = rnd() * v.r.L; } }
      }
      if (v.tipo === 'tren') {
        const piezas = ['locomotora', 'vagon', 'vagon', 'vagon'];
        piezas.forEach((tp, i) => {
          const s = Math.max(0, Math.min(v.r.L, v.s - v.dir * i * 0.075));
          enRuta(v.r, s, q);
          const yaw = Math.atan2(q.dx * v.dir, q.dz * v.dir), j = n[tp]++;
          if (j < M[tp].instanceMatrix.count) { poner(M[tp], j, q.x, q.y, q.z, yaw, 1); M[tp].setColorAt(j, _c.set(tp === 'vagon' ? v.color : '#ffffff')); }
          if (i === 0 && tocaHumo && nivMax === 5) emitir(q.x, q.y + 0.06, q.z);
        });
        continue;
      }
      enRuta(v.r, v.s, q);
      const j = n[v.tipo]++, m = M[v.tipo];
      if (j >= m.instanceMatrix.count) continue;
      const yaw = Math.atan2(q.dx * v.dir, q.dz * v.dir);
      if (v.tipo === 'avion') {
        const pitch = -Math.atan2(q.dy, Math.hypot(q.dx, q.dz));
        poner(m, j, q.x, q.y, q.z, yaw, 1, 1, 1, pitch);
      } else {
        // dos sentidos: cada uno por su carril
        const l = Math.hypot(q.dx, q.dz) || 1, carril = v.tipo === 'coche' || v.tipo === 'carro' ? 0.008 * v.dir : 0;
        poner(m, j, q.x + q.dz / l * carril, q.y, q.z - q.dx / l * carril, yaw, 1);
      }
      m.setColorAt(j, _c.set(v.color));
      if (v.tipo === 'vapor' && tocaHumo) emitir(q.x, q.y + 0.08, q.z);
    }
    for (const s of naves) {
      if (Math.hypot(s.tx - s.x, s.tz - s.z, s.ty - s.y) < 0.03) {
        const ang = rnd() * 6.28, d = 0.2 + rnd() * 0.9;
        s.tx = s.cx + Math.cos(ang) * d; s.tz = s.cz + Math.sin(ang) * d; s.ty = 0.35 + rnd() * 0.6;
      }
      const dx = s.tx - s.x, dy = s.ty - s.y, dz = s.tz - s.z, d = Math.hypot(dx, dy, dz), paso = Math.min(d, 0.25 * dt);
      s.x += dx / d * paso; s.y += dy / d * paso; s.z += dz / d * paso; s.rot = Math.atan2(dx, dz);
      const j = n.nave++;
      if (j < M.nave.instanceMatrix.count) { poner(M.nave, j, s.x, s.y, s.z, s.rot, 1); M.nave.setColorAt(j, _c.set('#ffffff')); }
    }
    if (tocaHumo && nivMax === 5) for (const f of actores.edificios('fabrica')) {
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      emitir(f.x + 0.045 * c - 0.025 * s, f.y + 0.155, f.z - 0.045 * s - 0.025 * c);
    }
    for (let i = humos.length - 1; i >= 0; i--) {
      const h = humos[i];
      h.t += dt;
      if (h.t > h.vida) { humos.splice(i, 1); continue; }
      const k = h.t / h.vida, j = n.humo++;
      poner(M.humo, j, h.x + h.dx * h.t * 4, h.y + h.t * 0.09, h.z, 0, 0.5 + 1.8 * k);
      M.humo.setColorAt(j, _c.setScalar(0.55 + 0.3 * k));
    }
    for (const [t, m] of Object.entries(M)) { m.count = Math.min(n[t], m.instanceMatrix.count); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  return { grupo, sincronizar, porFrame, get cuantos() { return vehiculos.length + naves.length; } };
}
