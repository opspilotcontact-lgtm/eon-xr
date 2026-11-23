// Vida que da escala a cada época: peces desde el Cámbrico, plesiosaurios en el Mesozoico,
// ballenas en el Cenozoico, pterosaurios y luego aves en bandadas, mamuts en las glaciaciones
// y ganado junto a los campos. Sin consecuencias en la simulación: es ambiente.
import * as THREE from 'three';
import { crearPool, poner, MATERIALES, mulberry32 } from './actores.js';
import { SITIOS, FONDO } from './terreno.js';

const entre = (a, x, b) => a <= x && x <= b;

export function crearVida(terreno, padre, actores, semilla) {
  const rnd = mulberry32((semilla ^ 0x1fe) >>> 0);
  const G = actores.G;
  const grupo = new THREE.Group(); grupo.name = 'vida';
  padre.add(grupo);
  const pool = (geo, cap) => crearPool(grupo, geo, cap, MATERIALES.normal);
  const M = { pez: pool(G.pez, 60), plesio: pool(G.sauropodo, 4), ballena: pool(G.mamifero, 3), ave: pool(G.ave, 40), mamut: pool(G.mamifero, 10), vaca: pool(G.mamifero, 30) };
  const { altura } = terreno;
  const _c = new THREE.Color();
  let seres = [], clave = '', V = null, t = 0;

  const enMar = (x, z, mar, prof = 0.06) => x > -4.4 && x < 4.4 && z > -4.4 && z < 4.4 && altura(x, z) < mar - prof;
  function puntoMar(mar) {
    for (let i = 0; i < 30; i++) { const x = -4.35 + rnd() * 1.6, z = -4.2 + rnd() * 8.4; if (enMar(x, z, mar, 0.08)) return [x, z]; }
    return null;
  }

  function sincronizar(v) {
    V = v;
    const a = v.a, pueblosCampo = v.pueblos.filter(p => p.nivel >= 2 && p.nivel <= 5 && p.ruinas < 0.4);
    const quiero = {
      pez: v.lava || v.mar < FONDO + 0.12 ? 0 : a < 5.4e8 ? 46 : 0,
      plesio: entre(6.6e7, a, 2.0e8) ? 3 : 0,
      ballena: a < 4.5e7 ? 2 : 0,
      ave: entre(6.6e7, a, 2.2e8) ? 8 : a < 6.6e7 ? (v.pueblos.some(p => p.nivel >= 6) ? 16 : 30) : 0,
      mamut: entre(1.1e4, a, 4e5) && v.nieve < 0.75 ? 7 : 0,
      vaca: pueblosCampo.length ? Math.min(28, Math.round(pueblosCampo.reduce((s, p) => s + p.n, 0) / 5)) : 0,
    };
    const k = Object.values(quiero).join() + Math.round(v.mar * 20);
    if (k === clave) return; clave = k;
    seres = seres.filter(s => s.n < quiero[s.tipo]);
    for (const [tipo, cuantos] of Object.entries(quiero)) {
      const ya = seres.filter(s => s.tipo === tipo).length;
      for (let i = ya; i < cuantos; i++) {
        const s = { tipo, n: i, fase: rnd() * 6.28, tono: rnd(), rot: rnd() * 6.28 };
        if (tipo === 'pez' || tipo === 'plesio' || tipo === 'ballena') {
          const p = puntoMar(v.mar); if (!p) continue;
          [s.x, s.z] = p; s.tx = s.x; s.tz = s.z; s.prof = 0.05 + rnd() * 0.2;
        } else if (tipo === 'ave') {
          // bandadas que giran alrededor de un centro que deriva
          s.cx = -2.5 + rnd() * 5; s.cz = -2.5 + rnd() * 5; s.radio = 0.4 + rnd() * 0.9; s.alto = 0.55 + rnd() * 0.7; s.vel = (0.25 + rnd() * 0.25) * (rnd() < 0.5 ? 1 : -1);
        } else {
          const centro = tipo === 'mamut' ? [0.5 + rnd() * 1.5, -3.2 + rnd() * 0.8] : (() => { const p = pueblosCampo[i % pueblosCampo.length]; const sit = SITIOS[p.id]; const ang = rnd() * 6.28, d = sit.r * (0.95 + rnd() * 0.4); return [sit.x + Math.cos(ang) * d, sit.z + Math.sin(ang) * d]; })();
          [s.x, s.z] = centro; s.cx = s.x; s.cz = s.z; s.tx = s.x; s.tz = s.z; s.pausa = rnd() * 3;
        }
        seres.push(s);
      }
    }
  }

  function porFrame(dt) {
    if (!V) return;
    t += dt;
    const n = { pez: 0, plesio: 0, ballena: 0, ave: 0, mamut: 0, vaca: 0 };
    const mar = V.mar;
    for (const s of seres) {
      const m = M[s.tipo], j = n[s.tipo]++;
      if (j >= m.instanceMatrix.count) continue;
      if (s.tipo === 'ave') {
        s.fase += dt * s.vel / s.radio;
        s.cx += Math.sin(t * 0.05 + s.tono * 9) * dt * 0.05; s.cz += Math.cos(t * 0.04 + s.tono * 7) * dt * 0.05;
        s.cx = Math.max(-3.8, Math.min(3.8, s.cx)); s.cz = Math.max(-3.8, Math.min(3.8, s.cz));
        const x = s.cx + Math.cos(s.fase) * s.radio, z = s.cz + Math.sin(s.fase) * s.radio, y = Math.max(s.alto, altura(x, z) + 0.25);
        const ptero = V.a > 6.6e7, aleteo = 0.6 + 0.4 * Math.sin(t * (ptero ? 5 : 14) + s.tono * 20);
        const esc = ptero ? 3.2 : 1.1;
        poner(m, j, x, y, z, s.fase * Math.sign(s.vel) + (s.vel > 0 ? 0 : Math.PI), esc * aleteo, esc, esc);
        m.setColorAt(j, _c.set(ptero ? '#7a5a40' : s.tono < 0.5 ? '#f2f2f2' : '#3a3a3a'));
        continue;
      }
      if (s.tipo === 'pez' || s.tipo === 'plesio' || s.tipo === 'ballena') {
        const vel = s.tipo === 'pez' ? 0.08 : 0.04;
        if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.03) { const p = puntoMar(mar); if (p) [s.tx, s.tz] = p; }
        const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz) || 1, nx = s.x + dx / d * vel * dt, nz = s.z + dz / d * vel * dt;
        if (enMar(nx, nz, mar, 0.04)) { s.x = nx; s.z = nz; } else { const p = puntoMar(mar); if (p) [s.tx, s.tz] = p; }
        s.rot = Math.atan2(dx, dz);
        const fondo = altura(s.x, s.z) + 0.03;
        const y = s.tipo === 'ballena' ? mar - 0.02 + Math.max(0, Math.sin(t * 0.4 + s.tono * 9)) * 0.015 : Math.max(fondo, mar - s.prof);
        const esc = s.tipo === 'pez' ? 1.2 : s.tipo === 'plesio' ? 0.55 : 3.6;
        poner(m, j, s.x, s.tipo === 'plesio' ? y - 0.1 : y, s.z, s.rot + Math.sin(t * 6 + s.fase) * 0.15, esc);
        m.setColorAt(j, _c.set(s.tipo === 'pez' ? (V.a > 2.5e8 ? ['#8a7a5a', '#6a6a5a'] : ['#c8d0d8', '#e8a040', '#4a7ab0', '#d8d8c0'])[Math.floor(s.tono * (V.a > 2.5e8 ? 2 : 4))] : s.tipo === 'plesio' ? '#3a4a4a' : '#4a5a6a'));
        continue;
      }
      // mamuts y vacas: pasean cerca de su centro
      if (s.pausa > 0) s.pausa -= dt;
      else if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.01) {
        const ang = rnd() * 6.28, d = rnd() * (s.tipo === 'mamut' ? 0.8 : 0.18);
        const tx = s.cx + Math.cos(ang) * d, tz = s.cz + Math.sin(ang) * d;
        if (altura(tx, tz) > mar + 0.02) { s.tx = tx; s.tz = tz; }
        s.pausa = 1 + rnd() * 4;
      } else {
        const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz), paso = Math.min(d, 0.025 * dt);
        s.x += dx / d * paso; s.z += dz / d * paso; s.rot = Math.atan2(dx, dz);
      }
      const esc = s.tipo === 'mamut' ? 2.5 : 1.05;
      poner(m, j, s.x, altura(s.x, s.z), s.z, s.rot, esc);
      m.setColorAt(j, _c.set(s.tipo === 'mamut' ? '#5a3a28' : ['#f0ece4', '#2a2a2a', '#8a5a3a'][Math.floor(s.tono * 3)]));
    }
    for (const [k, m] of Object.entries(M)) { m.count = Math.min(n[k], m.instanceMatrix.count); m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }

  return { grupo, sincronizar, porFrame };
}
