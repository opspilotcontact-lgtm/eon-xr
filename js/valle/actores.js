// Los habitantes del valle: árboles, fauna de tierra, personas y edificios con InstancedMesh.
// La simulación (sim.js) dice CUÁNTOS y DE QUÉ ÉPOCA; aquí se decide DÓNDE y cómo se mueven.
import * as THREE from 'three';
import { crearGeometrias, RADIO, CAPACIDAD } from './piezas.js';
import { SITIOS, MITAD, LAGO, OASIS, AEROPUERTO } from './terreno.js';

export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const TOPE_PERSONAS = 360;
export const PASO_LOTE = 0.082;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

// utilidades compartidas con obras, tráfico y vida
export function crearPool(grupo, geo, cap, material) {
  const m = new THREE.InstancedMesh(geo, material, cap);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
  m.count = 0; m.frustumCulled = false;
  grupo.add(m);
  return m;
}
export function poner(malla, i, x, y, z, rotY, sx, sy = sx, sz = sx, inclinar = 0, alabeo = 0) {
  _e.set(inclinar, rotY, alabeo, 'YXZ');
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
  malla.setMatrixAt(i, _m);
}
export const MATERIALES = {
  normal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
  doble: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
  brillo: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
};

export function crearActores(terreno, padre, semilla, G = crearGeometrias()) {
  const rnd = mulberry32((semilla ^ 0xac7) >>> 0);
  const mat = MATERIALES.normal;
  const grupo = new THREE.Group(); grupo.name = 'actores';
  padre.add(grupo);
  const pool = (geo, cap, material = mat) => crearPool(grupo, geo, cap, material);

  const { altura, pendiente, dentro, enLago, pesos } = terreno;
  let V = null, mar = 0;
  const enTierra = (x, z, margen = 0.012) => dentro(x, z) && altura(x, z) > mar + margen && !enLago(x, z);

  // ---------- puntos candidatos de tierra (fijos por semilla) ----------
  const puntos = [];
  for (let i = 0; puntos.length < 2000 && i < 40000; i++) {
    const x = (rnd() * 2 - 1) * (MITAD - 0.1), z = (rnd() * 2 - 1) * (MITAD - 0.1);
    if (altura(x, z) < 0.03 || terreno.distRio(x, z) < 0.09 || enLago(x, z)) continue;
    puntos.push({ x, z, h: altura(x, z), k: rnd(), pend: pendiente(x, z), w: pesos(x, z), oasis: Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.r * 2.4 });
  }
  function puntoTierra(cx, cz, r, intentos = 12) {
    for (let i = 0; i < intentos; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (enTierra(x, z) && pendiente(x, z) < 0.9) return [x, z];
    }
    return [cx, cz];
  }

  // ---------- árboles por bioma ----------
  const arboles = { frondoso: pool(G.frondoso, 1000), pino: pool(G.pino, 700), helecho: pool(G.helecho, 800) };
  let claveArboles = '';
  const VERDES = { templado: new THREE.Color('#3f7a34'), selva: new THREE.Color('#1f6a26'), taiga: new THREE.Color('#2a5a3a'), sabana: new THREE.Color('#7a8a3a'), seco: new THREE.Color('#9a7a4a') };
  const nevado = new THREE.Color('#e8eef2');
  function sincronizarArboles() {
    const k = [V.plantas.toFixed(2), V.helecho, V.seco.toFixed(1), V.nieve.toFixed(2), mar.toFixed(2), urbano.map(u => u.r.toFixed(2)).join(), V.pueblos.some(p => p.nivel >= 6)].join('|');
    if (k === claveArboles) return; claveArboles = k;
    const n = { frondoso: 0, pino: 0, helecho: 0 };
    const hayAeropuerto = V.pueblos.some(p => p.nivel >= 6);
    for (let i = 0; i < puntos.length; i++) {
      const pt = puntos[i], w = pt.w;
      if (pt.h < mar + 0.015 || pt.h > V.nieve + 0.03 || pt.pend > 1.3) continue;
      const dens = V.plantas * (0.05 + 0.85 * w.bosque + 0.8 * w.taiga + 1.1 * w.selva + 0.1 * w.sabana + 0.35 * w.rio + 0.3 * w.lago) * (1 - 0.98 * w.desierto) + (pt.oasis && V.plantas > 0.2 ? 0.8 : 0);
      if (pt.k > dens) continue;
      if (urbano.some(u => Math.hypot(pt.x - u.x, pt.z - u.z) < u.r)) continue;
      if (hayAeropuerto && Math.abs(pt.x - AEROPUERTO.x) < AEROPUERTO.largo / 2 + 0.1 && Math.abs(pt.z - AEROPUERTO.z) < 0.4) continue;
      let tipo, sx = 1, sy = 1, verde = VERDES.templado;
      if (pt.h > 0.32 || w.taiga > 0.5) { tipo = 'pino'; verde = VERDES.taiga; }
      else if (V.helecho || pt.oasis) tipo = 'helecho';
      else if (w.selva > 0.4) { tipo = hash(i) < 0.3 ? 'helecho' : 'frondoso'; sx = sy = 1.35; verde = VERDES.selva; }
      else if (w.sabana > 0.4) { tipo = 'frondoso'; sx = 1.4; sy = 0.55; verde = VERDES.sabana; }
      else tipo = 'frondoso';
      const m = arboles[tipo], j = n[tipo]++;
      if (j >= m.instanceMatrix.count) continue;
      const s = 0.75 + 0.6 * hash(i);
      poner(m, j, pt.x, pt.h - 0.004, pt.z, hash(i + 7) * 6.28, s * sx, s * sy, s * sx);
      _c.copy(verde).lerp(VERDES.seco, Math.max(0, V.seco - 0.3)).offsetHSL((hash(i + 3) - 0.5) * 0.04, 0, (hash(i + 5) - 0.5) * 0.12);
      if (pt.h > V.nieve - 0.08) _c.lerp(nevado, 0.6);
      m.setColorAt(j, _c);
    }
    for (const [t, m] of Object.entries(arboles)) { m.count = Math.min(n[t], m.instanceMatrix.count); m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }

  // ---------- edificios ----------
  const DOBLES = new Set(['coliseo', 'estadio', 'domo']);
  const edif = {};
  for (const t of Object.keys(CAPACIDAD)) edif[t] = { malla: pool(G[t], CAPACIDAD[t], t === 'fogata' ? MATERIALES.brillo : DOBLES.has(t) ? MATERIALES.doble : mat), items: new Map() };
  // parcelas de cada sitio, de dentro hacia fuera, en rejilla (las calles van entre filas)
  const lotes = {}, rejillas = {};
  for (const [id, s] of Object.entries(SITIOS)) {
    const L = [], R = s.r * 1.45;
    rejillas[id] = { x0: s.x - R, z0: s.z - R, R, paso: PASO_LOTE };
    for (let gx = -R; gx <= R; gx += PASO_LOTE) for (let gz = -R; gz <= R; gz += PASO_LOTE) {
      const x = s.x + gx + (rnd() - 0.5) * 0.012, z = s.z + gz + (rnd() - 0.5) * 0.012, d = Math.hypot(x - s.x, z - s.z);
      if (d > R || !dentro(x, z, 0.12) || altura(x, z) < 0.03 || terreno.distRio(x, z) < 0.1 || pendiente(x, z) > 0.45 || enLago(x, z)) continue;
      L.push({ x, z, d: d + rnd() * 0.05, rot: Math.round(Math.atan2(s.x - x, s.z - z) / (Math.PI / 2)) * Math.PI / 2 });
    }
    L.sort((a, b) => a.d - b.d);
    lotes[id] = L;
  }
  const POR_CASA = [99, 4, 3.5, 3, 3, 3, 3, 4];
  function casaDe(L, dn, i) {
    switch (L) {
      case 1: return 'tienda';
      case 2: return 'choza';
      case 3: return 'casaPiedra';
      case 4: return 'casaMadera';
      case 5: return dn > 0.45 && i % 6 === 3 ? 'fabrica' : 'casaLadrillo';
      case 6: return dn < 0.3 ? 'torre' : dn < 0.55 ? (i % 3 ? 'casaLadrillo' : 'torre') : 'casaModerna';
      default: return dn < 0.35 ? 'torreFuturo' : dn < 0.6 ? (i % 5 === 2 ? 'domo' : 'torre') : 'casaModerna';
    }
  }
  // el coliseo aparece con Roma y se queda como monumento hasta hoy
  const conColiseo = pu => pu.id === 'A' && pu.nivel >= 3 && (V.a <= 2000 || pu.nombre.startsWith('Romanos'));
  function especiales(pu) {
    const L = pu.nivel, A = pu.id === 'A', col = conColiseo(pu) ? ['coliseo'] : [];
    switch (L) {
      case 3: return A ? ['templo', ...col] : [];
      case 4: return A ? ['castillo', 'iglesia', ...col] : ['iglesia'];
      case 5: return A ? [...col, 'estacion'] : ['estacion'];
      case 6: return A ? [...col, 'estadio'] : [];
      case 7: return A ? [...col, 'domo', 'estadio'] : ['domo'];
      default: return [];
    }
  }
  let urbano = [];
  function planDe(pu) {
    const L = pu.nivel, lots = lotes[pu.id], out = [], ocupado = [];
    if (L < 1) return { out, r: 0 };
    const esp = especiales(pu);
    const nCasas = Math.min(lots.length, Math.ceil(pu.n / POR_CASA[L]) + (pu.ruinas > 0.05 ? 6 : 0) + esp.length);
    let i = 0, rMax = 0.12;
    const libre = (x, z, r) => ocupado.every(o => Math.hypot(x - o.x, z - o.z) > (r + o.r) * 0.92);
    for (; i < lots.length && out.length < nCasas; i++) {
      const lt = lots[i], dn = lt.d / pu.r;
      let tipo = esp.length ? esp[0] : casaDe(L, dn, i);
      if (!libre(lt.x, lt.z, RADIO[tipo])) {
        if (esp.length && i < lots.length * 0.5) continue;
        if (esp.length) esp.shift();
        tipo = casaDe(L, dn, 1);
        if (!libre(lt.x, lt.z, RADIO[tipo])) continue;
      }
      if (esp.length && tipo === esp[0]) esp.shift();
      ocupado.push({ x: lt.x, z: lt.z, r: RADIO[tipo] });
      let alto = 1;
      // rascacielos en el centro (alturas muy variadas), bloques medianos alrededor
      if (tipo === 'torre') alto = dn < 0.3 ? 0.1 + 0.5 * Math.pow(1 - dn / 0.3, 1.3) * (0.25 + 0.75 * hash(i * 31 + 1)) : 0.07 + 0.06 * hash(i * 31 + 1);
      if (tipo === 'torreFuturo') alto = 0.2 + 0.6 * Math.pow(Math.max(0, 1 - dn / 0.35), 1.2) * (0.3 + 0.7 * hash(i * 17 + 3));
      if (pu.ruinas > 0.05 && hash(i * 13 + (pu.id === 'A' ? 0 : 99)) < pu.ruinas) { tipo = 'ruina'; alto = 1; }
      out.push({ key: `${pu.id}:${i}:${tipo}`, tipo, x: lt.x, z: lt.z, rot: lt.rot, alto, pu: pu.id });
      if (L === 1 && i % 4 === 0 && tipo !== 'ruina') out.push({ key: `${pu.id}:${i}:fogata`, tipo: 'fogata', x: lt.x + 0.035, z: lt.z + 0.02, rot: 0, alto: 1 });
      rMax = Math.max(rMax, lt.d + RADIO[tipo]);
    }
    // campos (y molinos entre ellos desde la Edad Media)
    const nCampos = L >= 2 && L <= 5 ? Math.round(out.length * [0, 0, 0.8, 0.7, 0.6, 0.35][L]) : 0;
    for (let c = 0; i < lots.length && c < nCampos; i++) {
      const lt = lots[i];
      const molino = (L === 4 || L === 5) && c % 7 === 3;
      const tipo = molino ? 'molino' : 'campo';
      if (!libre(lt.x, lt.z, RADIO[tipo])) continue;
      ocupado.push({ x: lt.x, z: lt.z, r: RADIO[tipo] });
      out.push({ key: `${pu.id}:${i}:${tipo}`, tipo, x: lt.x, z: lt.z, rot: molino ? hash(i) * 6.28 : lt.rot, alto: 1, color: molino ? null : hash(i) < 0.5 ? '#d8c060' : '#7aa848' });
      c++;
    }
    // acueducto romano: del lago a la ciudad
    if (pu.id === 'A' && conColiseo(pu) && (L === 3 || L === 4) && pu.ruinas < 0.3) {
      const x0 = LAGO.x - LAGO.r * 0.9, z0 = LAGO.z + LAGO.r * 0.6, x1 = pu.x + 0.35, z1 = pu.z - 0.3;
      const largo = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(largo / 0.066), rot = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n, y = altura(x, z);
        if (y < mar || enLago(x, z)) continue;
        out.push({ key: `acueducto:${k}`, tipo: 'arco', x, z, rot, alto: 1 });
      }
    }
    // puerto en la costa más cercana
    if (pu.id === 'A' && L >= 3 && pu.ruinas < 0.5) {
      for (let x = pu.x; x > -MITAD + 0.2; x -= 0.04) {
        if (altura(x, pu.z + 0.35) < mar + 0.005) { out.push({ key: `puerto:${L >= 5 ? 1 : 0}`, tipo: 'puerto', x: x + 0.08, z: pu.z + 0.35, rot: Math.PI / 2, alto: 1, flota: true }); break; }
      }
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
      if (pu.nivel >= 2) urbano.push({ id: pu.id, x: pu.x, z: pu.z, r: r * 0.9, suelo: pu.nivel >= 6 ? 'urbano6' : pu.nivel >= 5 ? 'urbano5' : pu.nivel >= 3 ? 'urbano3' : null, nivel: pu.nivel });
    }
    // aeropuerto: en cuanto alguien llega a la era moderna
    if (V.pueblos.some(p => p.nivel >= 6 && p.ruinas < 0.3)) deseados.set('terminal', { key: 'terminal', tipo: 'terminal', x: AEROPUERTO.x, z: AEROPUERTO.z + 0.27, rot: 0, alto: 1 });
    for (const E of Object.values(edif)) for (const k of E.items.keys()) if (!deseados.has(k)) { E.items.delete(k); animando = true; }
    for (const [k, b] of deseados) {
      const E = edif[b.tipo];
      if (!E.items.has(k) && E.items.size < CAPACIDAD[b.tipo]) { E.items.set(k, { ...b, t0: t, y: b.flota ? mar : altura(b.x, b.z) }); animando = true; }
    }
  }
  function dibujarEdificios(t) {
    if (!animando) return;
    animando = false;
    for (const E of Object.values(edif)) {
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
    sauropodo: pool(G.sauropodo, 70), teropodo: pool(G.teropodo, 28), mamifero: pool(G.mamifero, 80), cazador: pool(G.mamifero, 24),
  };
  const personas = [], animales = [];
  const PIEL = ['#e8c4a0', '#c89a72', '#a0704a', '#7a4e30', '#f0d4b8'];
  const ROPA = { 0: ['#7a5a3a'], 1: ['#8a6a4a', '#7a5a3a'], 2: ['#b8a070', '#8a7a5a'], 3: ['#e8e0d0', '#c8463c'], 4: ['#6a5a8a', '#8a3a3a', '#5a6a4a'], 5: ['#3a3a4a', '#5a4a3a'], 6: ['#3a6aa8', '#c8c8c8', '#2a2a2a', '#c86a3a'], 7: ['#e8f4ff', '#8ad0ff'] };

  function nuevaPersona(pu) {
    const [x, z] = pu.nivel >= 1 ? puntoTierra(pu.x, pu.z, pu.r * 0.7) : puntoTierra(pu.x + 0.6, pu.z - 0.9, 0.6);
    personas.push({ pu: pu.id, x, z, tx: x, tz: z, rot: rnd() * 6.28, pausa: rnd() * 2, vivo: true, muerteT: 0, huir: 0, hx: 0, hz: 0, soldado: false, fase: rnd() * 6.28,
      piel: PIEL[Math.floor(rnd() * PIEL.length)], tono: rnd() });
  }
  const colorPueblo = new THREE.Color();
  function colorRopa(per, pu) {
    const lista = ROPA[pu.nivel] || ROPA[1];
    _c.set(lista[Math.floor(per.tono * lista.length)]);
    colorPueblo.set(pu.color);
    if (per.soldado) _c.copy(colorPueblo).multiplyScalar(0.85);
    else _c.lerp(colorPueblo, 0.35);
    return _c;
  }
  function sincronizarPersonas() {
    let total = 0;
    for (const pu of V.pueblos) {
      const quiero = Math.min(pu.n, TOPE_PERSONAS - total - 4);
      total += Math.max(0, quiero);
      const vivos = personas.filter(p => p.vivo && p.pu === pu.id);
      for (let i = vivos.length; i < quiero; i++) nuevaPersona(pu);
      for (let i = quiero; i < vivos.length; i++) { vivos[i].vivo = false; vivos[i].muerteT = -1; }
    }
    for (const per of personas) if (per.vivo && !V.pueblos.some(pu => pu.id === per.pu)) { per.vivo = false; per.muerteT = -1; }
    const gw = V.guerra;
    for (const per of personas) {
      if (!per.vivo) continue;
      const debe = !!gw && (per.pu === gw.ataca ? hash(per.fase * 1000) < 0.55 : per.pu === gw.defiende ? hash(per.fase * 1000) < 0.45 : false);
      if (debe !== per.soldado) { per.soldado = debe; per.pausa = 0; }
    }
  }

  function nuevoAnimal(tipo) {
    // los grandes viven lejos de los pueblos; los herbívoros prefieren el bosque del norte
    const cx = tipo === 'sauropodo' ? rnd() * 4.2 - 2.4 : rnd() * 7 - 3.5, cz = tipo === 'sauropodo' ? -2.4 + rnd() * 2.4 : rnd() * 7 - 3.5;
    const [x, z] = puntoTierra(cx, cz, 0.6, 20);
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

  // ---------- explosiones: muertos y huida ----------
  function golpe(x, z, rMuerte = 0.6, rHuida = 1.6) {
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
  function pasoPersonas(dt) {
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
          const k = s.pu === gw.ataca ? 0.62 : 0.5;
          if (s.pausa <= 0 || Math.hypot(s.tx - s.x, s.tz - s.z) < 0.02) {
            s.tx = propio.x + (enemigo.x - propio.x) * k + (hash(s.fase * 99) - 0.5) * 0.6;
            s.tz = propio.z + (enemigo.z - propio.z) * k + (hash(s.fase * 77) - 0.5) * 0.6;
            s.pausa = 1 + rnd() * 2;
          }
          s.pausa -= dt;
          anda = mover(s, 0.07, dt);
          if (combate) {
            for (const o of personas) {
              if (!o.vivo || o.pu === s.pu || !o.soldado) continue;
              if (Math.hypot(o.x - s.x, o.z - s.z) < 0.06) { s.tx = o.x; s.tz = o.z; if (rnd() < 0.12) { o.vivo = false; o.muerteT = 0.01; } break; }
            }
          }
        } else {
          if (s.pausa > 0) s.pausa -= dt;
          else if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.015) {
            const [x, z] = pu.nivel >= 1 ? puntoTierra(pu.x, pu.z, pu.r * (pu.nivel >= 2 ? 1.05 : 0.8), 4) : puntoTierra(s.x, s.z, 0.4, 4);
            s.tx = x; s.tz = z; s.pausa = 0.5 + rnd() * 3;
          }
          anda = mover(s, 0.04, dt);
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
          for (const pr of presas) { if (!pr.vivo) continue; const d = Math.hypot(pr.x - s.x, pr.z - s.z); if (d < 0.8 && (!mejor || d < mejor.d)) mejor = { pr, d }; }
          if (mejor) {
            s.tx = mejor.pr.x; s.tz = mejor.pr.z; vel = 0.1;
            if (mejor.d < 0.2 && !mejor.pr.huir) { mejor.pr.huir = 1.5; mejor.pr.hx = (mejor.pr.x - s.x) / mejor.d; mejor.pr.hz = (mejor.pr.z - s.z) / mejor.d; }
            if (mejor.d < 0.05 && rnd() < dt * 0.8) { mejor.pr.vivo = false; mejor.pr.muerteT = 0.01; }
          }
        }
        if (s.pausa > 0) s.pausa -= dt;
        else if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.02) { const [x, z] = puntoTierra(s.x, s.z, 0.7, 5); s.tx = x; s.tz = z; s.pausa = 1 + rnd() * 4; }
        s._anda = mover(s, vel, dt);
        s.fase += dt * (s._anda ? 9 : 0);
      }
      const m = mallas[s.tipo], j = n[s.tipo]++;
      if (j >= m.instanceMatrix.count) continue;
      const esc = s.tipo === 'sauropodo' ? (V?.fauna.gigantes || 1) * (0.85 + 0.3 * s.tono) : s.tipo === 'cazador' ? 1.7 : s.tipo === 'teropodo' ? 0.9 + 0.3 * s.tono : 0.8 + 0.4 * s.tono;
      const y = altura(s.x, s.z), bote = s.vivo && s._anda ? Math.abs(Math.sin(s.fase)) * 0.006 * esc : 0;
      poner(m, j, s.x, y + bote, s.z, s.rot, esc, esc, esc, 0, s.vivo ? 0 : Math.PI / 2 * Math.min(1, s.muerteT * 2));
      const lista = COLOR_ANIMAL[s.tipo === 'mamifero' && V?.fauna.tipoPeq === 'reptil' ? 'reptil' : s.tipo];
      _c.set(lista[Math.floor(s.tono * lista.length)]);
      if (s.quemado) _c.multiplyScalar(0.15);
      m.setColorAt(j, _c);
    }
    for (const k of Object.keys(n)) { mallas[k].count = Math.min(n[k], mallas[k].instanceMatrix.count); mallas[k].instanceMatrix.needsUpdate = true; mallas[k].instanceColor.needsUpdate = true; }
  }

  let reloj = 0;
  return {
    grupo, G,
    get urbano() { return urbano; },
    rejilla: id => rejillas[id],
    // edificios de un tipo (para el humo de las fábricas)
    edificios: tipo => [...(edif[tipo]?.items.values() || [])],
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
      pasoPersonas(dt);
      pasoAnimales(dt);
    },
  };
}
