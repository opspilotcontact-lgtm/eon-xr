// El Valle: una parcela de 9 × 9 unidades que resume la Tierra. El relieve es fijo por diseño
// (para que siempre haya de todo) con detalle de ruido por semilla:
//   mar con isla al oeste · río que baja de la montaña, cruza un lago y desemboca junto a la ciudad
//   taiga al norte · bosque templado en el centro norte · selva al suroeste · sabana al sur
//   desierto con oasis al sureste · cordillera nevada al noreste.
import * as THREE from 'three';
import { crearRuido } from '../sim/ruido.js';

export const LADO = 9, MITAD = 4.5, FONDO = -0.5;
const SEG = 176, NV = SEG + 1;

// sitios fijos: A = ciudad del río (junto a la desembocadura), B = pueblo del monte
export const SITIOS = {
  A: { x: -1.55, z: 1.15, r: 1.35 },
  B: { x: 2.45, z: 0.55, r: 0.85 },
};
export const AEROPUERTO = { x: 0.75, z: 3.05, largo: 1.5, ancho: 0.32 };
export const LAGO = { x: 0.35, z: -1.45, r: 0.62, y: 0.05 };
export const OASIS = { x: 3.25, z: 3.3, r: 0.2, y: 0.12 };
const RIO = [[2.7, -2.35], [1.7, -1.75], [0.9, -1.5], [-0.25, -1.25], [-0.85, -0.35], [-1.35, 0.35], [-2.15, 0.62], [-3.4, 0.85]];
export const COSTA_X = -2.75;

export const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezclar = (a, b, t) => a + (b - a) * t;

function distSegmento(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}
export function distRio(x, z) {
  let d = Infinity;
  for (let i = 0; i < RIO.length - 1; i++) d = Math.min(d, distSegmento(x, z, RIO[i][0], RIO[i][1], RIO[i + 1][0], RIO[i + 1][1]));
  return d;
}

