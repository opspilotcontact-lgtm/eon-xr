// Los habitantes del valle: árboles, fauna, personas y edificios con InstancedMesh.
// La simulación (sim.js) dice CUÁNTOS y DE QUÉ ÉPOCA; aquí se decide DÓNDE y cómo se mueven.
import * as THREE from 'three';
import { crearGeometrias, RADIO, CAPACIDAD } from './piezas.js';
import { SITIOS, MITAD } from './terreno.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TOPE_PERSONAS = 330;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const Y = new THREE.Vector3(0, 1, 0);

export function crearActores(terreno, padre, semilla) {
  const rnd = mulberry32((semilla ^ 0xac7) >>> 0);
  const G = crearGeometrias();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const matBrillo = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const grupo = new THREE.Group(); grupo.name = 'actores';
  padre.add(grupo);

  function pool(geo, cap, material = mat) {
    const m = new THREE.InstancedMesh(geo, material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.count = 0; m.frustumCulled = false;
    grupo.add(m);
    return m;
  }
  const poner = (malla, i, x, y, z, rotY, sx, sy = sx, sz = sx, inclinar = 0) => {
    _e.set(inclinar, rotY, 0, 'YXZ');
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
    malla.setMatrixAt(i, _m);
  };

  const { altura, pendiente, dentro } = terreno;
  let V = null, mar = 0;
  const enTierra = (x, z, margen = 0.012) => dentro(x, z) && altura(x, z) > mar + margen;

  // ---------- puntos candidatos de tierra (fijos por semilla) ----------
  const puntos = [];
  for (let i = 0; puntos.length < 900 && i < 20000; i++) {
    const x = (rnd() * 2 - 1) * (MITAD - 0.1), z = (rnd() * 2 - 1) * (MITAD - 0.1);
    if (altura(x, z) < 0.03 || terreno.distRio(x, z) < 0.09) continue;
    puntos.push({ x, z, h: altura(x, z), k: rnd(), pend: pendiente(x, z) });
  }
  function puntoTierra(cx, cz, r, intentos = 12) {
    for (let i = 0; i < intentos; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (enTierra(x, z) && pendiente(x, z) < 0.9) return [x, z];
    }
    return [cx, cz];
  }

  // ---------- árboles ----------
  const arboles = { frondoso: pool(G.frondoso, 520), pino: pool(G.pino, 260), helecho: pool(G.helecho, 520) };
  let claveArboles = '';
  function sincronizarArboles() {
    const k = [V.plantas.toFixed(2), V.helecho, V.seco.toFixed(1), V.nieve.toFixed(2), mar.toFixed(2), urbano.map(u => u.r.toFixed(2)).join()].join('|');
    if (k === claveArboles) return; claveArboles = k;
    const n = { frondoso: 0, pino: 0, helecho: 0 };
    const verde = new THREE.Color(V.seco > 0.4 ? '#8a8a3a' : '#3f7a34').lerp(new THREE.Color('#9a7a4a'), Math.max(0, V.seco - 0.4)), nevado = new THREE.Color('#e8eef2');
    for (let i = 0; i < puntos.length; i++) {
      const pt = puntos[i];
      if (pt.h < mar + 0.015 || pt.h > V.nieve + 0.03 || pt.pend > 1.2) continue;
      // más densos en el norte (bosque) y junto al río; casi nada en el desierto
      const bosque = suave(0.4, -0.8, pt.z) * (1 - suave(1.0, 1.6, pt.x)), rio = 1 - suave(0.1, 0.35, terreno.distRio(pt.x, pt.z));
      const desierto = suave(0.6, 1.3, pt.x) * suave(0.8, 1.5, pt.z);
      const dens = V.plantas * (0.08 + 0.85 * bosque + 0.4 * rio) * (1 - 0.95 * desierto);
      if (pt.k > dens) continue;
      if (urbano.some(u => Math.hypot(pt.x - u.x, pt.z - u.z) < u.r)) continue;
      const tipo = pt.h > 0.3 ? 'pino' : V.helecho ? 'helecho' : 'frondoso';
      const m = arboles[tipo], j = n[tipo]++;
      if (j >= m.instanceMatrix.count) continue;
      const s = 0.75 + 0.6 * hash(i);
      poner(m, j, pt.x, pt.h - 0.004, pt.z, hash(i + 7) * 6.28, s);
      _c.copy(verde).offsetHSL((hash(i + 3) - 0.5) * 0.04, 0, (hash(i + 5) - 0.5) * 0.12);
      if (pt.h > V.nieve - 0.08) _c.lerp(nevado, 0.6);
      m.setColorAt(j, _c);
    }
    for (const [t, m] of Object.entries(arboles)) { m.count = Math.min(n[t], m.instanceMatrix.count); m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }

  // ---------- edificios ----------
  const edif = {};
  for (const t of Object.keys(CAPACIDAD)) edif[t] = { malla: pool(G[t], CAPACIDAD[t], t === 'fogata' ? matBrillo : mat), items: new Map() };
  // parcelas de cada sitio, de dentro hacia fuera
  const lotes = {};
  for (const [id, s] of Object.entries(SITIOS)) {
    const L = [], paso = 0.082, R = s.r * 1.45;
    for (let gx = -R; gx <= R; gx += paso) for (let gz = -R; gz <= R; gz += paso) {
      const x = s.x + gx + (rnd() - 0.5) * 0.02, z = s.z + gz + (rnd() - 0.5) * 0.02, d = Math.hypot(x - s.x, z - s.z);
      if (d > R || !dentro(x, z, 0.12) || altura(x, z) < 0.03 || terreno.distRio(x, z) < 0.1 || pendiente(x, z) > 0.45) continue;
      L.push({ x, z, d: d + rnd() * 0.05, rot: Math.round(Math.atan2(s.x - x, s.z - z) / (Math.PI / 2)) * Math.PI / 2 + (rnd() - 0.5) * 0.3 });
    }
    L.sort((a, b) => a.d - b.d);
    lotes[id] = L;
  }
  const POR_CASA = [99, 4, 4, 4, 4, 5, 6, 8];
  function casaDe(L, dn, i) {
    switch (L) {
      case 1: return 'tienda';
      case 2: return 'choza';
      case 3: return 'casaPiedra';
      case 4: return 'casaMadera';
      case 5: return dn > 0.45 && i % 6 === 3 ? 'fabrica' : 'casaLadrillo';
      case 6: return dn < 0.42 ? 'torre' : 'casaModerna';
      default: return dn < 0.55 ? 'torreFuturo' : i % 5 === 2 ? 'domo' : 'torre';
    }
  }
  const ESPECIALES = { 3: { A: ['templo'], B: [] }, 4: { A: ['castillo', 'iglesia'], B: ['iglesia'] }, 7: { A: ['domo'], B: [] } };
  let urbano = [];
  function planDe(pu) {
    const L = pu.nivel, lots = lotes[pu.id], out = [], ocupado = [];
    if (L < 1) return { out, r: 0 };
    const nCasas = Math.min(lots.length, Math.ceil(pu.n / POR_CASA[L]) + (pu.ruinas > 0.05 ? 6 : 0));
    const esp = [...(ESPECIALES[L]?.[pu.id] || [])];
    let i = 0, rMax = 0.1;
    const libre = (x, z, r) => ocupado.every(o => Math.hypot(x - o.x, z - o.z) > (r + o.r) * 0.92);
    for (; i < lots.length && out.length < nCasas; i++) {
      const lt = lots[i], dn = lt.d / pu.r;
      let tipo = esp.length ? esp[0] : casaDe(L, dn, i);
      if (!libre(lt.x, lt.z, RADIO[tipo])) { if (esp.length) continue; tipo = casaDe(L, 0.2, 0) === 'torre' ? 'casaModerna' : casaDe(L, dn, 1); if (!libre(lt.x, lt.z, RADIO[tipo])) continue; }
      if (esp.length && tipo === esp[0]) esp.shift();
      ocupado.push({ x: lt.x, z: lt.z, r: RADIO[tipo] });
      let alto = 1;
      if (tipo === 'torre') alto = (L >= 7 ? 0.2 : 0.12) + 0.4 * Math.max(0, 1 - dn / 0.42) * (0.4 + 0.6 * hash(i * 31 + 1));
      if (tipo === 'torreFuturo') alto = 0.25 + 0.5 * Math.max(0, 1 - dn / 0.55) * (0.35 + 0.65 * hash(i * 17 + 3));
      // ruinas: tras una bomba, parte de la ciudad queda en escombros
      if (pu.ruinas > 0.05 && hash(i * 13 + (pu.id === 'A' ? 0 : 99)) < pu.ruinas) { tipo = 'ruina'; alto = 1; }
      out.push({ key: `${pu.id}:${i}:${tipo}`, tipo, x: lt.x, z: lt.z, rot: lt.rot, alto });
      if (L === 1 && i % 4 === 0 && tipo !== 'ruina') out.push({ key: `${pu.id}:${i}:fogata`, tipo: 'fogata', x: lt.x + 0.035, z: lt.z + 0.02, rot: 0, alto: 1 });
      rMax = Math.max(rMax, lt.d + RADIO[tipo]);
    }
    // campos alrededor del pueblo
    const nCampos = L >= 2 && L <= 5 ? Math.round(out.length * [0, 0, 0.8, 0.7, 0.6, 0.35][L]) : 0;
    for (let c = 0; i < lots.length && c < nCampos; i++) {
      const lt = lots[i];
      if (!libre(lt.x, lt.z, RADIO.campo)) continue;
      ocupado.push({ x: lt.x, z: lt.z, r: RADIO.campo });
      out.push({ key: `${pu.id}:${i}:campo`, tipo: 'campo', x: lt.x, z: lt.z, rot: lt.rot, alto: 1, color: hash(i) < 0.5 ? '#d8c060' : '#7aa848' });
      c++;
    }
    return { out, r: rMax };
  }
  let animando = true;
  function sincronizarEdificios(t) {
    const deseados = new Map();
    urbano = [];
    for (const pu of V.pueblos) {
      const { out, r } = planDe(pu);
      for (const b of out) deseados.set(b.key, b);
      if (pu.nivel >= 2) urbano.push({ x: pu.x, z: pu.z, r: r * 0.85, suelo: pu.nivel >= 6 ? 'urbano6' : pu.nivel >= 5 ? 'urbano5' : pu.nivel >= 3 ? 'urbano3' : null, nivel: pu.nivel });
    }
    for (const [tipo, E] of Object.entries(edif)) {
      for (const k of E.items.keys()) if (!deseados.has(k)) { E.items.delete(k); animando = true; }
    }
    for (const [k, b] of deseados) {
      const E = edif[b.tipo];
      if (!E.items.has(k) && E.items.size < CAPACIDAD[b.tipo]) { E.items.set(k, { ...b, t0: t, y: altura(b.x, b.z) }); animando = true; }
    }
  }
  function dibujarEdificios(t) {
    if (!animando) return;
    animando = false;
    for (const [tipo, E] of Object.entries(edif)) {
      let j = 0;
      for (const b of E.items.values()) {
        const k = Math.min(1, (t - b.t0) / 1.4);
        if (k < 1) animando = true;
        const sube = k * k * (3 - 2 * k);
        poner(E.malla, j, b.x, b.y - 0.003, b.z, b.rot, 1, Math.max(0.02, sube) * b.alto, 1);
        E.malla.setColorAt(j, _c.set(b.color || '#ffffff'));
        j++;
      }
      E.malla.count = j; E.malla.instanceMatrix.needsUpdate = true; E.malla.instanceColor.needsUpdate = true;
    }
  }

  // ---------- seres que se mueven ----------
  const mallas = {
    cuerpo: pool(G.cuerpo, TOPE_PERSONAS), cabeza: pool(G.cabeza, TOPE_PERSONAS),
    sauropodo: pool(G.sauropodo, 60), teropodo: pool(G.teropodo, 24), mamifero: pool(G.mamifero, 60), cazador: pool(G.mamifero, 20),
  };
  const personas = [], animales = [];
  const PIEL = ['#e8c4a0', '#c89a72', '#a0704a', '#7a4e30', '#f0d4b8'];
  const ROPA = { 0: ['#7a5a3a'], 1: ['#8a6a4a', '#7a5a3a'], 2: ['#b8a070', '#8a7a5a'], 3: ['#e8e0d0', '#c8463c'], 4: ['#6a5a8a', '#8a3a3a', '#5a6a4a'], 5: ['#3a3a4a', '#5a4a3a'], 6: ['#3a6aa8', '#c8c8c8', '#2a2a2a', '#c86a3a'], 7: ['#e8f4ff', '#8ad0ff'] };

  function nuevaPersona(pu) {
    const [x, z] = pu.nivel >= 1 ? puntoTierra(pu.x, pu.z, pu.r * 0.7) : puntoTierra(pu.x, pu.z - 0.6, 0.5);
    const per = { pu: pu.id, x, z, tx: x, tz: z, rot: rnd() * 6.28, pausa: rnd() * 2, vivo: true, muerteT: 0, huir: 0, hx: 0, hz: 0, soldado: false, fase: rnd() * 6.28,
      piel: PIEL[Math.floor(rnd() * PIEL.length)], tono: rnd() };
    personas.push(per);
  }
  function colorRopa(per, pu) {
    const lista = ROPA[pu.nivel] || ROPA[1];
    _c.set(lista[Math.floor(per.tono * lista.length)]);
    if (per.soldado) _c.set(pu.color).multiplyScalar(0.85);
    else _c.lerp(new THREE.Color(pu.color), 0.35);
    return _c;
  }
  function sincronizarPersonas() {
    const vivosDe = id => personas.filter(p => p.vivo && p.pu === id);
    let total = 0;
    for (const pu of V.pueblos) {
      const quiero = Math.min(pu.n, TOPE_PERSONAS - total - 4);
      total += Math.max(0, quiero);
      const vivos = vivosDe(pu.id);
      for (let i = vivos.length; i < quiero; i++) nuevaPersona(pu);
      for (let i = quiero; i < vivos.length; i++) { const v = vivos[i]; v.vivo = false; v.muerteT = -1; }   // se van sin caer
    }
    for (const per of personas) if (per.vivo && !V.pueblos.some(pu => pu.id === per.pu)) { per.vivo = false; per.muerteT = -1; }
    // guerra: una parte de cada pueblo forma ejército
    const gw = V.guerra;
    for (const per of personas) {
      if (!per.vivo) continue;
      const debe = !!gw && (per.pu === gw.ataca ? hash(per.fase * 1000) < 0.55 : per.pu === gw.defiende ? hash(per.fase * 1000) < 0.45 : false);
      if (debe !== per.soldado) { per.soldado = debe; per.pausa = 0; }
    }
  }

  function nuevoAnimal(tipo) {
    // los grandes viven lejos de los pueblos; los herbívoros prefieren el norte (bosque)
    const cx = tipo === 'sauropodo' ? (rnd() * 2.6 - 1.4) : (rnd() * 4.4 - 2.2), cz = tipo === 'sauropodo' ? -1.2 + rnd() * 1.6 : rnd() * 4.4 - 2.2;
    const [x, z] = puntoTierra(cx, cz, 0.5, 20);
    if (!enTierra(x, z)) return;
    animales.push({ tipo, x, z, tx: x, tz: z, rot: rnd() * 6.28, pausa: rnd() * 3, vivo: true, muerteT: 0, huir: 0, hx: 0, hz: 0, fase: rnd() * 6.28, tono: rnd() });
  }
  function sincronizarFauna() {
    const f = V.fauna, mamDepr = !(f.herb > 0 || V.a > 6.6e7);
    const quiero = { sauropodo: f.herb, teropodo: mamDepr ? 0 : f.depr, mamifero: f.peq, cazador: mamDepr ? f.depr : 0 };
    for (const [tipo, n] of Object.entries(quiero)) {
      const vivos = animales.filter(a => a.vivo && a.tipo === tipo);
      const tope = mallas[tipo].instanceMatrix.count;
      for (let i = vivos.length; i < Math.min(n, tope); i++) nuevoAnimal(tipo);
      for (let i = n; i < vivos.length; i++) { vivos[i].vivo = false; vivos[i].muerteT = vivos.length - n > 6 ? 0.01 : -1; }
    }
  }

  // ---------- explosiones: muertos, huida y heridas ----------
  function golpe(x, z, rMuerte = 0.55, rHuida = 1.4) {
    for (const s of [...personas, ...animales]) {
      if (!s.vivo) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < rMuerte) { s.vivo = false; s.muerteT = 0.01; s.quemado = true; }
      else if (d < rHuida) { s.huir = 3.5; s.hx = (s.x - x) / d; s.hz = (s.z - z) / d; }
    }
  }

  // ---------- paso ----------
  let tCombate = 0;
  function mover(s, vel, dt) {
    let dx = s.tx - s.x, dz = s.tz - s.z;
    if (s.huir > 0) { dx = s.hx; dz = s.hz; vel *= 2.6; s.huir -= dt; }
    const d = Math.hypot(dx, dz);
    if (d < 0.01) return false;
    const paso = Math.min(d, vel * dt), nx = s.x + dx / d * paso, nz = s.z + dz / d * paso;
    if (enTierra(nx, nz, 0.004)) { s.x = nx; s.z = nz; } else { s.tx = s.x; s.tz = s.z; s.huir = 0; return false; }
    const rot = Math.atan2(dx, dz), dr = Math.atan2(Math.sin(rot - s.rot), Math.cos(rot - s.rot));
    s.rot += dr * Math.min(1, dt * 8);
    return true;
  }
  function pasoPersonas(dt, t) {
    const pueblo = Object.fromEntries((V?.pueblos || []).map(pu => [pu.id, pu]));
    const gw = V?.guerra;
    tCombate -= dt;
    const combate = tCombate <= 0;
    if (combate) tCombate = 0.25;
    let j = 0;
    for (let i = personas.length - 1; i >= 0; i--) {
      const s = personas[i];
      if (!s.vivo) {
        if (s.muerteT < 0 || (s.muerteT += dt) > 6) { personas.splice(i, 1); continue; }
      } else {
        const pu = pueblo[s.pu];
        if (!pu) continue;
        let anda = false;
        if (s.soldado && gw) {
          const enemigo = SITIOS[s.pu === gw.ataca ? gw.defiende : gw.ataca], propio = SITIOS[s.pu];
          // el frente: entre los dos pueblos, más cerca del que defiende
          const k = s.pu === gw.ataca ? 0.62 : 0.5;
          if (s.pausa <= 0 || Math.hypot(s.tx - s.x, s.tz - s.z) < 0.02) {
            s.tx = propio.x + (enemigo.x - propio.x) * k + (hash(s.fase * 99) - 0.5) * 0.5;
            s.tz = propio.z + (enemigo.z - propio.z) * k + (hash(s.fase * 77) - 0.5) * 0.5;
            s.pausa = 1 + rnd() * 2;
          }
          s.pausa -= dt;
          anda = mover(s, 0.06, dt);
          if (combate) {
            for (const o of personas) {
              if (!o.vivo || o.pu === s.pu || !o.soldado) continue;
              if (Math.hypot(o.x - s.x, o.z - s.z) < 0.06) { s.tx = o.x; s.tz = o.z; if (rnd() < 0.12) { o.vivo = false; o.muerteT = 0.01; } break; }
            }
          }
        } else {
          if (s.pausa > 0) s.pausa -= dt;
          else if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.015) {
            const [x, z] = pu.nivel >= 1 ? puntoTierra(pu.x, pu.z, pu.r * (pu.nivel >= 2 ? 1.05 : 0.8), 4) : puntoTierra(s.x, s.z, 0.35, 4);
            s.tx = x; s.tz = z; s.pausa = 0.5 + rnd() * 3;
          }
          anda = mover(s, 0.035, dt);
        }
        s.fase += dt * (anda ? 14 : 0);
        s._anda = anda;
      }
      const pu = pueblo[s.pu];
      const y = altura(s.x, s.z), bote = s.vivo && s._anda ? Math.abs(Math.sin(s.fase)) * 0.004 : 0;
      const caido = !s.vivo ? Math.PI / 2 * Math.min(1, s.muerteT * 3) : 0;
      if (j >= TOPE_PERSONAS) continue;
      poner(mallas.cuerpo, j, s.x, y + bote, s.z, s.rot, 1, 1, 1, caido);
      poner(mallas.cabeza, j, s.x, y + bote, s.z, s.rot, 1, 1, 1, caido);
      if (pu) colorRopa(s, pu); else _c.set('#555');
      if (s.quemado) _c.multiplyScalar(0.15);
      mallas.cuerpo.setColorAt(j, _c);
      _c.set(s.piel); if (s.quemado) _c.multiplyScalar(0.15);
      mallas.cabeza.setColorAt(j, _c);
      j++;
    }
    for (const k of ['cuerpo', 'cabeza']) { mallas[k].count = j; mallas[k].instanceMatrix.needsUpdate = true; mallas[k].instanceColor.needsUpdate = true; }
  }
  const COLOR_ANIMAL = { sauropodo: ['#7d8a5a', '#8a8a6a', '#6a7a5a'], teropodo: ['#8a5a3a', '#7a4a3a'], mamifero: ['#8a6a4a', '#6a5040', '#a08060'], reptil: ['#4a6a3a', '#5a7a4a'], cazador: ['#4a3a30', '#3a3028'] };
  function pasoAnimales(dt) {
    const n = { sauropodo: 0, teropodo: 0, mamifero: 0, cazador: 0 };
    const presas = animales.filter(a => a.vivo && (a.tipo === 'sauropodo' || a.tipo === 'mamifero'));
    for (let i = animales.length - 1; i >= 0; i--) {
      const s = animales[i];
      if (!s.vivo) {
        if (s.muerteT < 0 || (s.muerteT += dt) > 7) { animales.splice(i, 1); continue; }
      } else {
        const caza = s.tipo === 'teropodo' || s.tipo === 'cazador';
        let vel = s.tipo === 'sauropodo' ? 0.03 : caza ? 0.05 : 0.045;
        if (caza) {
          let mejor = null;
          for (const pr of presas) { if (!pr.vivo) continue; const d = Math.hypot(pr.x - s.x, pr.z - s.z); if (d < 0.7 && (!mejor || d < mejor.d)) mejor = { pr, d }; }
          if (mejor) {
            s.tx = mejor.pr.x; s.tz = mejor.pr.z; vel = 0.1;
            if (mejor.d < 0.2 && !mejor.pr.huir) { mejor.pr.huir = 1.5; mejor.pr.hx = (mejor.pr.x - s.x) / mejor.d; mejor.pr.hz = (mejor.pr.z - s.z) / mejor.d; }
            if (mejor.d < 0.05 && rnd() < dt * 0.8) { mejor.pr.vivo = false; mejor.pr.muerteT = 0.01; }
          }
        }
        if (s.pausa > 0) s.pausa -= dt;
        else if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.02) { const [x, z] = puntoTierra(s.x, s.z, 0.6, 5); s.tx = x; s.tz = z; s.pausa = 1 + rnd() * 4; }
        s._anda = mover(s, vel, dt);
        s.fase += dt * (s._anda ? 9 : 0);
      }
      const m = mallas[s.tipo], j = n[s.tipo]++;
      if (j >= m.instanceMatrix.count) continue;
      const esc = s.tipo === 'sauropodo' ? (V?.fauna.gigantes || 1) * (0.85 + 0.3 * s.tono) : s.tipo === 'cazador' ? 1.7 : s.tipo === 'teropodo' ? 0.9 + 0.3 * s.tono : 0.8 + 0.4 * s.tono;
      const y = altura(s.x, s.z), bote = s.vivo && s._anda ? Math.abs(Math.sin(s.fase)) * 0.006 * esc : 0;
      poner(m, j, s.x, y + bote, s.z, s.rot, esc, esc, esc, 0);
      if (!s.vivo) { _e.set(0, s.rot, Math.PI / 2 * Math.min(1, s.muerteT * 2)); _m.compose(_p.set(s.x, y, s.z), _q.setFromEuler(_e), _s.set(esc, esc, esc)); m.setMatrixAt(j, _m); }
      const lista = COLOR_ANIMAL[s.tipo === 'mamifero' && V?.fauna.tipoPeq === 'reptil' ? 'reptil' : s.tipo];
      _c.set(lista[Math.floor(s.tono * lista.length)]);
      if (s.quemado) _c.multiplyScalar(0.15);
      m.setColorAt(j, _c);
    }
    for (const k of Object.keys(n)) { mallas[k].count = Math.min(n[k], mallas[k].instanceMatrix.count); mallas[k].instanceMatrix.needsUpdate = true; mallas[k].instanceColor.needsUpdate = true; }
  }

  let reloj = 0;
  return {
    grupo,
    get urbano() { return urbano; },
    get cuantos() { return { personas: personas.filter(p => p.vivo).length, animales: animales.filter(a => a.vivo).length, edificios: Object.values(edif).reduce((s, E) => s + E.items.size, 0) }; },
    sincronizar(v) {
      V = v; mar = v.mar;
      sincronizarEdificios(reloj);
      sincronizarArboles();
      sincronizarPersonas();
      sincronizarFauna();
    },
    golpe,
    porFrame(dt) {
      reloj += dt;
      if (!V) return;
      dibujarEdificios(reloj);
      pasoPersonas(dt, reloj);
      pasoAnimales(dt);
    },
  };
}