export function crearTerreno(semilla) {
  const { fbm } = crearRuido((semilla ^ 0x5eed) >>> 0);
  const costa = z => COSTA_X + 0.55 * fbm(z * 0.45, 3.1, 0.7, 3);

  // pesos de bioma (0–1) en un punto: los usan el color del suelo y los árboles
  function pesos(x, z) {
    const n = fbm(x * 1.1, z * 1.1, 2.2, 3);
    const tierraDentro = suave(0.05, 0.5, x - costa(z));
    return {
      taiga: suave(-2.0, -2.9, z) * tierraDentro,
      bosque: suave(-0.2, -0.9, z) * (1 - suave(-2.1, -2.8, z)) * (1 - suave(1.9, 2.6, x)) * tierraDentro * (0.6 + 0.8 * Math.max(0, n + 0.2)),
      selva: suave(-0.7, -1.4, x) * suave(1.9, 2.6, z) * tierraDentro,
      sabana: suave(-0.6, 0.1, x) * (1 - suave(1.5, 2.1, x)) * suave(1.4, 2.1, z),
      desierto: suave(1.5, 2.2, x) * suave(1.6, 2.3, z),
      costa: 1 - suave(0.05, 0.45, x - costa(z)),
      rio: 1 - suave(0.06, 0.28, distRio(x, z)),
      lago: 1 - suave(LAGO.r * 0.8, LAGO.r * 1.4, Math.hypot(x - LAGO.x, z - LAGO.z)),
      ruido: n,
    };
  }

  // ---------- relieve ----------
  const h = new Float32Array(NV * NV);
  function relieve(x, z) {
    const n = fbm(x * 0.7, z * 0.7, 1.7, 4);
    let y = 0.1 + n * 0.06;
    // colinas en el norte
    y += 0.12 * suave(0.0, -2.2, z) * (0.5 + fbm(x * 1.3, z * 1.3, 8.2, 3));
    // cordillera al noreste: pico grande y pico secundario
    const g1 = Math.exp(-((x - 3.15) ** 2 + (z + 3.15) ** 2) / (2 * 1.15 ** 2));
    const g2 = Math.exp(-((x - 1.25) ** 2 + (z + 3.75) ** 2) / (2 * 0.7 ** 2));
    y += g1 * (1.3 + 0.4 * fbm(x * 1.8, z * 1.8, 4.4, 4)) + g2 * (0.75 + 0.3 * fbm(x * 2.1, z * 2.1, 6.1, 3));
    // dunas al sureste
    const wD = suave(1.5, 2.2, x) * suave(1.6, 2.3, z);
    y += wD * (0.03 * Math.sin(x * 7 + z * 3 + n * 3) + 0.03);
    // llanos para los pueblos y el aeropuerto
    for (const s of Object.values(SITIOS)) {
      const d = Math.hypot(x - s.x, z - s.z), w = 1 - suave(s.r * 0.55, s.r * 1.1, d);
      y = mezclar(y, s === SITIOS.A ? 0.1 : 0.17, w * 0.88);
    }
    {
      const ax = Math.abs(x - AEROPUERTO.x) - AEROPUERTO.largo / 2, az = Math.abs(z - AEROPUERTO.z) - AEROPUERTO.ancho / 2;
      y = mezclar(y, 0.11, 1 - suave(0, 0.3, Math.max(ax, az, 0)));
    }
    // mar al oeste con una isla
    const d = x - costa(z), tierra = suave(-0.05, 0.6, d);
    const isla = Math.exp(-((x + 3.75) ** 2 + (z + 2.6) ** 2) / (2 * 0.42 ** 2));
    y = mezclar(-0.36 + 0.06 * n, y, tierra);
    if (tierra < 0.9) y = Math.max(y, -0.36 + isla * 0.62 + isla * n * 0.1);
    // lago y oasis
    const dl = Math.hypot(x - LAGO.x, z - LAGO.z);
    y = mezclar(y, LAGO.y - 0.09 * (1 - Math.min(1, dl / LAGO.r)), 1 - suave(LAGO.r * 0.75, LAGO.r * 1.15, dl));
    const doa = Math.hypot(x - OASIS.x, z - OASIS.z);
    y = mezclar(y, OASIS.y - 0.04, 1 - suave(OASIS.r * 0.7, OASIS.r * 1.3, doa));
    // río
    const dr = distRio(x, z), wR = 1 - suave(0.045, 0.12, dr);
    y -= wR * 0.07;
    return y;
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) h[j * NV + i] = relieve(-MITAD + LADO * i / SEG, -MITAD + LADO * j / SEG);
  // pesos precalculados por vértice de la rejilla
  const P = Array.from({ length: NV * NV }, (_, k) => pesos(-MITAD + LADO * (k % NV) / SEG, -MITAD + LADO * Math.floor(k / NV) / SEG));

  function altura(x, z) {
    const fx = Math.min(SEG - 1e-4, Math.max(0, (x + MITAD) / LADO * SEG)), fz = Math.min(SEG - 1e-4, Math.max(0, (z + MITAD) / LADO * SEG));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * NV + i;
    return mezclar(mezclar(h[k], h[k + 1], u), mezclar(h[k + NV], h[k + NV + 1], u), v);
  }
  function pendiente(x, z) {
    const e = 0.04;
    return Math.hypot(altura(x + e, z) - altura(x - e, z), altura(x, z + e) - altura(x, z - e)) / (2 * e);
  }
  const dentro = (x, z, m = 0.08) => Math.abs(x) < MITAD - m && Math.abs(z) < MITAD - m;
  const enLago = (x, z) => Math.hypot(x - LAGO.x, z - LAGO.z) < LAGO.r * 0.95 || Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.r;

  // ---------- mallas ----------
  const grupo = new THREE.Group(); grupo.name = 'valle';
  const geo = new THREE.PlaneGeometry(LADO, LADO, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const idx = new Uint32Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    const i = Math.round((pos.getX(v) + MITAD) / LADO * SEG), j = Math.round((pos.getZ(v) + MITAD) / LADO * SEG);
    idx[v] = j * NV + i;
    pos.setY(v, h[idx[v]]);
  }
  geo.computeVertexNormals();
  const colores = new Float32Array(pos.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  const matSuelo = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, emissive: new THREE.Color('#ff4a12'), emissiveIntensity: 0 });
  const suelo = new THREE.Mesh(geo, matSuelo); suelo.name = 'suelo';
  grupo.add(suelo);

  // corte de diorama: paredes de tierra con estratos y base
  {
    const ps = [], cs = [], ix = [];
    const estrato = (y, t) => { const b = Math.sin(y * 34 + t * 0.7) * 0.5 + 0.5; return [0.24 + 0.08 * b, 0.17 + 0.05 * b, 0.11 + 0.03 * b]; };
    const lado = fx => {
      const base = ps.length / 3;
      for (let s = 0; s <= SEG; s++) {
        const [x, z] = fx(s / SEG * LADO - MITAD), yt = altura(x, z);
        ps.push(x, FONDO, z, x, Math.max(yt, FONDO + 0.01), z);
        cs.push(0.13, 0.09, 0.06, ...estrato(yt, s));
        if (s) { const a = base + (s - 1) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    };
    lado(t => [t, MITAD]); lado(t => [t, -MITAD]); lado(t => [MITAD, t]); lado(t => [-MITAD, t]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
    g.setIndex(ix); g.computeVertexNormals();
    const paredes = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    const base = new THREE.Mesh(new THREE.BoxGeometry(LADO + 0.05, 0.06, LADO + 0.05), new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 1 }));
    base.position.y = FONDO - 0.03;
    grupo.add(paredes, base);
  }

  // mar: caja de agua cuyo techo es el nivel del mar (en el corte se ve como un acuario)
  const matAgua = new THREE.MeshStandardMaterial({ color: '#2d6f9e', transparent: true, opacity: 0.7, roughness: 0.12, metalness: 0.1, depthWrite: false });
  const mar = new THREE.Mesh(new THREE.BoxGeometry(LADO - 0.004, 1, LADO - 0.004).translate(0, 0.5, 0), matAgua);
  mar.renderOrder = 3;
  grupo.add(mar);
  // lago y oasis: discos de agua dulce con su propio nivel
  const matDulce = new THREE.MeshStandardMaterial({ color: '#3a86a8', transparent: true, opacity: 0.78, roughness: 0.1, depthWrite: false });
  const lago = new THREE.Mesh(new THREE.CircleGeometry(LAGO.r * 1.08, 48).rotateX(-Math.PI / 2), matDulce);
  lago.position.set(LAGO.x, LAGO.y, LAGO.z); lago.renderOrder = 3;
  const oasis = new THREE.Mesh(new THREE.CircleGeometry(OASIS.r * 1.1, 24).rotateX(-Math.PI / 2), matDulce);
  oasis.position.set(OASIS.x, OASIS.y, OASIS.z); oasis.renderOrder = 3;
  grupo.add(lago, oasis);

  // río: cinta sobre el cauce
  const rio = (() => {
    const pts = [];
    for (let i = 0; i < RIO.length - 1; i++) {
      const [ax, az] = RIO[i], [bx, bz] = RIO[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.03);
      for (let s = 0; s < n; s++) pts.push([mezclar(ax, bx, s / n), mezclar(az, bz, s / n)]);
    }
    pts.push(RIO[RIO.length - 1]);
    const ps = [], ix = [];
    pts.forEach(([x, z], i) => {
      const [nx, nz] = pts[Math.min(i + 1, pts.length - 1)], [px, pz] = pts[Math.max(i - 1, 0)];
      let tx = nx - px, tz = nz - pz; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const w = 0.045 + 0.035 * i / pts.length, y = altura(x, z) + 0.045;
      ps.push(x - tz * w, y, z + tx * w, x + tz * w, y, z - tx * w);
      if (i) { const a = (i - 1) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); g.setIndex(ix); g.computeVertexNormals();
    const m = new THREE.Mesh(g, matDulce); m.renderOrder = 3;
    return m;
  })();
  grupo.add(rio);

  // golpe: caja invisible para soltar poderes y regalos (lo que importa es x, z)
  const golpe = new THREE.Mesh(new THREE.BoxGeometry(LADO, 0.3, LADO), new THREE.MeshBasicMaterial({ visible: false }));
  golpe.position.y = 0.05; golpe.name = 'golpeValle';
  grupo.add(golpe);

  // ---------- color según la época ----------
  const C = hex => new THREE.Color(hex);
  const K = {
    lavaA: C('#1a0e0a'), lavaB: C('#ff5a12'), roca: C('#6b625a'), rocaOsc: C('#4a4440'), arena: C('#d4b980'), arenaOsc: C('#8a7a5a'),
    tapete: C('#3f7a6a'), musgo: C('#5d7a3a'), selvaVieja: C('#2a4a22'), bosque: C('#2e5a26'), taiga: C('#2a4a3a'), selva: C('#1f5a22'),
    pradera: C('#6f9a3e'), sabana: C('#a8a858'), seca: C('#b49a5a'), nieve: C('#eef3f7'), desierto: C('#dcbc7c'), lecho: C('#3a3a3a'),
    ceniza: C('#2a2622'), urbano3: C('#bfa888'), urbano5: C('#6e665c'), urbano6: C('#55575a'), radiacion: C('#3a4a2a'),
  };
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  let clave = '';

  // e = { lava, mar, plantas, hierba, helecho, nieve (cota), seco, tapetes, ciudades: [{x,z,r,suelo}], heridas: [{x,z,r,k}] }
  function actualizar(e) {
    const k = [e.lava > 0.5, Math.round(e.mar * 60), Math.round(e.plantas * 30), Math.round(e.hierba * 10), e.helecho, Math.round(e.nieve * 40), Math.round(e.seco * 20), e.tapetes,
      e.ciudades.map(c => `${c.x.toFixed(1)}${c.r.toFixed(2)}${c.suelo}`).join(), e.heridas.map(c => c.k.toFixed(1)).join()].join('|');
    const nivel = Math.max(FONDO + 0.002, e.mar), hayAgua = !e.lava && e.mar > FONDO + 0.05;
    mar.visible = !e.lava && e.mar > FONDO + 0.01;
    mar.scale.y = nivel - FONDO; mar.position.y = FONDO;
    rio.visible = hayAgua && e.seco < 0.75;
    lago.visible = hayAgua && e.seco < 0.9;
    lago.scale.setScalar(Math.max(0.3, 1 - Math.max(0, e.seco - 0.3) * 1.1));
    oasis.visible = hayAgua && e.seco < 0.6;
    matAgua.color.set(e.seco > 0.5 ? '#4a7a8a' : '#2d6f9e');
    if (k === clave) return; clave = k;
    matSuelo.emissiveIntensity = e.lava ? 0.45 : 0;
    for (let v = 0; v < pos.count; v++) {
      const i = idx[v], y = h[i], w = P[i], n = w.ruido;
      if (e.lava) {
        const t = Math.max(0, Math.min(1, (n + 0.15) * 3));
        tmp.copy(K.lavaA).lerp(K.lavaB, t * t);
        colores.set([tmp.r, tmp.g, tmp.b], v * 3); continue;
      }
      const alto = suave(0.4, 0.85, y);
      tmp.copy(K.arenaOsc).lerp(K.roca, 0.5 + n);
      tmp.lerp(K.desierto, w.desierto * 0.92);
      tmp.lerp(K.arena, w.costa * suave(e.mar + 0.08, e.mar + 0.01, y));
      tmp.lerp(K.rocaOsc, alto * 0.8);
      if (y < e.mar || w.lago > 0.9) tmp.lerp(K.lecho, 0.35);
      if (y > e.mar + 0.008) {
        const humedo = Math.min(1, 0.35 + w.rio * 0.6 + w.costa * 0.25 + w.bosque * 0.4 + w.selva * 0.6 + w.lago * 0.5) * (1 - e.seco * 0.8);
        const apto = (1 - w.desierto * 0.92) * (1 - alto * 0.85);
        if (e.tapetes && e.plantas < 0.05) tmp.lerp(K.tapete, w.costa * 0.5 + w.rio * 0.4 + w.lago * 0.4);
        const verde = Math.min(1, e.plantas * apto * (0.4 + humedo));
        if (verde > 0.01) {
          // sin hierba (antes de ~30 Ma) el suelo verde es musgo y helechos
          tmp2.copy(K.musgo).lerp(K.pradera, e.hierba);
          tmp2.lerp(K.sabana, w.sabana * e.hierba * 0.85).lerp(K.seca, e.seco * 0.8);
          const bosque = Math.min(1, (w.bosque + w.taiga * 0.8 + w.selva) * e.plantas * 1.2 + w.rio * e.plantas * 0.3);
          tmp2.lerp(e.helecho > 0.5 ? K.selvaVieja : w.selva > w.taiga ? K.selva : w.taiga > 0.3 ? K.taiga : K.bosque, bosque * (1 - e.seco * 0.6));
          tmp.lerp(tmp2, verde);
        }
        const nv = suave(e.nieve, e.nieve + 0.1, y + n * 0.08);
        if (nv > 0) tmp.lerp(K.nieve, nv);
      }
      const x = pos.getX(v), z = pos.getZ(v);
      for (const c of e.ciudades) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < c.r && y > e.mar) tmp.lerp(K[c.suelo] || K.urbano3, (1 - suave(c.r * 0.6, c.r, d)) * 0.7);
      }
      for (const c of e.heridas) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < c.r) tmp.lerp(d < c.r * 0.45 ? K.ceniza : K.radiacion, (1 - suave(c.r * 0.5, c.r, d)) * c.k);
      }
      colores.set([tmp.r, tmp.g, tmp.b], v * 3);
    }
    geo.attributes.color.needsUpdate = true;
  }

  return { grupo, golpe, suelo, altura, pendiente, dentro, enLago, pesos, actualizar, distRio, costa };
}
